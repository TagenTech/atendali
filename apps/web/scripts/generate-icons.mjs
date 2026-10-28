// Gera os ícones PNG do PWA a partir de scripts/icon.svg.  Uso: node scripts/generate-icons.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(createRequire(import.meta.url).resolve('next'));
const sharp = require('sharp');

const svg = readFileSync(join(here, 'icon.svg'), 'utf8');
// Maskable: fundo sem cantos e arte reduzida para caber na zona segura (80%).
const maskable = svg
  .replace('rx="120"', 'rx="0"')
  .replace('<g id="art">', '<g id="art" transform="translate(256 256) scale(0.78) translate(-256 -265)">');

const out = join(here, '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

const jobs = [
  [svg, 'icon-192.png', 192],
  [svg, 'icon-512.png', 512],
  [maskable, 'icon-maskable-512.png', 512],
  [maskable, 'apple-touch-icon.png', 180],
];
for (const [src, name, size] of jobs) {
  await sharp(Buffer.from(src)).resize(size, size).png().toFile(join(out, name));
  console.log('ok', name);
}
