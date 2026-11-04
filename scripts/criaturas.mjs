// Convierte las imágenes generadas (art/criaturas/*.png) en las que usa la app
// (apps/app/src/assets/criaturas/*.webp). Ver docs/arte/prompt-imagenes.md.
//
//   pnpm criaturas                     # rutas por defecto
//   node scripts/criaturas.mjs ORIGEN DESTINO
//
// - Criaturas y huevo: si vienen con fondo blanco liso, lo vuelve transparente
//   (relleno desde los bordes, así no borra el blanco de dentro del dibujo);
//   recorta el margen, centra en un cuadrado y guarda a 512 y 128 px.
// - Fondos: recorte cuadrado a 1024 px.
// - El icono se deja en art/icono-1024.png como PNG real (los generadores a veces
//   guardan JPEG con extensión .png, y `tauri icon` no los acepta).

import { mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const SPECIES = [
  'panda',
  'tortuga',
  'rottweiler',
  'yorkshire',
  'napoleon',
  'cervantes',
  'leonidas',
  'cesar',
  'medusa',
  'poseidon',
  'blas',
  'rana',
  'pulpo',
  'balon',
  'perezoso',
  'mimo',
];
const BACKGROUNDS = [
  'coliseo',
  'barco',
  'biblioteca',
  'playa',
  'dojo',
  'estadio',
  'templo',
  'cine',
];
const CREATURES = ['huevo', ...SPECIES.flatMap((s) => [1, 2, 3, 4].map((n) => `${s}-${n}`))];
const EXPECTED = [...CREATURES, ...BACKGROUNDS.map((b) => `fondo-${b}`), 'icono'];

/** Distancia máxima al blanco puro para considerar un píxel "fondo". */
const WHITE_TOLERANCE = 18;
/** Margen alrededor de la criatura tras recortar (fracción del lado). */
const PADDING = 0.06;

const [src = 'art/criaturas', out = 'apps/app/src/assets/criaturas'] = process.argv.slice(2);

/** Vuelve transparente el fondo blanco conectado con los bordes. */
async function whiteToAlpha(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const isBg = (i) =>
    data[i * 4 + 3] > 0 &&
    255 - data[i * 4] <= WHITE_TOLERANCE &&
    255 - data[i * 4 + 1] <= WHITE_TOLERANCE &&
    255 - data[i * 4 + 2] <= WHITE_TOLERANCE;
  // Si las esquinas ya son transparentes, la imagen ya trae canal alfa.
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  if (corners.every((i) => data[i * 4 + 3] === 0))
    return sharp(input).ensureAlpha().png().toBuffer();

  const seen = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  while (stack.length > 0) {
    const i = stack.pop();
    if (seen[i] || !isBg(i)) continue;
    seen[i] = 1;
    data[i * 4 + 3] = 0;
    const x = i % width;
    if (x > 0) stack.push(i - 1);
    if (x < width - 1) stack.push(i + 1);
    if (i >= width) stack.push(i - width);
    if (i < (height - 1) * width) stack.push(i + width);
  }
  return sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

async function creature(file, name) {
  const transparent = await whiteToAlpha(join(src, file));
  const trimmed = await sharp(transparent)
    .trim({ threshold: 1 })
    .toBuffer({ resolveWithObject: true });
  const side = Math.round(Math.max(trimmed.info.width, trimmed.info.height) * (1 + 2 * PADDING));
  const square = await sharp({
    create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: trimmed.data, gravity: 'center' }])
    .png()
    .toBuffer();
  for (const size of [512, 128])
    await sharp(square)
      .resize(size, size)
      .webp({ quality: 88, alphaQuality: 90 })
      .toFile(join(out, `${name}-${size}.webp`));
}

async function background(file, name) {
  await sharp(join(src, file))
    .resize(1024, 1024, { fit: 'cover' })
    .webp({ quality: 82 })
    .toFile(join(out, `${name}.webp`));
}

const files = new Map(
  (await readdir(src).catch(() => []))
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .map((f) => [f.slice(0, -4).toLowerCase(), f]),
);
await mkdir(out, { recursive: true });

let done = 0;
const failed = [];
for (const name of EXPECTED) {
  const file = files.get(name);
  if (!file || name === 'icono') continue;
  try {
    if (name.startsWith('fondo-')) await background(file, name);
    else await creature(file, name);
    done++;
  } catch (e) {
    failed.push(`${file} (${e.message})`);
  }
}

if (files.has('icono')) {
  await sharp(join(src, files.get('icono')))
    .resize(1024, 1024)
    .ensureAlpha()
    .png()
    .toFile(join(src, '..', 'icono-1024.png'));
  console.log('Icono listo: pnpm --filter @farmhabit/app tauri icon ../../art/icono-1024.png');
}

const missing = EXPECTED.filter((n) => !files.has(n));
const unknown = [...files.keys()].filter((n) => !EXPECTED.includes(n));
console.log(`Convertidas ${done} imágenes en ${resolve(out)}`);
if (failed.length > 0) console.log(`No se han podido convertir: ${failed.join(', ')}`);
if (missing.length > 0) console.log(`Faltan ${missing.length}: ${missing.join(', ')}`);
if (unknown.length > 0) console.log(`Nombres que no se usan (¿errata?): ${unknown.join(', ')}`);
