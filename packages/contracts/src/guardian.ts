/** Quem marca em nome de outra pessoa (pediatria, família): responsável × paciente. */
export const GUARDIAN_RELATIONSHIPS = ['MAE', 'PAI', 'AVO', 'FAMILIAR', 'RESPONSAVEL'] as const;
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];

export const GUARDIAN_RELATIONSHIP_LABEL: Record<GuardianRelationship, string> = {
  MAE: 'Mãe',
  PAI: 'Pai',
  AVO: 'Avó ou avô',
  FAMILIAR: 'Outro familiar',
  RESPONSAVEL: 'Responsável legal',
};

export const isGuardianRelationship = (v: unknown): v is GuardianRelationship => typeof v === 'string' && (GUARDIAN_RELATIONSHIPS as readonly string[]).includes(v);

/** Para comparar nomes: sem acento, minúsculas e espaços únicos ("  JOÃO  silva" = "joao silva"). */
export function normalizePersonName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export const samePerson = (a: string, b: string) => normalizePersonName(a) === normalizePersonName(b);

/** Chave de quem já existe: o mesmo telefone pode ser de vários pacientes (irmãos), então vale telefone + nome. */
export const personKey = (phone: string, name: string) => `${phone}|${normalizePersonName(name)}`;

/** "3 anos", "8 meses", "11 anos" (sem data → null). `today` no formato AAAA-MM-DD. */
export function ageLabel(birthDate: string | null | undefined, today: string): string | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate > today) return null;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let months = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0);
  if (months < 0) months = 0;
  if (months < 24) return months <= 1 ? `${months} mês` : `${months} meses`;
  const years = Math.floor(months / 12);
  return `${years} anos`;
}
