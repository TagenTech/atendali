import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import {
  OrderItemKind,
  OrderStatus,
  publicName,
  ratingSummary,
  type PublicReviewInfoDto,
  type ReviewDto,
  type ReviewRequestDto,
  type ReviewsDto,
} from '@agendei/contracts';
import { OrderItem } from '../financeiro/entities/order-item.entity';
import { Order } from '../financeiro/entities/order.entity';
import { Organization } from '../organizations/entities/organization.entity';
import type { OrgContext } from '../organizations/org-context';
import { TenantDb } from '../tenancy/tenant-db';
import { SubmitReviewDto } from './dto/retention.dto';
import { Review } from './entities/review.entity';

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

const toDto = (r: Review): ReviewDto => ({
  id: r.id,
  rating: r.rating!,
  comment: r.comment,
  clientName: publicName(r.clientName ?? ''),
  memberName: r.memberName,
  serviceName: r.serviceName,
  published: r.published,
  createdAt: (r.answeredAt ?? r.createdAt).toISOString(),
});

@Injectable()
export class ReviewsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly db: DataSource,
    private readonly config: ConfigService,
  ) {}

  /** Cria (ou renova) o link de avaliação de uma comanda paga. Só aparece o código agora — guarda-se o hash. */
  async request(org: OrgContext, orderId: string): Promise<ReviewRequestDto> {
    return this.tenant.transaction(async (em) => {
      const order = await em.getRepository(Order).findOne({ where: { id: orderId, organizationId: org.organizationId }, relations: { client: true } });
      if (!order) throw new NotFoundException('Comanda não encontrada');
      if (order.status !== OrderStatus.FECHADA) throw new BadRequestException('Peça a avaliação depois que a comanda estiver paga');
      if (!order.clientId) throw new BadRequestException('A comanda precisa de um cliente para pedir avaliação');
      const existing = await em.getRepository(Review).findOne({ where: { organizationId: org.organizationId, orderId } });
      if (existing?.answeredAt) throw new ConflictException('Este cliente já avaliou este atendimento');

      const items = await em.getRepository(OrderItem).find({ where: { orderId, organizationId: org.organizationId }, relations: { member: true }, order: { createdAt: 'ASC' } });
      const withMember = items.find((i) => i.member);
      const service = items.find((i) => i.kind === OrderItemKind.SERVICO || i.kind === OrderItemKind.SESSAO_PACOTE || i.kind === OrderItemKind.SESSAO_CLUBE);
      const token = randomBytes(24).toString('base64url');
      const row = existing ?? em.getRepository(Review).create({ organizationId: org.organizationId, orderId, published: true });
      Object.assign(row, {
        clientId: order.clientId,
        clientName: order.client?.name ?? null,
        memberId: withMember?.memberId ?? null,
        memberName: withMember?.member?.name ?? null,
        serviceName: (service ?? items[0])?.description ?? null,
        tokenHash: hash(token),
      });
      await em.getRepository(Review).save(row);
      const org2 = await em.getRepository(Organization).findOneOrFail({ where: { id: org.organizationId }, select: { id: true, name: true } });
      const path = `/avaliar/${token}`;
      const first = (order.client?.name ?? '').trim().split(/\s+/)[0];
      return {
        token,
        path,
        message: `Oi, ${first}! Como foi seu atendimento em ${org2.name}? Conta pra gente em 10 segundos: ${this.config.get<string>('publicWebUrl')}${path} 💜`,
      };
    });
  }

  async list(org: OrgContext): Promise<ReviewsDto> {
    return this.tenant.transaction(async (em) => {
      const rows = await em
        .getRepository(Review)
        .createQueryBuilder('r')
        .where('r.organizationId = :org AND r.answeredAt IS NOT NULL', { org: org.organizationId })
        .orderBy('r.answeredAt', 'DESC')
        .take(100)
        .getMany();
      return { summary: ratingSummary(rows.filter((r) => r.published).map((r) => r.rating!)), items: rows.map(toDto) };
    });
  }

  async setPublished(org: OrgContext, id: string, published: boolean): Promise<ReviewDto> {
    return this.tenant.transaction(async (em) => {
      const r = await em.getRepository(Review).findOne({ where: { id, organizationId: org.organizationId } });
      if (!r?.answeredAt) throw new NotFoundException('Avaliação não encontrada');
      r.published = published;
      return toDto(await em.getRepository(Review).save(r));
    });
  }

  // ---------------------------------------------------------------- público (sem login, só com o código)

  async info(token: string): Promise<PublicReviewInfoDto> {
    const r = await this.byToken(token);
    const org = await this.db.getRepository(Organization).findOneOrFail({ where: { id: r.organizationId }, select: { id: true, name: true } });
    return { organizationName: org.name, professionalName: r.memberName, serviceName: r.serviceName, answered: !!r.answeredAt };
  }

  async submit(token: string, dto: SubmitReviewDto): Promise<PublicReviewInfoDto> {
    const r = await this.byToken(token);
    if (r.answeredAt) throw new ConflictException('Você já enviou sua avaliação. Obrigado! 💜');
    // Atualização condicional: duas respostas simultâneas — só a primeira entra.
    const res = await this.db
      .getRepository(Review)
      .createQueryBuilder()
      .update()
      .set({ rating: dto.rating, comment: dto.comment ?? null, answeredAt: () => 'NOW()' })
      .where('id = :id AND answered_at IS NULL', { id: r.id })
      .execute();
    if (!res.affected) throw new ConflictException('Você já enviou sua avaliação. Obrigado! 💜');
    return this.info(token);
  }

  private async byToken(token: string): Promise<Review> {
    const r = await this.db.getRepository(Review).findOne({ where: { tokenHash: hash(String(token).slice(0, 100)) } });
    if (!r) throw new NotFoundException('Link de avaliação inválido');
    return r;
  }
}

