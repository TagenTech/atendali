import { safeNext } from './redirect';

describe('safeNext (anti open redirect)', () => {
  it.each([
    ['/agenda', '/agenda'],
    ['/alunos/123?aba=aulas#x', '/alunos/123?aba=aulas#x'],
    [null, '/inicio'],
    ['', '/inicio'],
    ['https://evil.com', '/inicio'],
    ['//evil.com', '/inicio'],
    ['/\\evil.com', '/inicio'],
    ['/\\/evil.com', '/inicio'],
    ['javascript:alert(1)', '/inicio'],
    ['/%2F%2Fevil.com', '/%2F%2Fevil.com'],
  ])('%p → %p', (input, expected) => expect(safeNext(input)).toBe(expected));
});
