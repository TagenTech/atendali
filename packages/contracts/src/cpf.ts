/** CPF guardado só com dígitos. Validação pelos dígitos verificadores. */

export function normalizeCpf(input: string): string {
  return input.replace(/\D/g, '').slice(0, 11);
}

export function isValidCpf(input: string): boolean {
  const cpf = normalizeCpf(input);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

/** Máscara progressiva: '123456789' → '123.456.789'. */
export function formatCpf(input: string): string {
  const d = normalizeCpf(input);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** '12345678909' → '***.456.789-**' (para exibir sem expor o número inteiro). */
export function maskCpf(cpf: string): string {
  const d = normalizeCpf(cpf);
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : '';
}
