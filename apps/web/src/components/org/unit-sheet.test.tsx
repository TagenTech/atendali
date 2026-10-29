import { defaultBusinessHours, type UnitDto } from '@skedulei/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/sheet', () => import('@/test/sheet-stub'));
const org = vi.hoisted(() => ({ useSaveUnit: vi.fn() }));
vi.mock('@/lib/queries/org', () => org);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { UFS, UnitSheet } from './unit-sheet';

const unit = {
  id: 'u1',
  name: 'Centro',
  phone: '1133334444',
  street: 'Rua A',
  number: '10',
  district: 'Sé',
  city: 'São Paulo',
  state: 'SP',
  businessHours: defaultBusinessHours(),
} as UnitDto;
let save: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };

function show(u: UnitDto | null = null) {
  const onOpenChange = vi.fn();
  render(<UnitSheet open onOpenChange={onOpenChange} unit={u} />);
  return onOpenChange;
}
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

beforeEach(() => {
  vi.clearAllMocks();
  save = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  org.useSaveUnit.mockImplementation(() => save);
});

describe('UnitSheet', () => {
  it('exporta as 27 UFs', () => {
    expect(UFS).toHaveLength(27);
  });

  it('nova unidade: exige o nome', () => {
    show();
    expect(screen.getByRole('dialog', { name: 'Nova unidade' })).toBeTruthy();
    send();
    expect(screen.getByRole('alert').textContent).toBe('Dê um nome para a unidade');
    expect(save.mutateAsync).not.toHaveBeenCalled();
  });

  it('cria só com o nome: o resto vai vazio, com o horário padrão', async () => {
    const onOpenChange = show();
    type('Nome da unidade', '  Shopping ');
    send();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(save.mutateAsync).toHaveBeenCalledWith({
      id: undefined,
      body: { name: 'Shopping', phone: null, street: null, number: null, district: null, city: null, state: null, businessHours: defaultBusinessHours() },
    });
    expect(toast.success).toHaveBeenCalledWith('Unidade criada');
  });

  it('cria com endereço completo', async () => {
    show();
    type('Nome da unidade', 'Norte');
    type('Telefone', '(11) 98888-7777');
    type('Rua', ' Av. B ');
    type('Número', ' 99 ');
    type('Bairro', ' Centro ');
    type('Cidade', ' Campinas ');
    type('UF', 'SP');
    send();
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalled());
    expect(save.mutateAsync.mock.calls[0][0].body).toMatchObject({ phone: '11988887777', street: 'Av. B', number: '99', district: 'Centro', city: 'Campinas', state: 'SP' });
  });

  it('editar: título é o nome da unidade, vem preenchida e salva pelo id', async () => {
    show(unit);
    expect(screen.getByRole('dialog', { name: 'Centro' })).toBeTruthy();
    expect((screen.getByLabelText('Rua') as HTMLInputElement).value).toBe('Rua A');
    expect((screen.getByLabelText('UF') as HTMLSelectElement).value).toBe('SP');
    send();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Unidade atualizada'));
    expect(save.mutateAsync.mock.calls[0][0].id).toBe('u1');
  });

  it('recusa horário de funcionamento inválido', () => {
    show(unit);
    fireEvent.change(screen.getByLabelText('Segunda: fim da faixa 1'), { target: { value: '08:00' } });
    send();
    expect(screen.getByRole('alert').textContent).toMatch(/Segunda: o fim precisa ser depois do início/);
    expect(save.mutateAsync).not.toHaveBeenCalled();
  });

  it('erro da API vira aviso', async () => {
    save.mutateAsync.mockRejectedValue(new ApiError(403, 'x', ['Seu plano não permite mais unidades']));
    const onOpenChange = show(unit);
    send();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Seu plano não permite mais unidades'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
