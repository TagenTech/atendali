/**
 * Perfis de acesso (RBAC) — a mesma tabela decide o que a API permite e o que o web mostra.
 * Cada pessoa tem um perfil por negócio (a mesma conta pode ser dona de um salão e profissional em outro).
 */

export const Role = {
  DONO: 'DONO',
  GERENTE: 'GERENTE',
  RECEPCAO: 'RECEPCAO',
  PROFISSIONAL: 'PROFISSIONAL',
  FINANCEIRO: 'FINANCEIRO',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ROLES = Object.values(Role);

export const ROLE_INFO: Record<Role, { label: string; description: string }> = {
  DONO: { label: 'Dono(a)', description: 'Acesso total, inclusive assinatura e exclusão do negócio.' },
  GERENTE: { label: 'Gerente', description: 'Administra equipe, serviços, agenda e relatórios.' },
  RECEPCAO: { label: 'Recepção', description: 'Agenda de todos, clientes e caixa. Não vê prontuário nem resultado.' },
  PROFISSIONAL: { label: 'Profissional', description: 'A própria agenda, seus clientes e suas comissões.' },
  FINANCEIRO: { label: 'Financeiro', description: 'Contas, caixa e relatórios financeiros.' },
};

export const Permission = {
  ORG_MANAGE: 'org.manage',
  ORG_DELETE: 'org.delete',
  UNITS_MANAGE: 'units.manage',
  TEAM_VIEW: 'team.view',
  TEAM_MANAGE: 'team.manage',
  SERVICES_VIEW: 'services.view',
  SERVICES_MANAGE: 'services.manage',
  AGENDA_VIEW_ALL: 'agenda.view_all',
  AGENDA_MANAGE_ALL: 'agenda.manage_all',
  AGENDA_OWN: 'agenda.own',
  CLIENTS_VIEW: 'clients.view',
  CLIENTS_MANAGE: 'clients.manage',
  CASH_OPERATE: 'cash.operate',
  FINANCE_VIEW: 'finance.view',
  FINANCE_MANAGE: 'finance.manage',
  REPORTS_VIEW: 'reports.view',
  COMMISSIONS_OWN: 'commissions.own',
  CLINICAL_RECORDS: 'clinical.records',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const P = Permission;
const ALL = Object.values(P);

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  DONO: ALL,
  GERENTE: ALL.filter((p) => p !== P.ORG_DELETE && p !== P.CLINICAL_RECORDS),
  RECEPCAO: [
    P.TEAM_VIEW,
    P.SERVICES_VIEW,
    P.AGENDA_VIEW_ALL,
    P.AGENDA_MANAGE_ALL,
    P.AGENDA_OWN,
    P.CLIENTS_VIEW,
    P.CLIENTS_MANAGE,
    P.CASH_OPERATE,
  ],
  PROFISSIONAL: [P.SERVICES_VIEW, P.AGENDA_OWN, P.CLIENTS_VIEW, P.COMMISSIONS_OWN, P.CLINICAL_RECORDS],
  FINANCEIRO: [P.TEAM_VIEW, P.SERVICES_VIEW, P.CLIENTS_VIEW, P.CASH_OPERATE, P.FINANCE_VIEW, P.FINANCE_MANAGE, P.REPORTS_VIEW],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsOf(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

/**
 * Quem pode dar (ou tirar) um perfil: só o dono mexe em outro dono;
 * gerente gerencia os demais perfis, menos dono e gerente.
 */
export function canAssignRole(actor: Role, target: Role): boolean {
  if (actor === Role.DONO) return true;
  if (actor === Role.GERENTE) return target !== Role.DONO && target !== Role.GERENTE;
  return false;
}
