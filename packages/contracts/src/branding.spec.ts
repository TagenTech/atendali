import { BRAND_COLORS, brandHex, canonicalizeBrandColor, isBrandColor, isBrandColorValue, isBrandHex, sniffImageMime } from './branding';

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
  it('só aceita as cores da paleta ou um tom #rrggbb', () => {
    expect(isBrandColor('rosa')).toBe(true);
    expect(isBrandColor('#ff0000')).toBe(false);
    expect(isBrandColor('constructor')).toBe(false);
    expect(isBrandHex('#ff0000')).toBe(true);
    expect(isBrandHex('#FF0000')).toBe(false);
    expect(isBrandHex('#fff')).toBe(false);
    expect(isBrandColorValue('rosa')).toBe(true);
    expect(isBrandColorValue('#00aabb')).toBe(true);
    expect(isBrandColorValue('constructor')).toBe(false);
    expect(Object.values(BRAND_COLORS).every((c) => /^#[0-9a-f]{6}$/.test(c.hex))).toBe(true);
  });

  it('resolve e normaliza o tom da página pública', () => {
    expect(brandHex(null)).toBeNull();
    expect(brandHex('rosa')).toBe('#d6409f');
    expect(brandHex('#00aabb')).toBe('#00aabb');
    expect(brandHex('constructor')).toBeNull();
    expect(canonicalizeBrandColor(null)).toBeNull();
    expect(canonicalizeBrandColor('azul')).toBe('azul');
    expect(canonicalizeBrandColor('#d6409f')).toBe('rosa');
    expect(canonicalizeBrandColor('#112233')).toBe('#112233');
  });
});
