import type { AppointmentStatus } from '@skedulei/contracts';

/** Estilo do cartão na grade por status (os "em aberto" usam a cor do profissional). */
export const STATUS_STYLE: Record<AppointmentStatus, string | null> = {
  AGENDADO: null,
  CONFIRMADO: null,
  CHEGOU: 'bg-warning-soft text-warning-soft-foreground',
  EM_ATENDIMENTO: 'bg-primary text-primary-foreground',
  CONCLUIDO: 'bg-success-soft text-success-soft-foreground',
  FALTOU: 'bg-danger-soft text-danger-soft-foreground',
  CANCELADO: 'bg-muted text-muted-foreground line-through',
};

export const STATUS_DOT: Record<AppointmentStatus, string> = {
  AGENDADO: 'bg-muted-foreground',
  CONFIRMADO: 'bg-success',
  CHEGOU: 'bg-warning',
  EM_ATENDIMENTO: 'bg-primary',
  CONCLUIDO: 'bg-success',
  FALTOU: 'bg-danger',
  CANCELADO: 'bg-border',
};
