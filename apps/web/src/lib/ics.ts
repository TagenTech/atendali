/** Arquivo de calendário (.ics) de uma reserva: abre no Google Agenda, Apple e Outlook. */
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export interface IcsEvent {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  description?: string;
}

/** Um calendário com um ou vários eventos (reserva com vários procedimentos). */
export function buildIcsMany(events: IcsEvent[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Skedulei//Reservas//PT-BR',
    'CALSCALE:GREGORIAN',
    ...events.flatMap(eventLines),
    'END:VCALENDAR',
  ].join('\r\n');
}

export const buildIcs = (e: IcsEvent): string => buildIcsMany([e]);

function eventLines(e: IcsEvent): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${e.uid}@skedulei`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(e.endsAt)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(e.title)}`,
    'END:VALARM',
    'END:VEVENT',
  ];
}

export function downloadIcs(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
