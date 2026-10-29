import type { AgendaDayDto, AppointmentDto } from '@skedulei/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clock = vi.hoisted(() => ({ now: 0 }));
vi.mock('@/lib/use-now', () => ({ useNow: () => clock.now }));
vi.mock('@/components/org/member-sheet', () => ({ memberColor: (c: number) => ({ color: `var(--pro-${c})` }) }));

import { DayGrid, type GridColumn } from './day-grid';

const PX = 1.25;
const hours = [{ start: '08:00', end: '18:00' }];
const colA: GridColumn = { key: 'a', label: 'Bia', sublabel: 'Cabelo', color: 1, date: '2026-10-28', memberId: 'm1', hours };
const colB: GridColumn = { key: 'b', label: 'Caio', color: 2, date: '2026-10-28', memberId: 'm2', hours, highlight: true };

// Fuso da unidade: São Paulo (UTC−3). 12:00Z = 09:00 no relógio da unidade.
const appt = (over: Partial<AppointmentDto> = {}): AppointmentDto =>
  ({
    id: 'a1',
    clientName: 'Maria',
    serviceName: 'Corte',
    memberId: 'm1',
    status: 'AGENDADO',
    source: 'RECEPCAO',
    startsAt: '2026-10-28T12:00:00.000Z',
    endsAt: '2026-10-28T13:00:00.000Z',
    ...over,
  }) as AppointmentDto;

const day = (appointments: AppointmentDto[] = [appt()], blocks: AgendaDayDto['blocks'] = []): AgendaDayDto =>
  ({ date: '2026-10-28', timezone: 'America/Sao_Paulo', appointments, blocks }) as unknown as AgendaDayDto;

type Props = Partial<React.ComponentProps<typeof DayGrid>>;
function show(props: Props = {}) {
  const onOpen = vi.fn();
  const onMove = vi.fn();
  const onSlot = vi.fn();
  const utils = render(<DayGrid day={day()} columns={[colA, colB]} showCancelled={false} onOpen={onOpen} onMove={onMove} onSlot={onSlot} today="2026-10-27" {...props} />);
  return { onOpen, onMove, onSlot, ...utils };
}
const card = (id = 'a1') => document.querySelector<HTMLElement>(`[data-appointment="${id}"]`)!;
const ptr = (el: Element, type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel', init: PointerEventInit = {}) =>
  fireEvent[type](el, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 10, clientY: 100, ...init });

beforeEach(() => {
  clock.now = 0;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  // Duas colunas lado a lado: A de 0 a 100 px, B de 100 a 200.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const cols = Array.from(document.querySelectorAll('.relative.min-w-0.flex-1.border-l'));
    const i = cols.indexOf(this);
    const left = i === -1 ? 0 : i * 100;
    return { left, right: left + 100, top: 0, bottom: 0, width: 100, height: 0, x: left, y: 0, toJSON: () => ({}) } as DOMRect;
  });
});

describe('DayGrid: desenho', () => {
  it('cabeçalho com nome e complemento de cada coluna; encaixes de 30 em 30 min', () => {
    show();
    expect(screen.getByText('Bia')).toBeTruthy();
    expect(screen.getByText('Cabelo')).toBeTruthy();
    expect(screen.getByText('Caio')).toBeTruthy();
    // 08:00 às 18:00 = 20 encaixes por coluna
    expect(screen.getAllByRole('button', { name: /^Agendar com Bia/ })).toHaveLength(20);
    expect(screen.getByRole('button', { name: 'Agendar com Bia (Cabelo) às 08:00' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Agendar com Caio às 17:30' })).toBeTruthy();
  });

  it('clicar num encaixe livre pede o agendamento naquele horário; sem onSlot fica travado', () => {
    const a = show();
    fireEvent.click(screen.getByRole('button', { name: 'Agendar com Caio às 10:30' }));
    expect(a.onSlot).toHaveBeenCalledWith(colB, '10:30');
    a.unmount();
    show({ onSlot: undefined });
    expect((screen.getByRole('button', { name: 'Agendar com Caio às 10:30' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('horário fora do atendimento fica hachurado', () => {
    show({ columns: [{ ...colA, hours: [{ start: '09:00', end: '12:00' }] }, colB] });
    expect(screen.getByRole('button', { name: 'Agendar com Bia (Cabelo) às 08:00' }).className).toMatch(/repeating-linear-gradient/);
    expect(screen.getByRole('button', { name: 'Agendar com Bia (Cabelo) às 09:00' }).className).not.toMatch(/repeating-linear-gradient/);
    expect(screen.getByRole('button', { name: 'Agendar com Bia (Cabelo) às 12:00' }).className).toMatch(/repeating-linear-gradient/);
  });

  it('sem horários definidos assume 08h às 20h', () => {
    show({ columns: [{ ...colA, hours: [] }] });
    expect(screen.getAllByRole('button', { name: /^Agendar com Bia/ })).toHaveLength(24);
  });

  it('o atendimento mostra horário, cliente e serviço, na coluna do profissional certo', () => {
    show({ day: day([appt(), appt({ id: 'a2', memberId: 'm2', clientName: 'Pedro', startsAt: '2026-10-28T14:00:00.000Z', endsAt: '2026-10-28T14:15:00.000Z' })]) });
    expect(card().getAttribute('aria-label')).toBe('09:00 Maria — Corte (Agendado)');
    expect(card().textContent).toContain('Corte');
    // 15 min = 18,75 px, menor que 34: sem a linha do serviço
    expect(card('a2').textContent).not.toContain('Corte');
    // o primeiro está na coluna A, o segundo na B
    const cols = document.querySelectorAll('.relative.min-w-0.flex-1.border-l');
    expect(cols[0].contains(card('a1'))).toBe(true);
    expect(cols[1].contains(card('a2'))).toBe(true);
    // posição e altura: 09:00 está 60 min depois das 08:00; 60 min de duração
    expect(card().style.top).toBe(`${60 * PX + 1}px`);
    expect(card().style.height).toBe(`${60 * PX - 2}px`);
  });

  it('só aparecem os do dia da coluna; cancelados só quando pedido', () => {
    const day2 = day([
      appt({ id: 'hoje' }),
      appt({ id: 'outro-dia', startsAt: '2026-10-29T12:00:00.000Z', endsAt: '2026-10-29T13:00:00.000Z' }),
      appt({ id: 'cancelado', status: 'CANCELADO' }),
    ]);
    const a = show({ day: day2 });
    expect(card('hoje')).toBeTruthy();
    expect(card('outro-dia')).toBeNull();
    expect(card('cancelado')).toBeNull();
    a.unmount();
    show({ day: day2, showCancelled: true });
    expect(card('cancelado')).toBeTruthy();
  });

  it('ícones de confirmado e agendado online', () => {
    show({ day: day([appt({ status: 'CONFIRMADO', source: 'ONLINE' })]) });
    expect(card().querySelectorAll('svg')).toHaveLength(2);
  });

  it('atendimento fora do horário amplia a grade para as horas cheias que o cobrem', () => {
    show({ day: day([appt({ startsAt: '2026-10-28T09:30:00.000Z', endsAt: '2026-10-28T10:30:00.000Z' }), appt({ id: 'a3', startsAt: '2026-10-28T21:15:00.000Z', endsAt: '2026-10-28T22:00:00.000Z' })]) });
    // começa 06:30 → grade a partir de 06:00; termina 19:00 → até 19:00
    expect(screen.getByRole('button', { name: 'Agendar com Bia (Cabelo) às 06:00' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Agendar com Bia (Cabelo) às 18:30' })).toBeTruthy();
  });

  it('atendimento que termina à meia-noite vai até o fim do dia', () => {
    show({ day: day([appt({ startsAt: '2026-10-29T01:00:00.000Z', endsAt: '2026-10-29T03:00:00.000Z' })]) });
    expect(screen.getByRole('button', { name: 'Agendar com Bia (Cabelo) às 23:30' })).toBeTruthy();
  });

  it('bloqueios: da unidade aparecem em todas as colunas, do profissional só na dele, e o de outro dia não aparece', () => {
    const blocks = [
      { id: 'b1', memberId: null, startsAt: '2026-10-28T15:00:00.000Z', endsAt: '2026-10-28T16:00:00.000Z', reason: 'Feriado' },
      { id: 'b2', memberId: 'm2', startsAt: '2026-10-28T17:00:00.000Z', endsAt: '2026-10-28T18:00:00.000Z', reason: null },
      { id: 'b3', memberId: null, startsAt: '2026-10-30T15:00:00.000Z', endsAt: '2026-10-30T16:00:00.000Z', reason: 'Outro dia' },
      { id: 'b4', memberId: null, startsAt: '2026-10-26T15:00:00.000Z', endsAt: '2026-10-26T16:00:00.000Z', reason: 'Antes' },
    ] as AgendaDayDto['blocks'];
    show({ day: day([], blocks) });
    expect(screen.getAllByText('Feriado')).toHaveLength(2);
    expect(screen.getAllByText('Bloqueado')).toHaveLength(1);
    expect(screen.queryByText('Outro dia')).toBeNull();
    expect(screen.queryByText('Antes')).toBeNull();
  });

  it('bloqueio que vem de outro dia e termina neste, ou começa neste e segue adiante, é recortado', () => {
    const blocks = [
      { id: 'b1', memberId: null, startsAt: '2026-10-27T20:00:00.000Z', endsAt: '2026-10-28T12:00:00.000Z', reason: 'Viagem' },
      { id: 'b2', memberId: null, startsAt: '2026-10-28T20:00:00.000Z', endsAt: '2026-10-29T12:00:00.000Z', reason: 'Curso' },
    ] as AgendaDayDto['blocks'];
    show({ day: day([], blocks), columns: [colA] });
    expect(screen.getByText('Viagem')).toBeTruthy();
    expect(screen.getByText('Curso')).toBeTruthy();
  });

  it('linha do "agora" só no dia de hoje e dentro da grade', () => {
    // 28/10 às 10:00 na unidade
    clock.now = new Date('2026-10-28T13:00:00.000Z').getTime();
    const a = show({ today: '2026-10-28' });
    expect(document.querySelectorAll('.rounded-full.bg-pink')).toHaveLength(2); // uma bolinha por coluna
    expect(document.querySelector('.bg-pink.tabular')?.textContent).toBe('10:00');
    a.unmount();
    show({ today: '2026-10-27' });
    expect(document.querySelector('.bg-pink')).toBeNull();
  });

  it('agora fora da faixa da grade não desenha a linha', () => {
    clock.now = new Date('2026-10-28T08:00:00.000Z').getTime(); // 05:00 na unidade
    show({ today: '2026-10-28' });
    expect(document.querySelector('.bg-pink')).toBeNull();
  });

  it('abrir o atendimento ao clicar', () => {
    const a = show();
    fireEvent.click(card());
    expect(a.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
  });
});

describe('DayGrid: arrastar e esticar', () => {
  it('arrastar para baixo muda o horário de 15 em 15 min e não conta como clique', () => {
    const a = show();
    ptr(card(), 'pointerDown', { clientY: 100 });
    ptr(card(), 'pointerMove', { clientY: 100 + 30 * PX });
    ptr(card(), 'pointerUp');
    expect(a.onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), { date: '2026-10-28', memberId: 'm1', time: '09:30', durationMinutes: 60 });
    // o clique que o navegador dispara depois do arrasto é engolido; o seguinte abre
    fireEvent.click(card());
    expect(a.onOpen).not.toHaveBeenCalled();
    fireEvent.click(card());
    expect(a.onOpen).toHaveBeenCalledTimes(1);
  });

  it('arrastar para a coluna ao lado troca de profissional', () => {
    const a = show();
    ptr(card(), 'pointerDown', { clientX: 50, clientY: 100 });
    ptr(card(), 'pointerMove', { clientX: 150, clientY: 100 });
    ptr(card(), 'pointerUp', { clientX: 150 });
    expect(a.onMove).toHaveBeenCalledWith(expect.anything(), { date: '2026-10-28', memberId: 'm2', time: '09:00', durationMinutes: 60 });
  });

  it('solto fora de qualquer coluna fica na de origem', () => {
    const a = show();
    ptr(card(), 'pointerDown', { clientX: 50, clientY: 100 });
    ptr(card(), 'pointerMove', { clientX: 900, clientY: 100 + 15 * PX });
    ptr(card(), 'pointerUp');
    expect(a.onMove).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ memberId: 'm1', time: '09:15' }));
  });

  it('não passa do começo nem do fim do dia', () => {
    const a = show();
    ptr(card(), 'pointerDown');
    ptr(card(), 'pointerMove', { clientY: 100 - 5000 });
    ptr(card(), 'pointerUp');
    expect(a.onMove).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ time: '00:00' }));
    fireEvent.click(card());
    ptr(card(), 'pointerDown');
    ptr(card(), 'pointerMove', { clientY: 100 + 5000 });
    ptr(card(), 'pointerUp');
    expect(a.onMove).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ time: '23:45' }));
  });

  it('um toque curto (menos de 4 px) continua sendo clique', () => {
    const a = show();
    ptr(card(), 'pointerDown');
    ptr(card(), 'pointerMove', { clientY: 102 });
    ptr(card(), 'pointerUp');
    fireEvent.click(card());
    expect(a.onMove).not.toHaveBeenCalled();
    expect(a.onOpen).toHaveBeenCalledTimes(1);
  });

  it('mexeu um pouco mas voltou ao mesmo lugar: não grava nada', () => {
    const a = show();
    ptr(card(), 'pointerDown');
    ptr(card(), 'pointerMove', { clientY: 105 });
    ptr(card(), 'pointerUp');
    expect(a.onMove).not.toHaveBeenCalled();
  });

  it('esticar pela borda de baixo muda só a duração', () => {
    const a = show();
    const handle = document.querySelector<HTMLElement>('[data-resize="a1"]')!;
    ptr(handle, 'pointerDown', { clientY: 100 });
    ptr(card(), 'pointerMove', { clientY: 100 + 30 * PX });
    ptr(card(), 'pointerUp');
    expect(a.onMove).toHaveBeenCalledWith(expect.anything(), { date: '2026-10-28', memberId: 'm1', time: '09:00', durationMinutes: 90 });
  });

  it('esticar nunca deixa com menos de 15 min; sem mudança não grava', () => {
    const a = show();
    const handle = () => document.querySelector<HTMLElement>('[data-resize="a1"]')!;
    ptr(handle(), 'pointerDown');
    ptr(card(), 'pointerMove', { clientY: 100 - 5000 });
    ptr(card(), 'pointerUp');
    expect(a.onMove).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ durationMinutes: 15 }));
    fireEvent.click(card());
    a.onMove.mockClear();
    ptr(handle(), 'pointerDown');
    ptr(card(), 'pointerMove', { clientY: 105 });
    ptr(card(), 'pointerUp');
    expect(a.onMove).not.toHaveBeenCalled();
  });

  it('mostra o cartão se mexendo durante o arrasto e solta ao cancelar', () => {
    show();
    ptr(card(), 'pointerDown', { clientX: 50 });
    ptr(card(), 'pointerMove', { clientX: 150, clientY: 100 + 30 * PX });
    expect(card().className).toMatch(/cursor-grabbing/);
    expect(card().style.transform).toBe('translateX(100px)');
    expect(card().style.top).toBe(`${90 * PX + 1}px`);
    ptr(card(), 'pointerCancel');
    expect(card().className).not.toMatch(/cursor-grabbing/);
  });

  it('esticar mostra o cartão mais alto durante o gesto', () => {
    show();
    ptr(document.querySelector<HTMLElement>('[data-resize="a1"]')!, 'pointerDown');
    ptr(card(), 'pointerMove', { clientY: 100 + 30 * PX });
    expect(card().style.height).toBe(`${90 * PX - 2}px`);
  });

  it('toque no celular, botão do meio, concluído e cancelado não arrastam', () => {
    const a = show({ day: day([appt(), appt({ id: 'ok', status: 'CONCLUIDO', memberId: 'm2' }), appt({ id: 'no', status: 'CANCELADO', memberId: 'm2' })]), showCancelled: true });
    ptr(card(), 'pointerDown', { pointerType: 'touch' });
    ptr(card(), 'pointerMove', { clientY: 300 });
    ptr(card(), 'pointerUp');
    ptr(card(), 'pointerDown', { button: 1 });
    ptr(card(), 'pointerMove', { clientY: 300 });
    ptr(card(), 'pointerUp');
    for (const id of ['ok', 'no']) {
      ptr(card(id), 'pointerDown');
      ptr(card(id), 'pointerMove', { clientY: 300 });
      ptr(card(id), 'pointerUp');
      expect(document.querySelector(`[data-resize="${id}"]`)).toBeNull();
    }
    expect(a.onMove).not.toHaveBeenCalled();
  });

  it('sem onMove não há borda para esticar nem arrasto', () => {
    const a = show({ onMove: undefined });
    expect(document.querySelector('[data-resize]')).toBeNull();
    ptr(card(), 'pointerDown');
    ptr(card(), 'pointerMove', { clientY: 300 });
    ptr(card(), 'pointerUp');
    fireEvent.click(card());
    expect(a.onOpen).toHaveBeenCalledTimes(1);
  });

  it('mover e soltar sem ter começado (movimento solto) é ignorado', () => {
    const a = show();
    ptr(card(), 'pointerMove', { clientY: 300 });
    ptr(card(), 'pointerUp');
    expect(a.onMove).not.toHaveBeenCalled();
  });
});

describe('DayGrid: uma coluna só', () => {
  it('não alarga a grade', () => {
    const { container } = show({ columns: [colA] });
    expect((container.firstElementChild!.firstElementChild as HTMLElement).style.width).toBe('');
  });
  it('várias colunas ganham largura mínima', () => {
    const { container } = show();
    expect((container.firstElementChild!.firstElementChild as HTMLElement).style.width).toMatch(/^max\(100%, /);
  });
});
