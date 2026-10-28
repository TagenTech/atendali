import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { AUDIT_GROUPS, type AuditAction, type AuditEntryDto, type AuditQuery } from '@skedulei/contracts';
import { Member } from '../organizations/entities/member.entity';
import type { OrgContext } from '../organizations/org-context';
import { TenantDb } from '../tenancy/tenant-db';
import { AuditEntry } from './audit-entry.entity';

export interface AuditInput {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  summary: string;
  meta?: Record<string, unknown>;
}

/**
 * Trilha de auditoria do dinheiro e de dados sensíveis. `log` recebe o `em` da transação da própria ação:
 * se a ação falha e desfaz, o registro desfaz junto; se acontece, o registro existe — não dá para "esquecer" de gravar.
 */
@Injectable()
export class AuditService {
  constructor(private readonly tenant: TenantDb) {}

  async log(em: EntityManager, org: OrgContext, e: AuditInput): Promise<void> {
    const repo = em.getRepository(AuditEntry);
    await repo.save(
      repo.create({
        organizationId: org.organizationId,
        memberId: org.memberId,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId ?? null,
        summary: e.summary.slice(0, 300),
        meta: e.meta ?? null,
      }),
    );
  }

  async list(org: OrgContext, q: AuditQuery): Promise<AuditEntryDto[]> {
    const days = Math.min(365, Math.max(1, Math.trunc(q.dias ?? 30)));
    return this.tenant.transaction(async (em) => {
      const qb = em
        .getRepository(AuditEntry)
        .createQueryBuilder('a')
        .where('a.organizationId = :org AND a.createdAt >= :since', { org: org.organizationId, since: new Date(Date.now() - days * 86_400_000) })
        .orderBy('a.createdAt', 'DESC')
        .take(300);
      if (q.grupo && AUDIT_GROUPS[q.grupo]) qb.andWhere('a.action IN (:...actions)', { actions: [...AUDIT_GROUPS[q.grupo].actions] });
      const rows = await qb.getMany();
      const members = rows.length ? await em.getRepository(Member).find({ where: { id: In([...new Set(rows.map((r) => r.memberId))]), organizationId: org.organizationId }, select: { id: true, name: true, role: true } }) : [];
      const byId = new Map(members.map((m) => [m.id, m]));
      return rows.map((r) => ({
        id: r.id,
        action: r.action,
        summary: r.summary,
        actorName: byId.get(r.memberId)?.name ?? 'Pessoa removida',
        actorRole: byId.get(r.memberId)?.role ?? null,
        createdAt: r.createdAt.toISOString(),
      }));
    });
  }
}
