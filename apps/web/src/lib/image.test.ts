import { afterEach, describe, expect, it, vi } from 'vitest';
import { resizeImage } from './image';

const file = (type: string) => new File(['x'], 'a', { type });
/** Data URL com `bytes` bytes de conteúdo (base64 de 4 em 4 caracteres = 3 bytes). */
const dataUrl = (mime: string, bytes: number) => `data:${mime};base64,${'A'.repeat(Math.ceil((bytes * 4) / 3))}`;

function mockCanvas(opts: { width?: number; height?: number; ctx?: boolean; png?: number; jpg?: (q: number) => number }) {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: opts.width ?? 4000, height: opts.height ?? 2000, close })));
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => (opts.ctx === false ? null : { drawImage: vi.fn() }),
    toDataURL: vi.fn((type: string, q?: number) => (type === 'image/png' ? dataUrl('image/png', opts.png ?? 10) : dataUrl('image/jpeg', opts.jpg?.(q!) ?? 10))),
  };
  const original = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => (tag === 'canvas' ? canvas : original(tag))) as typeof document.createElement);
  return { canvas, close };
}

describe('resizeImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('recusa o que não é PNG, JPG ou WebP', async () => {
    await expect(resizeImage(file('image/gif'), 800, 1000)).rejects.toThrow(/PNG, JPG ou WebP/);
    await expect(resizeImage(file('application/pdf'), 800, 1000)).rejects.toThrow();
  });

  it('reduz o lado maior até o limite, sem ampliar imagem pequena', async () => {
    const big = mockCanvas({ width: 4000, height: 2000 });
    await resizeImage(file('image/jpeg'), 800, 1_000_000);
    expect(big.canvas.width).toBe(800);
    expect(big.canvas.height).toBe(400);
    expect(big.close).toHaveBeenCalled();
    vi.restoreAllMocks();
    const small = mockCanvas({ width: 100, height: 50 });
    await resizeImage(file('image/webp'), 800, 1_000_000);
    expect(small.canvas.width).toBe(100);
    expect(small.canvas.height).toBe(50);
    vi.restoreAllMocks();
    const tiny = mockCanvas({ width: 1, height: 100_000 });
    await resizeImage(file('image/jpeg'), 10, 1_000_000);
    expect(tiny.canvas.width).toBe(1);
  });

  it('PNG que cabe continua PNG (logo com transparência)', async () => {
    mockCanvas({ png: 500 });
    expect(await resizeImage(file('image/png'), 800, 1000)).toMatch(/^data:image\/png/);
  });

  it('PNG grande demais vira JPEG; foto vai baixando a qualidade até caber', async () => {
    const m = mockCanvas({ png: 5000, jpg: (q) => (q > 0.7 ? 5000 : 500) });
    expect(await resizeImage(file('image/png'), 800, 1000)).toMatch(/^data:image\/jpeg/);
    expect(m.canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.68);
  });

  it('não cabendo nem na pior qualidade, pede uma imagem menor', async () => {
    mockCanvas({ jpg: () => 99_999 });
    await expect(resizeImage(file('image/jpeg'), 800, 1000)).rejects.toThrow(/grande demais/);
  });

  it('navegador sem canvas 2D', async () => {
    mockCanvas({ ctx: false });
    await expect(resizeImage(file('image/jpeg'), 800, 1000)).rejects.toThrow(/não conseguiu preparar/);
  });
});
