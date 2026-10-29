import type { Repository } from 'typeorm';
import type { User } from '../users/entities/user.entity';
import { SessionRevocationService } from './session-revocation.service';

describe('SessionRevocationService', () => {
  let validAfter: Date | null;
  let svc: SessionRevocationService;

  beforeEach(() => {
    validAfter = null;
    const repo = {
      findOne: jest.fn(async () => ({ id: 't1', tokensValidAfter: validAfter })),
      update: jest.fn(async (_id: string, p: { tokensValidAfter: Date }) => {
        validAfter = p.tokensValidAfter;
      }),
    } as unknown as Repository<User>;
    svc = new SessionRevocationService(repo);
  });

  it('token emitido antes do corte é recusado; depois, aceito', async () => {
    const before = Math.floor(Date.now() / 1000) - 60;
    expect(await svc.isRevoked({ sub: 't1', email: 'x', iat: before })).toBe(false);
    await svc.revokeAllFor('t1');
    expect(await svc.isRevoked({ sub: 't1', email: 'x', iat: before })).toBe(true);
    expect(await svc.isRevoked({ sub: 't1', email: 'x', iat: Math.floor(Date.now() / 1000) + 1 })).toBe(false);
  });

  it('sessão encerrada derruba o access token dela', async () => {
    const p = { sub: 't1', email: 'x', sid: 's1', iat: Math.floor(Date.now() / 1000) };
    expect(await svc.isRevoked(p)).toBe(false);
    svc.revokeSession('s1');
    expect(await svc.isRevoked(p)).toBe(true);
    expect(await svc.isRevoked({ ...p, sid: 's2' })).toBe(false);
  });

  it('conta excluída invalida tudo, e token sem iat conta como antigo', async () => {
    svc.markDeleted('t1');
    expect(await svc.isRevoked({ sub: 't1', email: 'x', iat: Math.floor(Date.now() / 1000) })).toBe(true);
  });

  it('usuário que não existe mais tem todo token recusado', async () => {
    const repo = { findOne: jest.fn(async () => null), update: jest.fn() } as unknown as Repository<User>;
    const orphan = new SessionRevocationService(repo);
    expect(await orphan.isRevoked({ sub: 'sumiu', email: 'x', iat: Math.floor(Date.now() / 1000) })).toBe(true);
  });

  it('limpa as sessões vencidas quando a lista cresce demais', () => {
    const map = (svc as unknown as { revokedSessions: Map<string, number> }).revokedSessions;
    for (let i = 0; i < 5001; i++) map.set(`velha${i}`, Date.now() - 1000);
    svc.revokeSession('nova');
    expect(map.size).toBe(1);
  });

  it('token sem iat é tratado como emitido em 1970 quando há corte', async () => {
    await svc.revokeAllFor('t1');
    expect(await svc.isRevoked({ sub: 't1', email: 'x' } as never)).toBe(true);
  });
});
