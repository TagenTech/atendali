import type { Segment } from '@agendei/contracts';
import { Brush, CalendarClock, HeartPulse, Scissors, Smile, Sparkles, Stethoscope, type LucideIcon } from 'lucide-react';

const ICONS: Record<Segment, LucideIcon> = {
  SALAO_BELEZA: Scissors,
  BARBEARIA: Brush,
  ESTETICA: Sparkles,
  CLINICA_MEDICA: Stethoscope,
  ODONTOLOGIA: Smile,
  TERAPIAS: HeartPulse,
  OUTRO: CalendarClock,
};

export function SegmentIcon({ segment, className }: { segment: Segment; className?: string }) {
  const Icon = ICONS[segment];
  return <Icon className={className} aria-hidden />;
}
