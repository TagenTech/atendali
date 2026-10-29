import type { Permission, Role } from './access';
import type { CommissionBase, PaymentMethodConfig } from './finance';
import type { LoyaltyRule } from './retention';
import type { BusinessHours } from './business-hours';
import type { Feature, SampleService, Segment, Vocabulary } from './segments';

/** Status da pessoa na equipe. SEM_ACESSO = só aparece na agenda (ex.: manicure sem e-mail). */
export const MemberStatus = {
  ATIVO: 'ATIVO',
  CONVIDADO: 'CONVIDADO',
  SEM_ACESSO: 'SEM_ACESSO',
} as const;
export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus];

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  ATIVO: 'Ativo',
  CONVIDADO: 'Convite enviado',
  SEM_ACESSO: 'Sem acesso ao app',
};

/** Cor do profissional na agenda: índice nos tokens `--pro-1…8` do web. */
export const MEMBER_COLOR_COUNT = 8;

/** Header que o web envia com o negócio ativo. */
export const ORG_HEADER = 'x-organization-id';

export interface OrganizationSummaryDto {
  id: string;
  name: string;
  slug: string;
  segment: Segment;
  role: Role;
}

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  segment: Segment;
  features: Feature[];
  vocabulary: Vocabulary;
  phone: string | null;
  /** CNPJ ou CPF (só dígitos). */
  document: string | null;
  timezone: string;
  /** Formas de pagamento aceitas, com taxa e prazo. */
  paymentMethods: PaymentMethodConfig[];
  /** Comissão sobre o valor do serviço (BRUTO) ou descontando taxas de pagamento (LIQUIDO). */
  commissionBase: CommissionBase;
  /** Regras do programa de fidelidade (vale quando o módulo está ligado). */
  loyalty: LoyaltyRule;
  /** Lembretes por e-mail 24 h e 2 h antes (para quem deixou e-mail). */
  remindersEnabled: boolean;
  /** Logo, fundo, cor e frase da página pública. */
  branding: import('./branding').BrandingDto;
  createdAt: string;
  /** Quem está vendo: perfil, permissões e o próprio cadastro na equipe. */
  me: { memberId: string; role: Role; permissions: Permission[] };
}

export interface UnitInput {
  name: string;
  phone?: string | null;
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  timezone?: string;
  businessHours: BusinessHours;
}

export interface UnitDto extends Required<Omit<UnitInput, 'timezone'>> {
  id: string;
  timezone: string;
  active: boolean;
}

export type UpdateUnitRequest = Partial<UnitInput> & { active?: boolean };

export interface MemberDto {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  status: MemberStatus;
  /** Atende clientes (aparece como coluna na agenda)? */
  bookable: boolean;
  color: number;
  /** Horário próprio (null = segue o da unidade). */
  workingHours: BusinessHours | null;
  /** Comissão padrão (bps) — o serviço pode ter a própria. */
  commissionBps: number | null;
  isMe: boolean;
  invitedAt: string | null;
  joinedAt: string | null;
}

export interface CreateMemberRequest {
  name: string;
  /** Com e-mail: convite para entrar no app. Sem e-mail: só aparece na agenda (perfil Profissional). */
  email?: string | null;
  phone?: string | null;
  role: Role;
  bookable: boolean;
  color?: number;
  /** null = segue o horário da unidade. */
  workingHours?: BusinessHours | null;
  commissionBps?: number | null;
}

export type UpdateMemberRequest = Partial<CreateMemberRequest>;

export interface ServiceDto {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  durationMinutes: number;
  /** Centavos. */
  priceCents: number;
  /** Aparece no agendamento online? */
  onlineBooking: boolean;
  /** Comissão deste serviço (bps). null = usa a do profissional. */
  commissionBps: number | null;
  active: boolean;
}

export interface ServiceInput {
  name: string;
  category?: string | null;
  description?: string | null;
  durationMinutes: number;
  priceCents: number;
  onlineBooking?: boolean;
  commissionBps?: number | null;
}

export type UpdateServiceRequest = Partial<ServiceInput> & { active?: boolean };

/** Onboarding: cria negócio, primeira unidade, o dono na equipe e os serviços escolhidos de uma vez. */
export interface CreateOrganizationRequest {
  name: string;
  segment: Segment;
  /** Se omitido, usa os módulos padrão do segmento. */
  features?: Feature[];
  phone?: string | null;
  unit: UnitInput;
  services: SampleService[];
  /** O dono também atende clientes? */
  ownerBookable: boolean;
  /** Pessoas da equipe já no cadastro (opcional). */
  team?: CreateMemberRequest[];
}

export interface UpdateOrganizationRequest {
  name?: string;
  phone?: string | null;
  document?: string | null;
  features?: Feature[];
  paymentMethods?: PaymentMethodConfig[];
  commissionBase?: CommissionBase;
  loyalty?: LoyaltyRule;
  remindersEnabled?: boolean;
  brandColor?: import('./branding').BrandColorValue | null;
  tagline?: string | null;
}

/** O que a tela de convite mostra antes de aceitar. */
export interface InviteInfoDto {
  organizationName: string;
  segment: Segment;
  role: Role;
  /** E-mail convidado, mascarado (pa***@gmail.com). */
  email: string;
}

export interface AcceptInviteRequest {
  token: string;
}

/** "Ana Paula Souza" → "AS" (avatar da equipe e da conta). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
