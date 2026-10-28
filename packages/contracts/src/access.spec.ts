import { can, canAssignRole, Permission as P, Role, ROLE_PERMISSIONS } from './access';

describe('perfis de acesso', () => {
  it('dono pode tudo', () => {
    for (const p of Object.values(P)) expect(can(Role.DONO, p)).toBe(true);
  });

  it('recepção opera a agenda mas não vê financeiro nem prontuário', () => {
    expect(can(Role.RECEPCAO, P.AGENDA_MANAGE_ALL)).toBe(true);
    expect(can(Role.RECEPCAO, P.CASH_OPERATE)).toBe(true);
    expect(can(Role.RECEPCAO, P.FINANCE_VIEW)).toBe(false);
    expect(can(Role.RECEPCAO, P.CLINICAL_RECORDS)).toBe(false);
    expect(can(Role.RECEPCAO, P.TEAM_MANAGE)).toBe(false);
  });

  it('profissional só vê a própria agenda e as próprias comissões', () => {
    expect(can(Role.PROFISSIONAL, P.AGENDA_OWN)).toBe(true);
    expect(can(Role.PROFISSIONAL, P.AGENDA_VIEW_ALL)).toBe(false);
    expect(can(Role.PROFISSIONAL, P.COMMISSIONS_OWN)).toBe(true);
    expect(can(Role.PROFISSIONAL, P.REPORTS_VIEW)).toBe(false);
  });

  it('gerente não exclui o negócio nem abre prontuário', () => {
    expect(can(Role.GERENTE, P.TEAM_MANAGE)).toBe(true);
    expect(can(Role.GERENTE, P.ORG_DELETE)).toBe(false);
    expect(can(Role.GERENTE, P.CLINICAL_RECORDS)).toBe(false);
    expect(can(Role.GERENTE, P.AUDIT_VIEW)).toBe(false);
    for (const r of [Role.RECEPCAO, Role.PROFISSIONAL, Role.FINANCEIRO]) expect(can(r, P.AUDIT_VIEW)).toBe(false);
    expect(can(Role.DONO, P.AUDIT_VIEW)).toBe(true);
  });

  it('nenhum perfil tem permissão repetida', () => {
    for (const list of Object.values(ROLE_PERMISSIONS)) expect(new Set(list).size).toBe(list.length);
  });

  it('quem pode dar cada perfil', () => {
    expect(canAssignRole(Role.DONO, Role.DONO)).toBe(true);
    expect(canAssignRole(Role.GERENTE, Role.RECEPCAO)).toBe(true);
    expect(canAssignRole(Role.GERENTE, Role.GERENTE)).toBe(false);
    expect(canAssignRole(Role.GERENTE, Role.DONO)).toBe(false);
    expect(canAssignRole(Role.RECEPCAO, Role.PROFISSIONAL)).toBe(false);
  });
});
