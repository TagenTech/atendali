import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import type { JwtPayload } from '../common/types/jwt-payload';

const CACHE_MS = 30_000;
const ACCESS_TTL_MS = 60 * 60_000;

/**
 * Revogação imediata de access tokens (JWT de 15 min):
 * - por professor: tokens emitidos antes de `tokensValidAfter` (troca de senha, sair de todos);
 * - por sessão: aparelho encerrado na tela "Aparelhos conectados".
 * O corte por professor fica no banco (sobrevive a reinício); por sessão fica em memória pelo tempo de vida do token.
 */
@Injectable()
export class SessionRevocationService {
  private readonly validAfter = new Map<string, { at: number; fetched: number }>();
  private readonly revokedSessions = new Map<string, number>();

  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async isRevoked(p: JwtPayload): Promise<boolean> {
    if (p.sid) {
      const until = this.revokedSessions.get(p.sid);
      if (until && until > Date.now()) return true;
    }
    const cut = await this.cutoff(p.sub);
    return cut !== null && (p.iat ?? 0) * 1000 < cut;
  }

  /** Invalida todos os tokens já emitidos do professor. */
  async revokeAllFor(userId: string) {
    // Truncado ao segundo: tokens novos (iat em segundos) emitidos logo depois continuam valendo.
    const at = Math.floor(Date.now() / 1000) * 1000;
    await this.users.update(userId, { tokensValidAfter: new Date(at) });
    this.validAfter.set(userId, { at, fetched: Date.now() });
  }

  /** Conta excluída: nenhum token dela vale mais (sem esperar o cache). */
  markDeleted(userId: string) {
    this.validAfter.set(userId, { at: Number.MAX_SAFE_INTEGER, fetched: Number.MAX_SAFE_INTEGER });
  }

  revokeSession(sessionId: string) {
    this.revokedSessions.set(sessionId, Date.now() + ACCESS_TTL_MS);
    if (this.revokedSessions.size > 5000) {
      for (const [k, v] of this.revokedSessions) if (v < Date.now()) this.revokedSessions.delete(k);
    }
  }

  private async cutoff(userId: string): Promise<number | null> {
    const hit = this.validAfter.get(userId);
    if (hit && (hit.at === Number.MAX_SAFE_INTEGER || Date.now() - hit.fetched < CACHE_MS)) return hit.at || null;
    const t = await this.users.findOne({ where: { id: userId }, select: { id: true, tokensValidAfter: true } });
    // Conta excluída: todo token é inválido.
    const at = t ? (t.tokensValidAfter?.getTime() ?? 0) : Number.MAX_SAFE_INTEGER;
    this.validAfter.set(userId, { at, fetched: Date.now() });
    return at || null;
  }
}
