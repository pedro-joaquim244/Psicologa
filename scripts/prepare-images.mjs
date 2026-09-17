import sharp from 'sharp';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = {
  sala: 'sala.png', retrato: 'Psicologa32.png', escuta: 'Poltrona.png',
  escrita: 'LivroAberto.png', presencial: 'consultorio.jpg', natureza: 'natureza.jpg',
  online: 'online.png', caminho: 'caminho.png', botanica: 'botanica.png', recomeco: 'recomeco.png',
};
const output = path.join(root, 'public/images/optimized');
await mkdir(output, { recursive: true });
const manifest = {};
let originalBytes = 0;
let optimizedBytes = 0;
for (const [name, source] of Object.entries(sources)) {
  const input = path.join(root, 'public/images', source);
  const { width, height } = await sharp(input).metadata();
  const widths = [...new Set([480, 960, 1440, 1920, Math.min(width, 2400)].filter(w => w <= width))].sort((a, b) => a - b);
  const variants = [];
  for (const size of widths) {
    const file = `${name}-${size}.webp`;
    await sharp(input).rotate().resize({ width: size, withoutEnlargement: true }).webp({ quality: 86, effort: 5 }).toFile(path.join(output, file));
    variants.push({ src: `images/optimized/${file}`, width: size });
  }
  const last = variants.at(-1);
  manifest[name] = { src: last.src, width, height, variants };
  originalBytes += (await stat(input)).size;
  optimizedBytes += (await stat(path.join(root, 'public', last.src))).size;
}
await writeFile(path.join(root, 'src/config/image-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${Object.keys(manifest).length} fotos: ${(originalBytes / 1e6).toFixed(2)} MB de originais → ${(optimizedBytes / 1e6).toFixed(2)} MB nas maiores versões WebP. Sem ampliar os originais.`);
