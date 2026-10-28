import { BRAND_COLORS, isBrandColor, sniffImageMime } from './branding';

describe('branding', () => {
  it('reconhece png, jpeg e webp pelos bytes', () => {
    expect(sniffImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(sniffImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBP');
    expect(sniffImageMime(webp)).toBe('image/webp');
  });
  it('recusa svg, html e arquivos vazios', () => {
    expect(sniffImageMime(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImageMime(new TextEncoder().encode('<html><script>alert(1)</script>'))).toBeNull();
    expect(sniffImageMime(new Uint8Array())).toBeNull();
  });
  it('só aceita as cores da paleta', () => {
    expect(isBrandColor('rosa')).toBe(true);
    expect(isBrandColor('#ff0000')).toBe(false);
    expect(isBrandColor('constructor')).toBe(false);
    expect(Object.values(BRAND_COLORS).every((c) => /^#[0-9a-f]{6}$/.test(c.hex))).toBe(true);
  });
});
