import { PASSWORD_MIN_LENGTH } from './auth';

/** Senhas que aparecem em todo vazamento: recusadas mesmo com 8+ caracteres. */
const COMMON = new Set([
  '12345678', '123456789', '1234567890', '123123123', '11111111', '00000000', '87654321', '12341234',
  'password', 'password1', 'password123', 'passw0rd', 'senha123', 'senha1234', 'senha12345', 'senhasenha',
  'minhasenha', 'mudar123', 'mudar@123', 'abc12345', 'abcd1234', 'abcdefgh', 'qwertyui', 'qwerty123',
  'qwertyuiop', 'asdfghjk', 'asdf1234', 'iloveyou', 'letmein1', 'admin123', 'agendei123', 'agendei1',
  'brasil123', 'brasil2020', 'corinthians', 'flamengo', 'flamengo1', 'palmeiras', 'gabriel123',
]);

const sequential = (s: string) => {
  const step = s.charCodeAt(1) - s.charCodeAt(0);
  if (Math.abs(step) !== 1) return false;
  for (let i = 1; i < s.length; i++) if (s.charCodeAt(i) - s.charCodeAt(i - 1) !== step) return false;
  return true;
};

/** Comum demais para ser segura: lista conhecida, um caractere repetido ou sequência (12345678, abcdefgh). */
export function isCommonPassword(pw: string): boolean {
  const p = pw.trim().toLowerCase();
  if (!p) return false;
  return COMMON.has(p) || new Set(p).size === 1 || sequential(p);
}

export const PASSWORD_COMMON_MESSAGE = 'Essa senha é muito comum. Misture palavras, números ou símbolos';

/** Primeira regra de senha que falhar (mensagem pronta para a tela), ou null. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN_LENGTH) return `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres`;
  if (pw.length > 128) return 'Use no máximo 128 caracteres';
  if (isCommonPassword(pw)) return PASSWORD_COMMON_MESSAGE;
  return null;
}
