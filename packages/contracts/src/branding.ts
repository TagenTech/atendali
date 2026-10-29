/** Personalização da página pública: logo, imagem de fundo, cor e frase de boas-vindas. */

export const BRAND_COLORS = {
  violeta: { label: 'Violeta', hex: '#6c5ae6' },
  rosa: { label: 'Rosa', hex: '#d6409f' },
  vermelho: { label: 'Vermelho', hex: '#d64545' },
  laranja: { label: 'Laranja', hex: '#e07a1f' },
  verde: { label: 'Verde', hex: '#1f9d6b' },
  azul: { label: 'Azul', hex: '#2b6fd6' },
  grafite: { label: 'Grafite', hex: '#3d4452' },
  dourado: { label: 'Dourado', hex: '#a8812c' },
} as const;
export type BrandColor = keyof typeof BRAND_COLORS;
export const BRAND_COLOR_KEYS = Object.keys(BRAND_COLORS) as BrandColor[];
/** Tom livre da página pública (`#rrggbb`). */
export type BrandHex = `#${string}`;
export type BrandColorValue = BrandColor | BrandHex;

const BRAND_HEX_RE = /^#[0-9a-f]{6}$/;

export const isBrandColor = (v: unknown): v is BrandColor => typeof v === 'string' && Object.prototype.hasOwnProperty.call(BRAND_COLORS, v);
export const isBrandHex = (v: unknown): v is BrandHex => typeof v === 'string' && BRAND_HEX_RE.test(v);
/** Paleta ou hexadecimal de 6 dígitos. */
export const isBrandColorValue = (v: unknown): v is BrandColorValue => isBrandColor(v) || isBrandHex(v);

/** Hex da paleta, do tom livre, ou null (padrão do Skedulei). */
export function brandHex(v: string | null | undefined): string | null {
  if (!v) return null;
  if (isBrandColor(v)) return BRAND_COLORS[v].hex;
  const s = v.trim().toLowerCase();
  return BRAND_HEX_RE.test(s) ? s : null;
}

/** Hex da paleta vira a chave correspondente; o resto fica em minúsculas. */
export function canonicalizeBrandColor(v: string | null): BrandColorValue | null {
  if (v == null) return null;
  const s = v.trim().toLowerCase();
  if (isBrandColor(s)) return s;
  if (!isBrandHex(s)) return null;
  return BRAND_COLOR_KEYS.find((k) => BRAND_COLORS[k].hex === s) ?? s;
}

export const BrandImageKind = { LOGO: 'logo', COVER: 'cover' } as const;
export type BrandImageKind = (typeof BrandImageKind)[keyof typeof BrandImageKind];

export const BRAND_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;
/** Tamanho máximo do arquivo já reduzido pelo navegador (bytes). */
export const BRAND_IMAGE_MAX_BYTES: Record<BrandImageKind, number> = { logo: 300_000, cover: 600_000 };
/** Lado maior, em pixels, para onde o navegador reduz a imagem antes de enviar. */
export const BRAND_IMAGE_MAX_SIDE: Record<BrandImageKind, number> = { logo: 512, cover: 1600 };
export const TAGLINE_MAX = 160;

/** Descobre o tipo pela assinatura dos bytes (nunca confia no que o cliente declarou). SVG não é aceito. */
export function sniffImageMime(bytes: Uint8Array): (typeof BRAND_IMAGE_MIMES)[number] | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export interface BrandingDto {
  /** Endereço público da imagem (com versão para trocar o cache); null = sem imagem. */
  logoUrl: string | null;
  coverUrl: string | null;
  brandColor: BrandColorValue | null;
  tagline: string | null;
}

export interface UploadBrandImageRequest {
  /** "data:image/jpeg;base64,…" */
  dataUrl: string;
}
