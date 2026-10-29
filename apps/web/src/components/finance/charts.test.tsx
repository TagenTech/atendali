import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DailyColumns, FlowColumns, HBars } from './charts';

const days = (values: number[]) => values.map((revenueCents, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, revenueCents }));

describe('DailyColumns', () => {
  it('uma coluna por dia, com valor acessível, destaque do melhor dia e tabela equivalente', () => {
    render(<DailyColumns data={days([10000, 30000, 0])} label="Receita por dia" />);
    const list = screen.getByRole('list', { name: 'Receita por dia' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1].getAttribute('aria-label')).toMatch(/^02\/10: .*300,00/);
    // melhor dia marcado (R$ 300 → "R$ 300") enquanto ninguém está com o mouse em cima
    expect(screen.getAllByText(/R\$\s?300/).length).toBeGreaterThan(0);
    expect(screen.getByRole('table', { hidden: true })).toBeTruthy();
    // eixo: primeiro, meio e último
    expect(screen.getAllByText('01/10').length).toBeGreaterThan(0);
    expect(screen.getAllByText('03/10').length).toBeGreaterThan(0);
  });

  it('dica ao passar o mouse e ao focar; some ao sair', () => {
    render(<DailyColumns data={days([10000, 20000])} label="x" />);
    const [a, b] = screen.getAllByRole('listitem');
    fireEvent.mouseEnter(a);
    expect(screen.getByRole('tooltip').textContent).toMatch(/01\/10.*100,00/);
    fireEvent.mouseLeave(a);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(b);
    expect(screen.getByRole('tooltip').textContent).toMatch(/02\/10.*200,00/);
    fireEvent.blur(b);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('eixo "limpo" em qualquer escala e sem barra quando tudo é zero', () => {
    for (const v of [0, 90000, 150000, 400000, 700000]) {
      const { unmount } = render(<DailyColumns data={days([v, 0])} label="x" />);
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
      unmount();
    }
  });
});

describe('HBars', () => {
  it('uma barra por linha, com dica opcional e proporção ao maior', () => {
    const { container } = render(
      <HBars
        rows={[
          { label: 'Corte', valueCents: 20000, hint: '4 atend.' },
          { label: 'Escova', valueCents: 10000 },
        ]}
      />,
    );
    expect(screen.getByText('4 atend.')).toBeTruthy();
    const bars = container.querySelectorAll<HTMLElement>('li .h-3 .h-3');
    expect(bars[0].style.width).toBe('100%');
    expect(bars[1].style.width).toBe('50%');
    expect(screen.getByText('Escova').closest('li')!.getAttribute('title')).toMatch(/^Escova: .*100,00$/);
    expect(screen.getByText('Corte').closest('li')!.getAttribute('title')).toMatch(/· 4 atend\.$/);
  });

  it('tudo zero não divide por zero', () => {
    const { container } = render(<HBars rows={[{ label: 'A', valueCents: 0 }]} />);
    expect(container.querySelector<HTMLElement>('li .h-3 .h-3')!.style.width).toBe('0%');
  });
});

const bucket = (start: string, end: string, inCents: number, outCents: number, balanceCents = 0) => ({ start, end, inCents, outCents, netCents: inCents - outCents, balanceCents });

describe('FlowColumns', () => {
  it('mostra entrou, saiu e resultado, com período de um dia ou de vários', () => {
    render(<FlowColumns label="Fluxo" buckets={[bucket('2026-10-01', '2026-10-01', 30000, 10000, 20000), bucket('2026-10-02', '2026-10-08', 5000, 25000, 0)]} />);
    const items = within(screen.getByRole('list', { name: 'Fluxo' })).getAllByRole('listitem');
    expect(items[0].getAttribute('aria-label')).toMatch(/^01\/10: entrou .*300,00, saiu .*100,00, resultado .*200,00$/);
    expect(items[1].getAttribute('aria-label')).toMatch(/^02\/10 a 08\/10: /);
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('Saldo')).toBeTruthy();
  });

  it('dica ao passar o mouse e ao focar', () => {
    render(<FlowColumns label="Fluxo" buckets={[bucket('2026-10-01', '2026-10-01', 30000, 10000), bucket('2026-10-02', '2026-10-02', 1000, 5000)]} />);
    const [a, b] = screen.getAllByRole('listitem');
    fireEvent.mouseEnter(a);
    expect(screen.getByRole('tooltip').textContent).toMatch(/Entrou .*300,00Saiu .*100,00Resultado .*200,00/);
    fireEvent.mouseLeave(a);
    fireEvent.focus(b);
    expect(screen.getByRole('tooltip').textContent).toMatch(/Resultado .*− ?R\$\s?40,00|Resultado -R\$\s?40,00|Resultado .*40,00/);
    fireEvent.blur(b);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('só positivo, só negativo e tudo zero', () => {
    for (const [i, o] of [
      [100000, 0],
      [0, 100000],
      [0, 0],
      [70000, 0],
    ]) {
      const { unmount } = render(<FlowColumns label="Fluxo" buckets={[bucket('2026-10-01', '2026-10-01', i, o)]} />);
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
      unmount();
    }
  });
});
