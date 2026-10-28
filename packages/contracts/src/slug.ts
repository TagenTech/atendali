/** Endereço público do negócio: skedulei.app/<slug>. */

export const SLUG_MAX_LENGTH = 48;

/** Rotas do próprio app que não podem virar endereço de negócio. */
export const RESERVED_SLUGS = new Set([
  'api', 'app', 'admin', 'login', 'cadastro', 'entrar', 'sair', 'inicio', 'onboarding', 'convite', 'agenda',
  'clientes', 'equipe', 'servicos', 'financeiro', 'relatorios', 'configuracoes', 'mais', 'termos', 'privacidade',
  'contato', 'offline', 'reserva', 'verificar-email', 'esqueci-senha', 'redefinir-senha', 'ajuda', 'suporte', 'blog', 'precos', 'www', 'static', 'icons',
]);

/** "Studio Bella & Cia." → "studio-bella-cia". */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/.test(slug) && !slug.includes('--') && !RESERVED_SLUGS.has(slug);
}
