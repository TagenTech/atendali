import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/org', () => import('@/test/org-stub'));
const nav = vi.hoisted(() => ({ pathname: '/financeiro' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { orgState, resetOrg } from '@/test/org-stub';
import { FinanceTabs } from './finance-tabs';
import { Kpi, KpiStrip } from './kpi';

describe('Kpi', () => {
  it('mostra rótulo, valor e a dica quando houver', () => {
    const a = render(<Kpi label="Receita" value="R$ 10,00" />);
    expect(screen.getByText('Receita')).toBeTruthy();
    expect(screen.getByText('R$ 10,00')).toBeTruthy();
    expect(a.container.querySelectorAll('p')).toHaveLength(2);
    a.unmount();
    render(<Kpi label="Ticket" value="R$ 5,00" hint="por atendimento" />);
    expect(screen.getByText('por atendimento')).toBeTruthy();
  });

  it('agrupa os números numa faixa, sem um card por indicador', () => {
    const { container } = render(
      <KpiStrip>
        <Kpi label="Entrou" value="R$ 10,00" />
        <Kpi label="Saiu" value="R$ 4,00" />
        <Kpi label="Resultado" value="R$ 6,00" />
      </KpiStrip>,
    );
    expect(container.querySelectorAll('[class*="bg-border"]').length).toBeGreaterThan(0);
    expect(screen.getByText('Entrou')).toBeTruthy();
    expect(screen.getByText('Saiu')).toBeTruthy();
  });
});

describe('FinanceTabs', () => {
  beforeEach(resetOrg);

  it('some para quem não vê o financeiro', () => {
    const { container } = render(<FinanceTabs />);
    expect(container.innerHTML).toBe('');
  });

  it('mostra as abas e marca a página atual', () => {
    orgState.permissions = ['finance.view'];
    nav.pathname = '/financeiro/dre';
    render(<FinanceTabs />);
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(['Resumo', 'Contas', 'DRE', 'Fluxo de caixa']);
    expect(screen.getByRole('link', { name: 'DRE' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Resumo' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: 'Contas' }).getAttribute('href')).toBe('/financeiro/contas');
  });
});
