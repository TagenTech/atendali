'use client';

import { APPOINTMENT_STATUS_LABEL, zonedParts, type AgendaDayDto, type AppointmentDto, type TimeRange } from '@skedulei/contracts';
import { CheckCircle2, Globe, Lock } from 'lucide-react';
import * as React from 'react';
import { memberColor } from '@/components/org/member-sheet';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import { STATUS_STYLE } from './status';

const PX_PER_MIN = 1.25;
const SLOT_MIN = 30;
const SNAP_MIN = 15;

/** Uma coluna da grade: um profissional num dia (visão de dia = vários profissionais; semana = vários dias). */
export interface GridColumn {
  key: string;
  label: string;
  sublabel?: string;
  /** Cor do profissional (1…8). */
  color: number;
  date: string;
  memberId: string;
  /** Horário de atendimento desse profissional nesse dia. */
  hours: TimeRange[];
  highlight?: boolean;
}

export interface MoveTarget {
  date: string;
  memberId: string;
  time: string;
  durationMinutes: number;
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const snap = (m: number) => Math.round(m / SNAP_MIN) * SNAP_MIN;

interface Drag {
  id: string;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  colIndex: number;
  targetCol: number;
  deltaMin: number;
  /** Deslocamento horizontal (px) até a coluna-alvo. */
  shiftX: number;
  moved: boolean;
}

export function DayGrid({
  day,
  columns,
  showCancelled,
  onSlot,
  onOpen,
  onMove,
  today,
}: {
  day: AgendaDayDto;
  columns: GridColumn[];
  showCancelled: boolean;
  onSlot?: (col: GridColumn, time: string) => void;
  onOpen: (a: AppointmentDto) => void;
  /** Arrastar (mudar horário/coluna) ou esticar (mudar duração). Só com mouse/caneta. */
  onMove?: (a: AppointmentDto, to: MoveTarget) => void;
  today: string | null;
}) {
  const tz = day.timezone;
  const place = React.useCallback(
    (iso: string) => {
      const p = zonedParts(new Date(iso), tz);
      return { date: p.date, minutes: p.minutes };
    },
    [tz],
  );

  // Faixa visível: horários de atendimento ± encaixes, arredondada para horas cheias.
  const { start, end } = React.useMemo(() => {
    const all = columns.flatMap((c) => c.hours);
    let s = all.length ? Math.min(...all.map((r) => toMin(r.start))) : 8 * 60;
    let e = all.length ? Math.max(...all.map((r) => toMin(r.end))) : 20 * 60;
    for (const a of day.appointments) {
      s = Math.min(s, place(a.startsAt).minutes);
      e = Math.max(e, place(a.endsAt).minutes || 24 * 60);
    }
    return { start: Math.max(0, Math.floor(s / 60) * 60), end: Math.min(24 * 60, Math.ceil(e / 60) * 60) };
  }, [columns, day.appointments, place]);

  const height = (end - start) * PX_PER_MIN;
  const top = (m: number) => (m - start) * PX_PER_MIN;
  const hours = Array.from({ length: (end - start) / 60 + 1 }, (_, i) => start + i * 60);
  const now = useNow();
  const nowPlace = now ? zonedParts(new Date(now), tz) : null;

  const colRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [drag, setDrag] = React.useState<Drag | null>(null);
  const suppressClick = React.useRef(false);

  const colAt = (clientX: number, fallback: number) => {
    const i = colRefs.current.findIndex((el) => {
      const r = el?.getBoundingClientRect();
      return r && clientX >= r.left && clientX < r.right;
    });
    return i === -1 ? fallback : i;
  };

  const beginDrag = (e: React.PointerEvent, a: AppointmentDto, colIndex: number, mode: Drag['mode']) => {
    if (!onMove || e.pointerType === 'touch' || e.button !== 0) return;
    if (a.status === 'CANCELADO' || a.status === 'CONCLUIDO') return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: a.id, mode, startX: e.clientX, startY: e.clientY, colIndex, targetCol: colIndex, deltaMin: 0, shiftX: 0, moved: false });
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const deltaMin = snap((e.clientY - drag.startY) / PX_PER_MIN);
    const targetCol = drag.mode === 'move' ? colAt(e.clientX, drag.colIndex) : drag.colIndex;
    const moved = drag.moved || Math.abs(e.clientY - drag.startY) > 4 || Math.abs(e.clientX - drag.startX) > 4;
    const left = (i: number) => colRefs.current[i]?.getBoundingClientRect().left ?? 0;
    const shiftX = targetCol === drag.colIndex ? 0 : left(targetCol) - left(drag.colIndex);
    if (deltaMin !== drag.deltaMin || targetCol !== drag.targetCol || moved !== drag.moved) setDrag({ ...drag, deltaMin, targetCol, shiftX, moved });
  };

  const endDrag = (a: AppointmentDto) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) return;
    suppressClick.current = true;
    const s = place(a.startsAt).minutes;
    const duration = Math.round((new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000);
    const col = columns[d.targetCol];
    if (d.mode === 'move') {
      if (d.deltaMin === 0 && d.targetCol === d.colIndex) return;
      onMove!(a, { date: col.date, memberId: col.memberId, time: hhmm(Math.max(0, Math.min(24 * 60 - SNAP_MIN, s + d.deltaMin))), durationMinutes: duration });
    } else {
      const next = Math.max(SNAP_MIN, duration + d.deltaMin);
      if (next !== duration) onMove!(a, { date: col.date, memberId: col.memberId, time: hhmm(s), durationMinutes: next });
    }
  };

  return (
    <div className="overflow-x-auto rounded-3xl border border-border bg-card">
      <div className="min-w-full" style={{ width: columns.length > 1 ? `max(100%, ${3.5 + columns.length * 10}rem)` : undefined }}>
        {/* Cabeçalho das colunas */}
        <div className="sticky top-0 z-20 flex border-b border-border bg-card/95 backdrop-blur">
          <div className="w-14 shrink-0" />
          {columns.map((c) => (
            <div key={c.key} className={cn('flex min-w-0 flex-1 items-center gap-2 border-l border-border px-3 py-2.5', c.highlight && 'bg-primary-soft')}>
              <span className="size-3 shrink-0 rounded-full" style={{ background: `var(--pro-${c.color}-fg)` }} aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{c.label}</span>
                {c.sublabel ? <span className="block truncate text-xs text-muted-foreground">{c.sublabel}</span> : null}
              </span>
            </div>
          ))}
        </div>

        <div className="relative flex" style={{ height }}>
          {/* Régua de horas */}
          <div className="relative w-14 shrink-0">
            {hours.slice(0, -1).map((m) => (
              <span key={m} className="absolute right-2 text-xs font-semibold tabular text-muted-foreground" style={{ top: Math.max(2, top(m) - 7) }}>
                {hhmm(m)}
              </span>
            ))}
            {nowPlace && columns.some((c) => c.date === today) && nowPlace.minutes >= start && nowPlace.minutes <= end ? (
              <span
                className="absolute right-1 z-20 rounded bg-pink px-1 py-px text-[10px] font-bold tabular text-white"
                style={{ top: Math.max(0, top(nowPlace.minutes) - 8) }}
                aria-hidden
              >
                {hhmm(nowPlace.minutes)}
              </span>
            ) : null}
          </div>

          {columns.map((c, ci) => {
            const appts = day.appointments.filter(
              (a) => a.memberId === c.memberId && place(a.startsAt).date === c.date && (showCancelled || a.status !== 'CANCELADO'),
            );
            const open = (m: number) => c.hours.some((r) => m >= toMin(r.start) && m < toMin(r.end));
            const blocks = day.blocks
              .filter((b) => b.memberId === null || b.memberId === c.memberId)
              .map((b) => {
                const bs = place(b.startsAt);
                const be = place(b.endsAt);
                const s = bs.date < c.date ? 0 : bs.date > c.date ? null : bs.minutes;
                const e = be.date > c.date ? 24 * 60 : be.date < c.date ? null : be.minutes;
                return s === null || e === null ? null : { ...b, s: Math.max(start, s), e: Math.min(end, e) };
              })
              .filter((b): b is NonNullable<typeof b> => !!b && b.e > b.s);
            return (
              <div key={c.key} ref={(el) => void (colRefs.current[ci] = el)} className="relative min-w-0 flex-1 border-l border-border">
                {Array.from({ length: (end - start) / SLOT_MIN }, (_, i) => start + i * SLOT_MIN).map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={!onSlot}
                    onClick={() => onSlot?.(c, hhmm(m))}
                    aria-label={`Agendar com ${c.label}${c.sublabel ? ` (${c.sublabel})` : ''} às ${hhmm(m)}`}
                    className={cn(
                      'absolute inset-x-0 border-t transition-colors enabled:hover:bg-primary-soft/60',
                      m % 60 === 0 ? 'border-border' : 'border-dashed border-border/60',
                      !open(m) && 'bg-[repeating-linear-gradient(135deg,var(--muted)_0_6px,transparent_6px_12px)]',
                    )}
                    style={{ top: top(m), height: SLOT_MIN * PX_PER_MIN }}
                  />
                ))}

                {blocks.map((b) => (
                  <div
                    key={b.id}
                    className="pointer-events-none absolute inset-x-1 flex items-start gap-1 rounded-xl bg-[repeating-linear-gradient(135deg,var(--border)_0_6px,var(--muted)_6px_12px)] p-1.5 text-xs font-semibold text-muted-foreground"
                    style={{ top: top(b.s), height: (b.e - b.s) * PX_PER_MIN }}
                  >
                    <Lock className="size-3.5 shrink-0" /> {b.reason ?? 'Bloqueado'}
                  </div>
                ))}

                {appts.map((a) => {
                  const s = place(a.startsAt).minutes;
                  const e = place(a.endsAt).minutes || 24 * 60;
                  const dragging = drag?.id === a.id ? drag : null;
                  const startMin = dragging?.mode === 'move' ? s + dragging.deltaMin : s;
                  const endMin = dragging ? (dragging.mode === 'move' ? e + dragging.deltaMin : Math.max(s + SNAP_MIN, e + dragging.deltaMin)) : e;
                  const h = Math.max((endMin - startMin) * PX_PER_MIN, 22);
                  const shiftX = dragging?.shiftX ?? 0;
                  const custom = STATUS_STYLE[a.status];
                  const draggable = !!onMove && a.status !== 'CANCELADO' && a.status !== 'CONCLUIDO';
                  return (
                    <button
                      key={a.id}
                      type="button"
                      data-appointment={a.id}
                      onPointerDown={(ev) => beginDrag(ev, a, ci, 'move')}
                      onPointerMove={moveDrag}
                      onPointerUp={() => endDrag(a)}
                      onPointerCancel={() => setDrag(null)}
                      onClick={() => {
                        if (suppressClick.current) {
                          suppressClick.current = false;
                          return;
                        }
                        onOpen(a);
                      }}
                      aria-label={`${hhmm(s)} ${a.clientName} — ${a.serviceName} (${APPOINTMENT_STATUS_LABEL[a.status]})`}
                      className={cn(
                        'absolute inset-x-1 z-10 overflow-hidden rounded-lg border-l-[3px] border-l-current px-2 py-1 text-left text-[13px] leading-tight transition-[filter] hover:brightness-95',
                        draggable && 'lg:cursor-grab',
                        dragging?.moved && 'z-30 cursor-grabbing opacity-90 shadow-float ring-2 ring-primary',
                        custom,
                      )}
                      style={{ top: top(startMin) + 1, height: h - 2, transform: shiftX ? `translateX(${shiftX}px)` : undefined, ...(custom ? {} : memberColor(c.color)) }}
                    >
                      <span className="flex items-center gap-1 font-bold">
                        <span className="tabular">{hhmm(startMin)}</span>
                        <span className="truncate">{a.clientName}</span>
                        {a.status === 'CONFIRMADO' ? <CheckCircle2 className="size-3.5 shrink-0" aria-hidden /> : null}
                        {a.source === 'ONLINE' ? <Globe className="size-3.5 shrink-0 opacity-70" aria-hidden /> : null}
                      </span>
                      {h > 34 ? <span className="block truncate opacity-80">{a.serviceName}</span> : null}
                      {draggable ? (
                        <span
                          aria-hidden
                          data-resize={a.id}
                          onPointerDown={(ev) => beginDrag(ev, a, ci, 'resize')}
                          className="absolute inset-x-0 bottom-0 hidden h-2 cursor-ns-resize lg:block"
                        />
                      ) : null}
                    </button>
                  );
                })}

                {nowPlace && c.date === today && nowPlace.minutes >= start && nowPlace.minutes <= end ? (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: top(nowPlace.minutes) }} aria-hidden>
                    <span className="-ml-1 size-2.5 rounded-full bg-pink" />
                    <span className="h-0.5 flex-1 bg-pink" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
