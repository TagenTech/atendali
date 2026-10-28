import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull, LessThan, Not } from 'typeorm';
import { AuditService } from '../auditoria/audit.service';
import {
  defaultChartOfAccounts,
  DEFAULT_ACCOUNT_NAME,
  formatBRL,
  monthlyDates,
  payableStatus,
  receivableStatus,
  todayIn,
  type FinanceAccountDto,
  type FinanceCategoryDto,
  type PayableDto,
  type PayablesListDto,
  type ReceivableDto,
  type ReceivablesListDto,
} from '@skedulei/contracts';
import { Organization } from '../organizations/entities/organization.entity';
import type { OrgContext } from '../organizations/org-context';
import { TenantDb } from '../tenancy/tenant-db';
import { mainUnit } from './cash.service';
import {
  AccountDto,
  CategoryDto,
  CreatePayableDto,
  CreateReceivableDto,
  LedgerQueryDto,
  SettlePayableDto,
  SettleReceivableDto,
  UpdateAccountDto,
  UpdateCategoryDto,
  UpdatePayableDto,
  UpdateReceivableDto,
} from './dto/ledger.dto';
import { FinanceAccount, FinanceCategory, Payable, Receivable } from './entities/ledger.entity';

const catDto = (c: FinanceCategory): FinanceCategoryDto => ({ id: c.id, name: c.name, type: c.type, active: c.active });
const accDto = (a: FinanceAccount): FinanceAccountDto => ({ id: a.id, name: a.name, active: a.active });

@Injectable()
export class LedgerService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
  ) {}

  /** "Hoje" no fuso da unidade. */
  private async today(em: EntityManager, org: OrgContext) {
    return todayIn((await mainUnit(em, org.organizationId)).timezone);
  }

  // ---------------------------------------------------------------- plano de contas e contas

  /** Primeira vez: cria o plano de contas do segmento e a conta principal (trava para duas telas não duplicarem). */
  private async seed(em: EntityManager, org: OrgContext) {
    await em.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`ledger-seed:${org.organizationId}`]);
    const cats = em.getRepository(FinanceCategory);
    if (!(await cats.count({ where: { organizationId: org.organizationId } }))) {
      const o = await em.getRepository(Organization).findOneByOrFail({ id: org.organizationId });
      await cats.insert(defaultChartOfAccounts(o.segment).map((c) => ({ ...c, organizationId: org.organizationId })));
    }
    const accs = em.getRepository(FinanceAccount);
    if (!(await accs.count({ where: { organizationId: org.organizationId } }))) {
      await accs.insert({ organizationId: org.organizationId, name: DEFAULT_ACCOUNT_NAME });
    }
  }

  async categories(org: OrgContext): Promise<FinanceCategoryDto[]> {
    return this.tenant.transaction(async (em) => {
      await this.seed(em, org);
      const rows = await em.getRepository(FinanceCategory).find({ where: { organizationId: org.organizationId }, order: { type: 'ASC', createdAt: 'ASC', name: 'ASC' } });
      return rows.map(catDto);
    });
  }

  async createCategory(org: OrgContext, dto: CategoryDto): Promise<FinanceCategoryDto> {
    return this.tenant.transaction(async (em) => {
      await this.seed(em, org);
      const repo = em.getRepository(FinanceCategory);
      if (await repo.findOne({ where: { organizationId: org.organizationId, name: dto.name, type: dto.type } })) {
        throw new BadRequestException('Já existe uma categoria com esse nome');
      }
      return catDto(await repo.save(repo.create({ organizationId: org.organizationId, name: dto.name, type: dto.type })));
    });
  }

  async updateCategory(org: OrgContext, id: string, dto: UpdateCategoryDto): Promise<FinanceCategoryDto> {
    return this.tenant.transaction(async (em) => {
      const repo = em.getRepository(FinanceCategory);
      const c = await repo.findOne({ where: { id, organizationId: org.organizationId } });
      if (!c) throw new NotFoundException('Categoria não encontrada');
      if (dto.name !== undefined) c.name = dto.name;
      if (dto.active !== undefined) c.active = dto.active;
      return catDto(await repo.save(c));
    });
  }

  async accounts(org: OrgContext): Promise<FinanceAccountDto[]> {
    return this.tenant.transaction(async (em) => {
      await this.seed(em, org);
      const rows = await em.getRepository(FinanceAccount).find({ where: { organizationId: org.organizationId }, order: { createdAt: 'ASC' } });
      return rows.map(accDto);
    });
  }

  async createAccount(org: OrgContext, dto: AccountDto): Promise<FinanceAccountDto> {
    return this.tenant.transaction(async (em) => {
      await this.seed(em, org);
      const repo = em.getRepository(FinanceAccount);
      return accDto(await repo.save(repo.create({ organizationId: org.organizationId, name: dto.name })));
    });
  }

  async updateAccount(org: OrgContext, id: string, dto: UpdateAccountDto): Promise<FinanceAccountDto> {
    return this.tenant.transaction(async (em) => {
      const repo = em.getRepository(FinanceAccount);
      const a = await repo.findOne({ where: { id, organizationId: org.organizationId } });
      if (!a) throw new NotFoundException('Conta não encontrada');
      if (dto.name !== undefined) a.name = dto.name;
      if (dto.active !== undefined) a.active = dto.active;
      return accDto(await repo.save(a));
    });
  }

  private async assertCategory(em: EntityManager, org: OrgContext, id: string | null | undefined, type: 'DESPESA' | 'RECEITA') {
    if (!id) return;
    const c = await em.getRepository(FinanceCategory).findOne({ where: { id, organizationId: org.organizationId } });
    if (!c || c.type !== type) throw new BadRequestException('Categoria inválida');
  }

  private async assertAccount(em: EntityManager, org: OrgContext, id: string) {
    const a = await em.getRepository(FinanceAccount).findOne({ where: { id, organizationId: org.organizationId } });
    if (!a) throw new BadRequestException('Conta inválida');
  }

  /** Conta escolhida (validada) ou, sem escolha, a principal. */
  private async accountFor(em: EntityManager, org: OrgContext, chosen?: string | null): Promise<string> {
    if (chosen) {
      await this.assertAccount(em, org, chosen);
      return chosen;
    }
    await this.seed(em, org);
    return (await em.getRepository(FinanceAccount).findOneOrFail({ where: { organizationId: org.organizationId }, order: { createdAt: 'ASC' } })).id;
  }

  // ---------------------------------------------------------------- contas a pagar

  private payableDto(p: Payable, today: string): PayableDto {
    return {
      id: p.id,
      description: p.description,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      amountCents: p.amountCents,
      dueDate: p.dueDate,
      paidDate: p.paidDate,
      paidMethod: p.paidMethod,
      accountId: p.accountId,
      accountName: p.account?.name ?? null,
      recurrenceId: p.recurrenceId,
      installment: p.installment,
      status: payableStatus(p, today),
      notes: p.notes,
    };
  }

  async listPayables(org: OrgContext, q: LedgerQueryDto): Promise<PayablesListDto> {
    return this.tenant.transaction(async (em) => {
      const today = await this.today(em, org);
      const qb = em
        .getRepository(Payable)
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.category', 'c')
        .leftJoinAndSelect('p.account', 'a')
        .where('p.organizationId = :org', { org: org.organizationId });
      if (q.from) qb.andWhere('p.dueDate >= :from', { from: q.from });
      if (q.to) qb.andWhere('p.dueDate <= :to', { to: q.to });
      if (q.status === 'PAGO') qb.andWhere('p.paidDate IS NOT NULL');
      else if (q.status === 'PENDENTE') qb.andWhere('p.paidDate IS NULL AND p.dueDate >= :today', { today });
      else if (q.status === 'ATRASADO') qb.andWhere('p.paidDate IS NULL AND p.dueDate < :today', { today });
      const rows = await qb.orderBy('p.dueDate', 'ASC').addOrderBy('p.createdAt', 'ASC').take(500).getMany();
      const items = rows.map((p) => this.payableDto(p, today));
      const sum = (s: string) => items.filter((i) => i.status === s).reduce((t, i) => t + i.amountCents, 0);
      return { items, totals: { pendingCents: sum('PENDENTE'), overdueCents: sum('ATRASADO'), paidCents: sum('PAGO') } };
    });
  }

  async createPayable(org: OrgContext, dto: CreatePayableDto): Promise<PayableDto[]> {
    return this.tenant.transaction(async (em) => {
      await this.assertCategory(em, org, dto.categoryId, 'DESPESA');
      const dates = dto.monthlyCount && dto.monthlyCount > 1 ? monthlyDates(dto.dueDate, dto.monthlyCount) : [dto.dueDate];
      const recurrenceId = dates.length > 1 ? randomUUID() : null;
      const repo = em.getRepository(Payable);
      const saved = await repo.save(
        dates.map((dueDate, k) =>
          repo.create({
            organizationId: org.organizationId,
            description: dto.description,
            categoryId: dto.categoryId ?? null,
            amountCents: dto.amountCents,
            dueDate,
            paidDate: null,
            paidMethod: null,
            accountId: null,
            recurrenceId,
            installment: recurrenceId ? k + 1 : null,
            notes: dto.notes ?? null,
            createdByMemberId: org.memberId,
          }),
        ),
      );
      return Promise.all(saved.map((p) => this.reloadPayable(em, org, p.id)));
    });
  }

  private async findPayable(em: EntityManager, org: OrgContext, id: string) {
    const p = await em.getRepository(Payable).findOne({ where: { id, organizationId: org.organizationId } });
    if (!p) throw new NotFoundException('Conta não encontrada');
    return p;
  }

  private async reloadPayable(em: EntityManager, org: OrgContext, id: string): Promise<PayableDto> {
    const p = await em.getRepository(Payable).findOneOrFail({ where: { id, organizationId: org.organizationId }, relations: { category: true, account: true } });
    return this.payableDto(p, await this.today(em, org));
  }

  async updatePayable(org: OrgContext, id: string, dto: UpdatePayableDto): Promise<PayableDto> {
    return this.tenant.transaction(async (em) => {
      const p = await this.findPayable(em, org, id);
      if (p.paidDate) throw new BadRequestException('Conta já paga. Desfaça o pagamento para editar.');
      if (dto.categoryId !== undefined) await this.assertCategory(em, org, dto.categoryId, 'DESPESA');
      if (dto.description !== undefined) p.description = dto.description;
      if (dto.categoryId !== undefined) p.categoryId = dto.categoryId ?? null;
      if (dto.amountCents !== undefined) p.amountCents = dto.amountCents;
      if (dto.dueDate !== undefined) p.dueDate = dto.dueDate;
      if (dto.notes !== undefined) p.notes = dto.notes ?? null;
      await em.getRepository(Payable).save(p);
      return this.reloadPayable(em, org, id);
    });
  }

  async settlePayable(org: OrgContext, id: string, dto: SettlePayableDto): Promise<PayableDto> {
    return this.tenant.transaction(async (em) => {
      const p = await this.findPayable(em, org, id);
      if (p.paidDate) throw new BadRequestException('Essa conta já está paga');
      if (dto.paidDate > (await this.today(em, org))) throw new BadRequestException('A data do pagamento não pode ser no futuro');
      const accountId = await this.accountFor(em, org, dto.accountId);
      await em.getRepository(Payable).update({ id: p.id, organizationId: org.organizationId }, { paidDate: dto.paidDate, paidMethod: dto.method, accountId });
      await this.audit.log(em, org, { action: 'PAYABLE_PAID', entity: 'payable', entityId: p.id, summary: `Conta "${p.description}" (${formatBRL(p.amountCents)}) paga em ${dto.paidDate}`, meta: { amountCents: p.amountCents, paidDate: dto.paidDate } });
      return this.reloadPayable(em, org, id);
    });
  }

  async reopenPayable(org: OrgContext, id: string): Promise<PayableDto> {
    return this.tenant.transaction(async (em) => {
      const p = await this.findPayable(em, org, id);
      if (!p.paidDate) throw new BadRequestException('Essa conta não está paga');
      await em.getRepository(Payable).update({ id: p.id, organizationId: org.organizationId }, { paidDate: null, paidMethod: null, accountId: null });
      await this.audit.log(em, org, { action: 'PAYABLE_REOPENED', entity: 'payable', entityId: p.id, summary: `Conta "${p.description}" (${formatBRL(p.amountCents)}) reaberta (estava paga em ${p.paidDate})`, meta: { amountCents: p.amountCents } });
      return this.reloadPayable(em, org, id);
    });
  }

  async removePayable(org: OrgContext, id: string, futuras: boolean): Promise<void> {
    await this.tenant.transaction(async (em) => {
      const p = await this.findPayable(em, org, id);
      const repo = em.getRepository(Payable);
      let count = 1;
      if (futuras && p.recurrenceId) {
        const res = await repo.delete({ organizationId: org.organizationId, recurrenceId: p.recurrenceId, paidDate: IsNull(), dueDate: Not(LessThan(p.dueDate)) });
        count = res.affected ?? 0;
      } else {
        await repo.delete({ id: p.id, organizationId: org.organizationId });
      }
      await this.audit.log(em, org, { action: 'PAYABLE_REMOVED', entity: 'payable', entityId: p.id, summary: `Conta "${p.description}" (${formatBRL(p.amountCents)}) apagada${count > 1 ? ` — e mais ${count - 1} das próximas` : ''}${p.paidDate ? ' (já estava paga)' : ''}`, meta: { amountCents: p.amountCents, count, wasPaid: !!p.paidDate } });
    });
  }

  // ---------------------------------------------------------------- contas a receber

  private receivableDto(r: Receivable, today: string): ReceivableDto {
    return {
      id: r.id,
      description: r.description,
      source: r.source,
      orderNumber: r.orderNumber,
      categoryId: r.categoryId,
      categoryName: r.category?.name ?? null,
      amountCents: r.amountCents,
      feeCents: r.feeCents,
      method: r.method,
      expectedDate: r.expectedDate,
      receivedDate: r.receivedDate,
      accountId: r.accountId,
      accountName: r.account?.name ?? null,
      status: receivableStatus(r, today),
      notes: r.notes,
    };
  }

  async listReceivables(org: OrgContext, q: LedgerQueryDto): Promise<ReceivablesListDto> {
    return this.tenant.transaction(async (em) => {
      const today = await this.today(em, org);
      const qb = em
        .getRepository(Receivable)
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.category', 'c')
        .leftJoinAndSelect('r.account', 'a')
        .where('r.organizationId = :org', { org: org.organizationId });
      if (q.from) qb.andWhere('r.expectedDate >= :from', { from: q.from });
      if (q.to) qb.andWhere('r.expectedDate <= :to', { to: q.to });
      if (q.status === 'RECEBIDO') qb.andWhere('r.receivedDate IS NOT NULL');
      else if (q.status === 'PENDENTE') qb.andWhere('r.receivedDate IS NULL AND r.expectedDate >= :today', { today });
      else if (q.status === 'ATRASADO') qb.andWhere('r.receivedDate IS NULL AND r.expectedDate < :today', { today });
      const rows = await qb.orderBy('r.expectedDate', 'ASC').addOrderBy('r.createdAt', 'ASC').take(500).getMany();
      const items = rows.map((r) => this.receivableDto(r, today));
      const sum = (s: string) => items.filter((i) => i.status === s).reduce((t, i) => t + i.amountCents, 0);
      return { items, totals: { pendingCents: sum('PENDENTE'), overdueCents: sum('ATRASADO'), receivedCents: sum('RECEBIDO') } };
    });
  }

  async createReceivable(org: OrgContext, dto: CreateReceivableDto): Promise<ReceivableDto> {
    return this.tenant.transaction(async (em) => {
      await this.assertCategory(em, org, dto.categoryId, 'RECEITA');
      const repo = em.getRepository(Receivable);
      const r = await repo.save(
        repo.create({
          organizationId: org.organizationId,
          description: dto.description,
          source: 'AVULSO',
          categoryId: dto.categoryId ?? null,
          amountCents: dto.amountCents,
          feeCents: 0,
          method: dto.method ?? null,
          expectedDate: dto.expectedDate,
          receivedDate: null,
          notes: dto.notes ?? null,
        }),
      );
      return this.reloadReceivable(em, org, r.id);
    });
  }

  private async findReceivable(em: EntityManager, org: OrgContext, id: string) {
    const r = await em.getRepository(Receivable).findOne({ where: { id, organizationId: org.organizationId } });
    if (!r) throw new NotFoundException('Recebível não encontrado');
    return r;
  }

  private async reloadReceivable(em: EntityManager, org: OrgContext, id: string): Promise<ReceivableDto> {
    const r = await em.getRepository(Receivable).findOneOrFail({ where: { id, organizationId: org.organizationId }, relations: { category: true, account: true } });
    return this.receivableDto(r, await this.today(em, org));
  }

  async updateReceivable(org: OrgContext, id: string, dto: UpdateReceivableDto): Promise<ReceivableDto> {
    return this.tenant.transaction(async (em) => {
      const r = await this.findReceivable(em, org, id);
      if (r.receivedDate) throw new BadRequestException('Já recebido. Desfaça a baixa para editar.');
      if (dto.categoryId !== undefined) await this.assertCategory(em, org, dto.categoryId, 'RECEITA');
      const patch: Partial<Receivable> = {};
      if (dto.description !== undefined && r.source === 'AVULSO') patch.description = dto.description;
      if (dto.categoryId !== undefined) patch.categoryId = dto.categoryId ?? null;
      if (dto.expectedDate !== undefined) patch.expectedDate = dto.expectedDate;
      if (dto.notes !== undefined) patch.notes = dto.notes ?? null;
      if (Object.keys(patch).length) await em.getRepository(Receivable).update({ id: r.id, organizationId: org.organizationId }, patch);
      return this.reloadReceivable(em, org, id);
    });
  }

  /** Baixa manual: o dinheiro caiu na conta. */
  async settleReceivable(org: OrgContext, id: string, dto: SettleReceivableDto): Promise<ReceivableDto> {
    return this.tenant.transaction(async (em) => {
      const r = await this.findReceivable(em, org, id);
      if (r.receivedDate) throw new BadRequestException('Esse valor já foi recebido');
      if (dto.receivedDate > (await this.today(em, org))) throw new BadRequestException('A data do recebimento não pode ser no futuro');
      const accountId = await this.accountFor(em, org, dto.accountId);
      await em.getRepository(Receivable).update({ id: r.id, organizationId: org.organizationId }, { receivedDate: dto.receivedDate, accountId });
      await this.audit.log(em, org, { action: 'RECEIVABLE_SETTLED', entity: 'receivable', entityId: r.id, summary: `"${r.description}" (${formatBRL(r.amountCents)}) dado como recebido em ${dto.receivedDate}`, meta: { amountCents: r.amountCents } });
      return this.reloadReceivable(em, org, id);
    });
  }

  async reopenReceivable(org: OrgContext, id: string): Promise<ReceivableDto> {
    return this.tenant.transaction(async (em) => {
      const r = await this.findReceivable(em, org, id);
      if (!r.receivedDate) throw new BadRequestException('Esse valor ainda não foi recebido');
      await em.getRepository(Receivable).update({ id: r.id, organizationId: org.organizationId }, { receivedDate: null, accountId: null });
      await this.audit.log(em, org, { action: 'RECEIVABLE_REOPENED', entity: 'receivable', entityId: r.id, summary: `"${r.description}" (${formatBRL(r.amountCents)}) reaberto (estava recebido em ${r.receivedDate})`, meta: { amountCents: r.amountCents } });
      return this.reloadReceivable(em, org, id);
    });
  }

  /** Só lançamentos avulsos podem ser apagados; os de comanda somem com o estorno do pagamento. */
  async removeReceivable(org: OrgContext, id: string): Promise<void> {
    await this.tenant.transaction(async (em) => {
      const r = await this.findReceivable(em, org, id);
      if (r.source !== 'AVULSO') throw new BadRequestException('Esse recebível vem de uma comanda. Estorne o pagamento na comanda.');
      await em.getRepository(Receivable).delete({ id: r.id, organizationId: org.organizationId });
      await this.audit.log(em, org, { action: 'RECEIVABLE_REMOVED', entity: 'receivable', entityId: r.id, summary: `Receita "${r.description}" (${formatBRL(r.amountCents)}) apagada${r.receivedDate ? ' (já estava recebida)' : ''}`, meta: { amountCents: r.amountCents, wasReceived: !!r.receivedDate } });
    });
  }

  /**
   * Chamado ao receber numa comanda: cria o recebível com a data prevista (pagamento + D+N).
   * Quem cai na hora (D+0: PIX, dinheiro) já nasce recebido.
   */
  async fromOrderPayment(
    em: EntityManager,
    p: {
      organizationId: string;
      paymentId: string;
      orderNumber: number;
      method: Receivable['method'];
      amountCents: number;
      feeCents: number;
      paidOn: string;
      expectedDate: string;
      label: string;
    },
  ) {
    await em.getRepository(Receivable).insert({
      organizationId: p.organizationId,
      description: p.label,
      source: 'COMANDA',
      orderPaymentId: p.paymentId,
      orderNumber: p.orderNumber,
      amountCents: Math.max(0, p.amountCents - p.feeCents),
      feeCents: p.feeCents,
      method: p.method,
      expectedDate: p.expectedDate,
      receivedDate: p.expectedDate <= p.paidOn ? p.paidOn : null,
    });
  }
}
