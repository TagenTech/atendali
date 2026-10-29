import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getStoredTheme, themeInitScript } from './theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('quem nunca escolheu abre no claro; só vale o que foi escolhido', () => {
    expect(getStoredTheme()).toBe('light');
    localStorage.setItem('skedulei_theme', 'dark');
    expect(getStoredTheme()).toBe('dark');
    localStorage.setItem('skedulei_theme', 'system');
    expect(getStoredTheme()).toBe('system');
    localStorage.setItem('skedulei_theme', 'qualquer');
    expect(getStoredTheme()).toBe('light');
  });

  it('localStorage indisponível não quebra a leitura nem a gravação', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('negado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('negado');
    });
    expect(getStoredTheme()).toBe('light');
    expect(() => applyTheme('dark')).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('applyTheme marca a página e guarda; "system" deixa o sistema decidir', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('skedulei_theme')).toBe('dark');
    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem('skedulei_theme')).toBe('system');
  });

  it('o script inline aplica o tema antes da pintura', () => {
    const run = () => new Function(themeInitScript)();
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    localStorage.setItem('skedulei_theme', 'dark');
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    localStorage.setItem('skedulei_theme', 'system');
    document.documentElement.removeAttribute('data-theme');
    run();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('negado');
    });
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
