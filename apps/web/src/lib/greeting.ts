export function greeting(date = new Date()): { text: string; emoji: string } {
  const h = date.getHours();
  if (h < 5) return { text: 'Boa noite', emoji: '🌙' };
  if (h < 12) return { text: 'Bom dia', emoji: '☀️' };
  if (h < 18) return { text: 'Boa tarde', emoji: '🌤️' };
  return { text: 'Boa noite', emoji: '🌙' };
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

const longDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export function todayLabel(date = new Date()): string {
  const s = longDate.format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
