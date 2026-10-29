import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const agenda = vi.hoisted(() => ({ publicSlots: vi.fn() }));
vi.mock('@/lib/api/agenda', () => agenda);

import { renderWithQuery } from '@/test/render';
import { ReschedulePicker } from './reschedule-picker';

function show(props: Partial<React.ComponentProps<typeof ReschedulePicker>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  renderWithQuery(<ReschedulePicker slug="studio" serviceId="s1" timezone="America/Sao_Paulo" onConfirm={onConfirm} onCancel={onCancel} {...props} />);
  return { onConfirm, onCancel };
}
const confirmBtn = () => screen.getByRole('button', { name: 'Confirmar novo horário' }) as HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-28T15:00:00Z'));
  agenda.publicSlots.mockResolvedValue({ slots: [{ startsAt: '2026-10-29T13:00:00.000Z' }, { startsAt: '2026-10-29T13:30:00.000Z' }] });
});
afterEach(() => vi.useRealTimers());

describe('ReschedulePicker', () => {
  it('oferece 21 dias a partir de hoje e começa sem nada escolhido', () => {
    show();
    const days = screen.getAllByRole('button', { name: /^Novo dia / });
    expect(days).toHaveLength(21);
    expect(days[0].getAttribute('aria-label')).toBe('Novo dia 28/10');
    expect(days[0].textContent).toContain('hoje');
    expect(days[1].textContent).toContain('qui');
    expect(confirmBtn().disabled).toBe(true);
    expect(agenda.publicSlots).not.toHaveBeenCalled();
  });

  it('escolhe o dia, vê os horários no fuso da unidade, escolhe um e confirma', async () => {
    const { onConfirm } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Novo dia 29/10' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Novo horário 10:00' }));
    expect(agenda.publicSlots).toHaveBeenCalledWith('studio', { date: '2026-10-29', serviceId: 's1' });
    expect(screen.getByRole('button', { name: 'Novo horário 10:00' }).getAttribute('aria-pressed')).toBe('true');
    expect(confirmBtn().disabled).toBe(false);
    fireEvent.click(confirmBtn());
    expect(onConfirm).toHaveBeenCalledWith('2026-10-29T13:00:00.000Z');
  });

  it('trocar de dia limpa o horário escolhido', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Novo dia 29/10' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Novo horário 10:30' }));
    expect(confirmBtn().disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Novo dia 30/10' }));
    expect(confirmBtn().disabled).toBe(true);
  });

  it('dia sem vaga avisa', async () => {
    agenda.publicSlots.mockResolvedValue({ slots: [] });
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Novo dia 29/10' }));
    expect(await screen.findByText(/Sem horários livres nesse dia/)).toBeTruthy();
  });

  it('enquanto carrega mostra o esqueleto', async () => {
    agenda.publicSlots.mockReturnValue(new Promise(() => undefined));
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Novo dia 29/10' }));
    await waitFor(() => expect(document.querySelector('.animate-pulse')).toBeTruthy());
  });

  it('o botão de carregando trava a confirmação e "Voltar" cancela', async () => {
    const { onCancel } = show({ loading: true });
    expect(confirmBtn().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
