/**
 * Relatórios de gestão da agenda: faltas, ocupação, retorno, ticket e ranking; clientes sem voltar e aniversariantes.
 * Funções puras: o servidor entrega as linhas já filtradas por negócio e período.
 */
import type { BusinessHours } from './business-hours';
import { addDays, type IsoDate } from './dates';
import { weekdayOf } from './time';

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Minutos de trabalho entre duas datas (inclusive), pelo horário da semana. */
export function workingMinutes(hours: BusinessHours, from: IsoDate, to: IsoDate): number {
  let total = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    for (const r of hours[weekdayOf(d)] ?? []) total += Math.max(0, toMin(r.end) - toMin(r.start));
  }
  return total;
}

export interface ReportRow {
  status: string;
  startsAt: string;
  endsAt: string;
  serviceId: string;
  serviceName: string;
  memberId: string;
  memberName: string;
  clientId: string;
  priceCents: number;
  source: string;
}

export interface RankItem {
  id: string;
  name: string;
  count: number;
  revenueCents: number;
}

export interface MemberOccupancy extends RankItem {
  bookedMinutes: number;
  availableMinutes: number;
  /** 0–100 (ou `null` se a pessoa não tem horário de trabalho no período). */
  occupancyPct: number | null;
}

export interface ReportOverview {
  from: IsoDate;
  to: IsoDate;
  total: number;
  concluded: number;
  noShows: number;
  cancelled: number;
  /** Faltas ÷ (concluídos + faltas), em %. */
  noShowPct: number | null;
  cancelPct: number | null;
  revenueCents: number;
  /** Receita dos atendimentos concluídos ÷ quantidade. */
  ticketCents: number | null;
  clientsServed: number;
  returningClients: number;
  newClients: number;
  /** Quem foi atendido no período e já tinha vindo antes, em %. */
  returnPct: number | null;
  onlineSharePct: number | null;
  occupancyPct: number | null;
  services: RankItem[];
  members: MemberOccupancy[];
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const OCCUPYING = new Set(['AGENDADO', 'CONFIRMADO', 'CHEGOU', 'EM_ATENDIMENTO', 'CONCLUIDO', 'FALTOU']);

export function buildOverview(p: {
  from: IsoDate;
  to: IsoDate;
  rows: ReportRow[];
  /** Minutos de trabalho de cada pessoa no período (já com a interseção unidade × pessoa). */
  availableByMember: Record<string, number>;
  /** Clientes com atendimento concluído ANTES do período. */
  seenBefore: ReadonlySet<string>;
}): ReportOverview {
  const { rows } = p;
  const done = rows.filter((r) => r.status === 'CONCLUIDO');
  const noShows = rows.filter((r) => r.status === 'FALTOU').length;
  const cancelled = rows.filter((r) => r.status === 'CANCELADO').length;
  const revenueCents = done.reduce((s, r) => s + r.priceCents, 0);
  const served = new Set(done.map((r) => r.clientId));
  const returning = [...served].filter((c) => p.seenBefore.has(c)).length;
  const live = rows.filter((r) => r.status !== 'CANCELADO');

  const rank = (key: 'serviceId' | 'memberId', name: 'serviceName' | 'memberName') => {
    const map = new Map<string, RankItem>();
    for (const r of done) {
      const cur = map.get(r[key]) ?? { id: r[key], name: r[name], count: 0, revenueCents: 0 };
      cur.count++;
      cur.revenueCents += r.priceCents;
      map.set(r[key], cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count || b.revenueCents - a.revenueCents);
  };

  const booked = new Map<string, number>();
  for (const r of rows) {
    if (!OCCUPYING.has(r.status)) continue;
    booked.set(r.memberId, (booked.get(r.memberId) ?? 0) + (new Date(r.endsAt).getTime() - new Date(r.startsAt).getTime()) / 60_000);
  }
  const memberRank = rank('memberId', 'memberName');
  const names = new Map(rows.map((r) => [r.memberId, r.memberName]));
  const memberIds = new Set([...Object.keys(p.availableByMember), ...memberRank.map((m) => m.id)]);
  const members: MemberOccupancy[] = [...memberIds].map((id) => {
    const base = memberRank.find((m) => m.id === id) ?? { id, name: names.get(id) ?? '—', count: 0, revenueCents: 0 };
    const available = p.availableByMember[id] ?? 0;
    const bookedMinutes = Math.round(booked.get(id) ?? 0);
    return { ...base, bookedMinutes, availableMinutes: available, occupancyPct: available > 0 ? Math.min(100, pct(bookedMinutes, available) ?? 0) : null };
  });
  members.sort((a, b) => b.count - a.count || b.bookedMinutes - a.bookedMinutes);
  const totalAvailable = members.reduce((s, m) => s + m.availableMinutes, 0);
  const totalBooked = members.reduce((s, m) => s + m.bookedMinutes, 0);

  return {
    from: p.from,
    to: p.to,
    total: rows.length,
    concluded: done.length,
    noShows,
    cancelled,
    noShowPct: pct(noShows, done.length + noShows),
    cancelPct: pct(cancelled, rows.length),
    revenueCents,
    ticketCents: done.length ? Math.round(revenueCents / done.length) : null,
    clientsServed: served.size,
    returningClients: returning,
    newClients: served.size - returning,
    returnPct: pct(returning, served.size),
    onlineSharePct: pct(live.filter((r) => r.source === 'ONLINE').length, live.length),
    occupancyPct: totalAvailable > 0 ? Math.min(100, pct(totalBooked, totalAvailable) ?? 0) : null,
    services: rank('serviceId', 'serviceName').slice(0, 10),
    members,
  };
}

// ------------------------------------------------------------------ sem voltar e aniversariantes

export interface InactiveClient {
  clientId: string;
  name: string;
  phone: string | null;
  lastVisit: IsoDate;
  daysAway: number;
  visits: number;
}

/** Dias entre duas datas de calendário (b − a). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export interface Birthday {
  clientId: string;
  name: string;
  phone: string | null;
  /** Dia do aniversário (calendário) e quantos dias faltam (0 = hoje). */
  date: IsoDate;
  inDays: number;
  turns: number | null;
}

/** Aniversariantes dos próximos `days` dias (29/02 comemora em 28/02 nos anos sem bissexto). */
export function upcomingBirthdays(clients: { id: string; name: string; phone: string | null; birthDate: string | null }[], today: IsoDate, days: number): Birthday[] {
  const out: Birthday[] = [];
  const year = Number(today.slice(0, 4));
  for (const c of clients) {
    if (!c.birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(c.birthDate)) continue;
    const [by, bm, bd] = c.birthDate.split('-');
    for (const y of [year, year + 1]) {
      let date = `${y}-${bm}-${bd}`;
      if (bm === '02' && bd === '29' && !isLeap(y)) date = `${y}-02-28`;
      const inDays = daysBetween(today, date);
      if (inDays >= 0 && inDays <= days) {
        out.push({ clientId: c.id, name: c.name, phone: c.phone, date, inDays, turns: Number(by) > 1900 ? y - Number(by) : null });
        break;
      }
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name));
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

const first = (name: string) => name.trim().split(/\s+/)[0];
export const comebackMessage = (c: { name: string }, orgName: string) =>
  `Oi, ${first(c.name)}! Aqui é de ${orgName}. Sentimos sua falta por aqui 💜 Que tal marcar um horário? É só responder esta mensagem.`;
export const birthdayMessage = (c: { name: string }, orgName: string) => `Parabéns, ${first(c.name)}! 🎉 Toda a equipe de ${orgName} deseja um dia muito especial. Passe por aqui — temos um carinho para você.`;
