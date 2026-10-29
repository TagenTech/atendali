import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as agenda from './agenda';
import * as audit from './audit';
import * as ledger from './ledger';
import * as retention from './retention';

describe('api/*: variações de caminho', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const lastUrl = () => fetchMock.mock.calls.at(-1)![0] as string;
  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('agenda: dias e busca só entram na URL quando há valor', async () => {
    await agenda.agendaDay('o', '2026-03-10');
    expect(lastUrl()).toBe('/api/v1/org/agenda?date=2026-03-10');
    await agenda.agendaDay('o', '2026-03-10', 7);
    expect(lastUrl()).toBe('/api/v1/org/agenda?date=2026-03-10&days=7');
    await agenda.listClients('o');
    expect(lastUrl()).toBe('/api/v1/org/clients');
    await agenda.listClients('o', 'ana maria');
    expect(lastUrl()).toBe('/api/v1/org/clients?q=ana%20maria');
  });

  it('agenda pública: horários sem profissional não levam memberId; grupo age no item ou em tudo', async () => {
    await agenda.publicSlots('studio', { date: '2026-03-10', serviceId: 's' });
    expect(lastUrl()).toBe('/api/v1/public/orgs/studio/slots?date=2026-03-10&serviceId=s');
    await agenda.publicSlots('studio', { date: '2026-03-10', serviceId: 's', memberId: 'm' });
    expect(lastUrl()).toContain('memberId=m');
    await agenda.publicSequence('studio', '2026-03-10', ['a', 'b']);
    expect(decodeURIComponent(lastUrl())).toContain('serviceIds=a,b');
    for (const fn of [agenda.publicGroupCancel, agenda.publicGroupConfirm]) {
      await fn('tok');
      expect((fetchMock.mock.calls.at(-1)![1] as RequestInit).body).toBe('{}');
      await fn('tok', 'item-1');
      expect((fetchMock.mock.calls.at(-1)![1] as RequestInit).body).toBe('{"itemId":"item-1"}');
    }
  });

  it('auditoria: filtros vazios não geram "?" na URL', async () => {
    await audit.listAudit('o', {});
    expect(lastUrl()).toBe('/api/v1/org/audit');
    await audit.listAudit('o', { entity: 'order' } as never);
    expect(lastUrl()).toBe('/api/v1/org/audit?entity=order');
  });

  it('contas a pagar: excluir as futuras muda a URL; pacotes: filtro de ativos', async () => {
    await ledger.removePayable('o', { id: 'p1' });
    expect(lastUrl()).toBe('/api/v1/org/finance/payables/p1');
    await ledger.removePayable('o', { id: 'p1', futuras: true });
    expect(lastUrl()).toBe('/api/v1/org/finance/payables/p1?futuras=true');
    await retention.clientPackages('o', { clientId: 'c1', active: true });
    expect(lastUrl()).toBe('/api/v1/org/client-packages?clientId=c1&ativos=1');
    await retention.clientPackages('o', {});
    expect(lastUrl()).toBe('/api/v1/org/client-packages');
  });
});
