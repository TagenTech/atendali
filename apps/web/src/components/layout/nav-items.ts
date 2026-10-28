import { Feature, Permission, type Vocabulary } from '@skedulei/contracts';
import { Boxes, CalendarDays, ChartPie, ShieldCheck, ChartNoAxesCombined, ContactRound, Gift, HandCoins, House, Monitor, Scissors, Settings2, Star, UsersRound, Wallet, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Aparece para quem tem qualquer uma dessas permissões (vazio = todos). */
  anyOf?: Permission[];
  /** Só aparece com algum desses módulos ligados (vazio = sempre). */
  features?: Feature[];
}

export const canSee = (i: NavItem, can: (p: Permission) => boolean, has: (f: Feature) => boolean) =>
  (!i.anyOf?.length || i.anyOf.some(can)) && (!i.features?.length || i.features.some(has));

/** Itens do menu; os rótulos seguem o vocabulário do segmento ("Serviços" × "Procedimentos"). */
export function navItems(vocab: Vocabulary): NavItem[] {
  return [
    { href: '/inicio', label: 'Início', icon: House },
    { href: '/agenda', label: 'Agenda', icon: CalendarDays, anyOf: [Permission.AGENDA_OWN] },
    { href: '/clientes', label: vocab.clients, icon: ContactRound, anyOf: [Permission.CLIENTS_VIEW] },
    { href: '/caixa', label: 'Caixa', icon: Wallet, anyOf: [Permission.CASH_OPERATE] },
    { href: '/financeiro', label: 'Financeiro', icon: ChartNoAxesCombined, anyOf: [Permission.FINANCE_VIEW] },
    { href: '/relatorios', label: 'Relatórios', icon: ChartPie, anyOf: [Permission.REPORTS_VIEW] },
    { href: '/comissoes', label: 'Comissões', icon: HandCoins, anyOf: [Permission.FINANCE_VIEW, Permission.COMMISSIONS_OWN] },
    { href: '/servicos', label: vocab.services, icon: Scissors, anyOf: [Permission.SERVICES_VIEW] },
    { href: '/estoque', label: 'Estoque', icon: Boxes, anyOf: [Permission.SERVICES_VIEW], features: [Feature.ESTOQUE] },
    {
      href: '/fidelidade',
      label: 'Pacotes e clube',
      icon: Gift,
      anyOf: [Permission.SERVICES_VIEW],
      features: [Feature.PACOTES, Feature.ASSINATURAS, Feature.VALES, Feature.FIDELIDADE],
    },
    { href: '/tv', label: 'Painel de TV', icon: Monitor, anyOf: [Permission.AGENDA_VIEW_ALL] },
    { href: '/avaliacoes', label: 'Avaliações', icon: Star, anyOf: [Permission.CLIENTS_VIEW] },
    { href: '/atividade', label: 'Atividade', icon: ShieldCheck, anyOf: [Permission.AUDIT_VIEW] },
    { href: '/equipe', label: 'Equipe', icon: UsersRound, anyOf: [Permission.TEAM_VIEW] },
    { href: '/configuracoes', label: 'Negócio', icon: Settings2, anyOf: [Permission.ORG_MANAGE] },
  ];
}

/** No celular cabem 4 + "Mais": serviços, equipe e negócio ficam dentro de "Mais". */
export const MOBILE_HREFS = ['/inicio', '/agenda', '/clientes'];

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
