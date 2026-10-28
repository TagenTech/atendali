import type { Request } from 'express';

/** IP e navegador de quem fez a requisição (para auditoria e sessões). */
export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
}

export function contextOf(req: Request): RequestContext {
  return { ip: req.ip ?? null, userAgent: req.headers['user-agent']?.slice(0, 255) ?? null };
}
