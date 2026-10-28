export interface JwtPayload {
  /** userId */
  sub: string;
  email: string;
  /** Sessão (aparelho) que emitiu o token. */
  sid?: string;
  /** Emitido em (segundos) — preenchido pelo jsonwebtoken. */
  iat?: number;
  /** Tokens de propósito especial (ex.: 'mfa') não valem como login. */
  purpose?: string;
}
