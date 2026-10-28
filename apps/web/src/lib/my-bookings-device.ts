import * as React from 'react';

/** Reservas feitas neste aparelho (só o link e o resumo): quem fecha a aba ainda encontra o horário. Nada sensível além do link. */
export interface DeviceBooking {
  token: string;
  slug: string;
  serviceName: string;
  patientName: string;
  startsAt: string;
  timezone: string;
}

const KEY = 'skedulei_reservas';
const EVENT = 'skedulei:reservas';
let cache: { raw: string | null; parsed: DeviceBooking[] } = { raw: null, parsed: [] };

function read(): DeviceBooking[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cache.raw) return cache.parsed;
    const parsed = (raw ? (JSON.parse(raw) as DeviceBooking[]) : []).filter((b) => b && typeof b.token === 'string' && typeof b.startsAt === 'string' && new Date(b.startsAt).getTime() > Date.now());
    cache = { raw, parsed };
    return parsed;
  } catch {
    return cache.parsed;
  }
}

function write(list: DeviceBooking[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* modo privado: a reserva continua valendo, só não fica guardada aqui */
  }
}

export function rememberBooking(b: DeviceBooking) {
  write([b, ...read().filter((x) => x.token !== b.token)]);
}

export function forgetBooking(token: string) {
  write(read().filter((x) => x.token !== token));
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
};
const EMPTY: DeviceBooking[] = [];

/** Reservas deste negócio ainda por vir (as vencidas saem na leitura), guardadas neste aparelho. */
export function useDeviceBookings(slug: string): DeviceBooking[] {
  const all = React.useSyncExternalStore(subscribe, read, () => EMPTY);
  return React.useMemo(() => all.filter((b) => b.slug === slug).sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [all, slug]);
}
