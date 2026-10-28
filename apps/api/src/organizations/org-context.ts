import {
  applyDecorators,
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiHeader } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { can, MemberStatus, ORG_HEADER, type Permission, type Role } from '@agendei/contracts';
import type { JwtPayload } from '../common/types/jwt-payload';
import { Member } from './entities/member.entity';

/** Negócio ativo da requisição + quem está agindo nele. */
export interface OrgContext {
  organizationId: string;
  memberId: string;
  role: Role;
}

const ORG_ROUTE_KEY = 'orgRoute';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Rota dentro de um negócio: exige o header `x-organization-id`, cadastro ATIVO na equipe
 * e todas as permissões listadas. Toda consulta da rota deve filtrar por `org.organizationId`.
 */
export const OrgRoute = (...permissions: Permission[]) =>
  applyDecorators(
    SetMetadata(ORG_ROUTE_KEY, permissions),
    ApiHeader({ name: ORG_HEADER, required: true, description: 'Negócio ativo' }),
  );

export const CurrentOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OrgContext => ctx.switchToHttp().getRequest().org,
);

/** Guard global (depois do JWT): só age em rotas marcadas com @OrgRoute. */
@Injectable()
export class OrgGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Member) private readonly members: Repository<Member>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(ORG_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload; org?: OrgContext }>();
    const orgId = req.headers[ORG_HEADER];
    if (typeof orgId !== 'string' || !UUID.test(orgId) || !req.user) {
      throw new ForbiddenException('Escolha um negócio para continuar');
    }
    const member = await this.members.findOne({
      where: { organizationId: orgId, userId: req.user.sub, status: MemberStatus.ATIVO },
      select: { id: true, role: true },
    });
    // Mesma mensagem para "não existe" e "não é seu": não revela negócios de outros.
    if (!member) throw new ForbiddenException('Você não tem acesso a este negócio');
    if (!required.every((p) => can(member.role, p))) {
      throw new ForbiddenException('Seu perfil de acesso não permite esta ação');
    }
    req.org = { organizationId: orgId, memberId: member.id, role: member.role };
    return true;
  }
}
