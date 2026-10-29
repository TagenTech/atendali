import { defaultBusinessHours, type MemberDto } from '@skedulei/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/sheet', () => import('@/test/sheet-stub'));
vi.mock('@/lib/org', () => import('@/test/org-stub'));
const q = vi.hoisted(() => ({ useSaveMember: vi.fn(), useRemoveMember: vi.fn(), useResendInvite: vi.fn(), useUnits: vi.fn() }));
vi.mock('@/lib/queries/org', () => q);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { orgState, resetOrg } from '@/test/org-stub';
import { MemberSheet, memberColor } from './member-sheet';

const member = (over: Partial<MemberDto> = {}): MemberDto =>
  ({
    id: 'mb1',
    name: 'Bia',
    email: 'bia@x.com',
    phone: '11999998888',
    role: 'PROFISSIONAL',
    status: 'ATIVO',
    bookable: true,
    color: 3,
    commissionBps: 4000,
    workingHours: null,
    isMe: false,
    ...over,
  }) as MemberDto;

let save: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
let remove: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
let resend: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };

function show(m: MemberDto | null = null) {
  const onOpenChange = vi.fn();
  render(<MemberSheet open onOpenChange={onOpenChange} member={m} />);
  return onOpenChange;
}
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
const alerts = () => screen.queryAllByRole('alert').map((a) => a.textContent);
const role = (name: RegExp | string) => screen.getByRole('radio', { name });

beforeEach(() => {
  vi.clearAllMocks();
  resetOrg();
  orgState.org = { ...orgState.org, me: { memberId: 'm0', role: 'DONO' } };
  save = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  remove = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  resend = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  q.useSaveMember.mockImplementation(() => save);
  q.useRemoveMember.mockImplementation(() => remove);
  q.useResendInvite.mockImplementation(() => resend);
  q.useUnits.mockReturnValue({ data: [{ businessHours: defaultBusinessHours() }] });
});

describe('memberColor', () => {
  it('usa os tokens da cor escolhida', () => {
    expect(memberColor(2)).toEqual({ background: 'var(--pro-2)', color: 'var(--pro-2-fg)' });
  });
});

describe('MemberSheet: nova pessoa', () => {
  it('exige o nome; sem e-mail só dá para ser profissional', () => {
    show();
    expect(screen.getByRole('dialog', { name: 'Adicionar à equipe' })).toBeTruthy();
    send();
    expect(alerts()).toEqual(['Informe o nome']);
    expect((role(/Recepção/) as HTMLButtonElement).disabled).toBe(true);
    expect((role(/Profissional/) as HTMLButtonElement).disabled).toBe(false);
    // sem e-mail não há "atende clientes": a pessoa já aparece na agenda
    expect(screen.queryByRole('switch', { name: /Atende clientes/ })).toBeNull();
  });

  it('com e-mail libera os perfis e convida', async () => {
    const onOpenChange = show();
    type('Nome', ' Carla ');
    type('E-mail', ' carla@x.com ');
    fireEvent.click(role(/Recepção/));
    send();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(save.mutateAsync).toHaveBeenCalledWith({
      id: undefined,
      body: { name: 'Carla', email: 'carla@x.com', phone: null, role: 'RECEPCAO', bookable: true, color: 1, workingHours: null, commissionBps: null },
    });
    expect(toast.success).toHaveBeenCalledWith('Convite enviado para carla@x.com 💌');
  });

  it('adicionar sem e-mail como profissional: sem convite', async () => {
    show();
    type('Nome', 'Dani');
    send();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Pessoa adicionada à equipe'));
    expect(save.mutateAsync.mock.calls[0][0].body).toMatchObject({ email: null, role: 'PROFISSIONAL', bookable: true });
  });

  it('recusa e-mail inválido', () => {
    show();
    type('Nome', 'Dani');
    type('E-mail', 'dani@');
    send();
    expect(alerts()).toEqual(['E-mail inválido']);
  });

  it('perfil que não é profissional exige e-mail', () => {
    show();
    type('Nome', 'Dani');
    type('E-mail', 'dani@x.com');
    fireEvent.click(role(/Financeiro/));
    type('E-mail', '');
    send();
    // o perfil volta a estar bloqueado, mas ainda marcado: a API também recusaria
    expect(alerts()).toEqual(['Para dar esse acesso, informe o e-mail da pessoa']);
  });

  it('escolhe a cor e a comissão; celular normalizado', async () => {
    show();
    type('Nome', 'Eva');
    type('Celular (opcional)', '(11) 98888-7777');
    fireEvent.click(screen.getByRole('button', { name: 'Cor 5' }));
    expect(screen.getByRole('button', { name: 'Cor 5' }).getAttribute('aria-pressed')).toBe('true');
    type('Comissão padrão', '40');
    send();
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalled());
    expect(save.mutateAsync.mock.calls[0][0].body).toMatchObject({ phone: '11988887777', color: 5, commissionBps: 4000 });
  });

  it('horário próprio: copia o da unidade, valida e salva', async () => {
    show();
    type('Nome', 'Eva');
    fireEvent.click(screen.getByRole('switch', { name: /Horário próprio/ }));
    expect(screen.getByLabelText('Segunda: início da faixa 1')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Segunda: fim da faixa 1'), { target: { value: '08:00' } });
    send();
    expect(alerts()).toEqual(['Segunda: o fim precisa ser depois do início']);
    fireEvent.change(screen.getByLabelText('Segunda: fim da faixa 1'), { target: { value: '12:00' } });
    send();
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalled());
    expect(save.mutateAsync.mock.calls[0][0].body.workingHours[1]).toEqual([{ start: '09:00', end: '12:00' }]);
    // desligar volta a seguir a unidade
  });

  it('sem unidade carregada, o horário próprio parte do padrão; desligar apaga', async () => {
    q.useUnits.mockReturnValue({ data: undefined });
    show();
    type('Nome', 'Eva');
    const sw = () => screen.getByRole('switch', { name: /Horário próprio/ });
    fireEvent.click(sw());
    expect(sw().getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw());
    send();
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalled());
    expect(save.mutateAsync.mock.calls[0][0].body.workingHours).toBeNull();
  });

  it('quem não atende clientes não tem comissão nem horário próprio', () => {
    show();
    type('E-mail', 'x@x.com');
    fireEvent.click(screen.getByRole('switch', { name: /Atende clientes/ }));
    expect(screen.queryByLabelText('Comissão padrão')).toBeNull();
    expect(screen.queryByRole('switch', { name: /Horário próprio/ })).toBeNull();
  });

  it('erro da API vira aviso', async () => {
    save.mutateAsync.mockRejectedValue(new ApiError(409, 'x', ['Esse e-mail já está na equipe']));
    const onOpenChange = show();
    type('Nome', 'Eva');
    send();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Esse e-mail já está na equipe'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('MemberSheet: pessoa existente', () => {
  it('com acesso: e-mail travado, não reenvia convite, salva sem e-mail', async () => {
    show(member());
    expect(screen.getByRole('dialog', { name: 'Bia' })).toBeTruthy();
    expect((screen.getByLabelText('E-mail') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Reenviar convite/ })).toBeNull();
    send();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Alterações salvas'));
    expect(save.mutateAsync.mock.calls[0][0].id).toBe('mb1');
    expect(save.mutateAsync.mock.calls[0][0].body).not.toHaveProperty('email');
  });

  it('convidado: pode reenviar o convite e trocar o e-mail (novo convite)', async () => {
    show(member({ status: 'CONVIDADO' as never, email: 'bia@x.com' }));
    fireEvent.click(screen.getByRole('button', { name: /Reenviar convite/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Convite reenviado'));
    expect(resend.mutateAsync).toHaveBeenCalledWith('mb1');
    type('E-mail', 'nova@x.com');
    send();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Convite enviado para nova@x.com 💌'));
  });

  it('convidado: mesmo e-mail não conta como novo convite', async () => {
    show(member({ status: 'CONVIDADO' as never }));
    send();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Alterações salvas'));
  });

  it('erro ao reenviar vira aviso', async () => {
    resend.mutateAsync.mockRejectedValue(new ApiError(429, 'x', ['Espere um pouco']));
    show(member({ status: 'CONVIDADO' as never }));
    fireEvent.click(screen.getByRole('button', { name: /Reenviar convite/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Espere um pouco'));
  });

  it('remover pede confirmação antes', async () => {
    const onOpenChange = show(member());
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(remove.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar remoção' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(remove.mutateAsync).toHaveBeenCalledWith('mb1');
    expect(toast.success).toHaveBeenCalledWith('Bia saiu da equipe');
  });

  it('erro ao remover vira aviso', async () => {
    remove.mutateAsync.mockRejectedValue(new ApiError(409, 'x', ['Tem agenda marcada']));
    show(member());
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar remoção' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Tem agenda marcada'));
  });

  it('não dá para remover a si mesmo, nem quem o seu perfil não administra', () => {
    const a = render(<MemberSheet open onOpenChange={vi.fn()} member={member({ isMe: true })} />);
    expect(screen.queryByRole('button', { name: 'Remover' })).toBeNull();
    a.unmount();
    orgState.org = { ...orgState.org, me: { memberId: 'm0', role: 'GERENTE' } };
    render(<MemberSheet open onOpenChange={vi.fn()} member={member({ role: 'GERENTE' as never })} />);
    expect(screen.queryByRole('button', { name: 'Remover' })).toBeNull();
  });

  it('gerente só atribui perfis que pode, mas vê o atual da pessoa', () => {
    orgState.org = { ...orgState.org, me: { memberId: 'm0', role: 'GERENTE' } };
    show(member({ role: 'GERENTE' as never }));
    expect((role(/Gerente/) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('radio', { name: /Dono/ })).toBeNull();
    expect((role(/Recepção/) as HTMLButtonElement).disabled).toBe(false);
  });

  it('pessoa sem e-mail e sem acesso já é profissional de agenda', () => {
    show(member({ status: 'SEM_ACESSO' as never, email: null as never }));
    expect(screen.queryByRole('switch', { name: /Atende clientes/ })).toBeNull();
    expect((role(/Recepção/) as HTMLButtonElement).disabled).toBe(true);
  });

  it('abre com o horário próprio ligado quando a pessoa já tem', () => {
    show(member({ workingHours: defaultBusinessHours() }));
    expect(screen.getByRole('switch', { name: /Horário próprio/ }).getAttribute('aria-checked')).toBe('true');
  });
});
