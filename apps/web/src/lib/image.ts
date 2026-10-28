/** Lê o arquivo, reduz (lado maior = maxSide) e devolve um data URL JPEG/PNG pequeno para enviar à API. */
export async function resizeImage(file: File, maxSide: number, maxBytes: number): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error('Escolha uma imagem PNG, JPG ou WebP');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não conseguiu preparar a imagem');
  // PNG com transparência (logo) fica PNG; foto vira JPEG com qualidade decrescente até caber.
  const keepPng = file.type === 'image/png';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const sizeOf = (url: string) => Math.ceil(((url.length - url.indexOf(',') - 1) * 3) / 4);
  if (keepPng) {
    const png = canvas.toDataURL('image/png');
    if (sizeOf(png) <= maxBytes) return png;
  }
  for (const q of [0.88, 0.78, 0.68, 0.55, 0.4]) {
    const jpg = canvas.toDataURL('image/jpeg', q);
    if (sizeOf(jpg) <= maxBytes) return jpg;
  }
  throw new Error('A imagem ficou grande demais. Tente uma menor.');
}
