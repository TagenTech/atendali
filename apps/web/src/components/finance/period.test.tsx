import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/org', () => import('@/test/org-stub'));

import { PeriodPicker, usePeriod } from './period';

function Harness({ initial }: { initial?: 'hoje' | '7d' | 'mes' | 'mes-passado' | 'outro' }) {
  const period = usePeriod(initial);
  return (
    <>
      <PeriodPicker period={period} />
      <output data-testid="range">{period.range ? `${period.range.from}|${period.range.to}` : 'nada'}</output>
    </>
  );
}
const range = () => screen.getByTestId('range').textContent;
const pressed = () => screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);

describe('período', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-28T15:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('começa em "Este mês" (do dia 1 até hoje, no fuso da unidade)', () => {
    render(<Harness />);
    expect(range()).toBe('2026-10-01|2026-10-28');
    expect(pressed()).toEqual(['Este mês']);
  });

  it('atalhos: hoje, 7 dias e mês passado', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(range()).toBe('2026-10-28|2026-10-28');
    fireEvent.click(screen.getByRole('button', { name: '7 dias' }));
    expect(range()).toBe('2026-10-22|2026-10-28');
    fireEvent.click(screen.getByRole('button', { name: 'Mês passado' }));
    expect(range()).toBe('2026-09-01|2026-09-30');
    expect(screen.queryByLabelText('De')).toBeNull();
  });

  it('"Outro": abre as duas datas, aceita mudar e ignora campo apagado', () => {
    render(<Harness initial="outro" />);
    expect((screen.getByLabelText('De') as HTMLInputElement).value).toBe('2026-10-01');
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-10-10' } });
    expect(range()).toBe('2026-10-10|2026-10-28');
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-10-20' } });
    expect(range()).toBe('2026-10-10|2026-10-20');
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '' } });
    expect(range()).toBe('2026-10-10|2026-10-20');
  });
});
