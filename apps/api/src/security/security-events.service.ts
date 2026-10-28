import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { deviceLabel, SecurityEventType, type SecurityEventDto } from '@skedulei/contracts';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SecurityEvent } from './entities/security-event.entity';
import type { RequestContext } from './request-context';

/** Eventos que também vão para o log (para alertas em ferramentas de monitoramento). */
const LOUD: SecurityEventType[] = ['LOGIN_LOCKED', 'TOKEN_REUSE', 'MFA_DISABLED', 'ACCOUNT_DELETED', 'PASSWORD_RESET'];
const RETENTION_DAYS = 365;

@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger('Security');

  constructor(@InjectRepository(SecurityEvent) private readonly repo: Repository<SecurityEvent>) {}

  async record(type: SecurityEventType, userId: string | null, ctx: RequestContext = {}, meta?: Record<string, unknown>) {
    try {
      await this.repo.save(this.repo.create({ type, userId, ip: ctx.ip ?? null, userAgent: ctx.userAgent ?? null, meta: meta ?? null }));
    } catch (err) {
      this.logger.error(`Falha ao gravar evento ${type}: ${(err as Error).message}`);
    }
    if (LOUD.includes(type)) this.logger.warn(`${type} professor=${userId ?? '-'} ip=${ctx.ip ?? '-'}`);
  }

  async list(userId: string): Promise<SecurityEventDto[]> {
    const rows = await this.repo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      device: deviceLabel(r.userAgent),
      ip: maskIp(r.ip),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Remove eventos de mais de 1 ano (minimização de dados — LGPD). */
  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async prune() {
    await this.repo.delete({ createdAt: LessThan(new Date(Date.now() - RETENTION_DAYS * 86_400_000)) });
  }
}

/** '189.12.34.56' → '189.12.x.x' (o suficiente para reconhecer, sem expor o IP inteiro). */
export function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') return 'local';
  const v4 = ip.replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.split('.').slice(0, 2).join('.') + '.x.x';
  return ip.split(':').slice(0, 3).join(':') + ':…';
}
