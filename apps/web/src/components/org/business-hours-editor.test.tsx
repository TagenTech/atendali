import { defaultBusinessHours, type BusinessHours } from '@skedulei/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { BusinessHoursEditor } from './business-hours-editor';

function Harness({ initial }: { initial?: BusinessHours }) {
  const [v, setV] = React.useState<BusinessHours>(initial ?? defaultBusinessHours());
  return (
    <>
      <BusinessHoursEditor value={v} onChange={setV} />
      <output data-testid="v">{JSON.stringify(v)}</output>
    </>
  );
}
const value = (): BusinessHours => JSON.parse(screen.getByTestId('v').textContent!);
const time = (label: string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });

describe('BusinessHoursEditor', () => {
  it('semana começa na segunda; domingo fechado no padrão', () => {
    render(<Harness />);
    const labels = screen.getAllByRole('switch').map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Segunda: aberto', 'Terça: aberto', 'Quarta: aberto', 'Quinta: aberto', 'Sexta: aberto', 'Sábado: aberto', 'Domingo: fechado']);
    expect(screen.getByText('Fechado')).toBeTruthy();
  });

  it('abrir um dia dá 09h às 18h; fechar tira as faixas', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('switch', { name: 'Domingo: fechado' }));
    expect(value()[0]).toEqual([{ start: '09:00', end: '18:00' }]);
    fireEvent.click(screen.getByRole('switch', { name: 'Domingo: aberto' }));
    expect(value()[0]).toEqual([]);
  });

  it('muda início e fim de uma faixa', () => {
    render(<Harness />);
    time('Terça: início da faixa 1', '08:30');
    time('Terça: fim da faixa 1', '17:00');
    expect(value()[2]).toEqual([{ start: '08:30', end: '17:00' }]);
    expect(value()[3]).toEqual([{ start: '09:00', end: '19:00' }]);
  });

  it('adiciona uma segunda faixa depois da primeira (almoço) e remove', () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: 'Remover faixa' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar faixa em Quarta' }));
    expect(value()[3]).toEqual([
      { start: '09:00', end: '19:00' },
      { start: '19:00', end: '20:00' },
    ]);
    time('Quarta: fim da faixa 1', '12:00');
    expect(value()[3][0].end).toBe('12:00');
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover faixa' })[0]);
    expect(value()[3]).toEqual([{ start: '19:00', end: '20:00' }]);
  });

  it('no máximo quatro faixas por dia', () => {
    const four = defaultBusinessHours();
    four[1] = [
      { start: '06:00', end: '07:00' },
      { start: '08:00', end: '09:00' },
      { start: '10:00', end: '11:00' },
      { start: '12:00', end: '13:00' },
    ];
    render(<Harness initial={four} />);
    expect(screen.queryByRole('button', { name: 'Adicionar faixa em Segunda' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Remover faixa' })).toHaveLength(4);
  });

  it('copiar a segunda para seg–sex não mexe em sábado e domingo, e as faixas não ficam ligadas', () => {
    const h = defaultBusinessHours();
    h[1] = [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '17:00' }];
    render(<Harness initial={h} />);
    fireEvent.click(screen.getByRole('button', { name: /Copiar para seg–sex/ }));
    for (const d of [1, 2, 3, 4, 5]) expect(value()[d]).toEqual(h[1]);
    expect(value()[6]).toEqual([{ start: '09:00', end: '14:00' }]);
    expect(value()[0]).toEqual([]);
    // mexer na terça depois da cópia não altera a quarta
    time('Terça: início da faixa 1', '07:00');
    expect(value()[2][0].start).toBe('07:00');
    expect(value()[3][0].start).toBe('08:00');
  });

  it('o botão de copiar só existe na segunda-feira aberta', () => {
    const h = defaultBusinessHours();
    h[1] = [];
    render(<Harness initial={h} />);
    expect(screen.queryByRole('button', { name: /Copiar/ })).toBeNull();
  });
});
