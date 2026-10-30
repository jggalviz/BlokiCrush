#!/usr/bin/env node
'use strict';

/**
 * Optimiza el logotipo de BlokiCrush.
 *
 *   npm run build:logo
 *
 * El vector editable vive en `design/BLOKICRUSH-LOGO.svg` (1774 x 887 px,
 * proporcion 2:1). El maestro rasterizado es `design/BlokiCrush Logo.png`: se
 * regenera desde el SVG cuando el vector es mas nuevo (`--from-svg` fuerza el
 * proceso) y de ahi sale el WebP servido. Igual que el arte del case, el
 * maestro se guarda fuera de `public/` porque todo lo que hay en
 * `public/src/**` se publica en el CDN y el PNG completo viajaria en cada
 * deploy.
 *
 * El script escribe `public/src/assets/BLOKICRUSH-LOGO.webp` respetando
 * el contrato de `test/frontendAssets.test.js`:
 *   - WebP estatico con alfa real (VP8X + bloque ALPH) y sin bloque ANIM;
 *   - 900 x 450 px, la misma proporcion 2:1 del maestro. El CSS lo pinta a
 *     ~330 px de ancho en un telefono de 430 px (78 % del marco) y hasta ~505 px
 *     en una tablet alta (768 x 1366), asi que 900 cubre 3x en el caso normal y
 *     ~1,8x en el mas grande, sin reescalar de forma visible;
 *   - menos de 200 KB;
 *   - alfa exacta: `alphaQuality: 100` comprime el canal alfa sin perdida, asi
 *     que cada pixel conserva la transparencia del maestro redimensionado.
 *
 * Calidad 84 y no 92: a 330 px de ancho (y hasta 505 px en tablet alta) el error
 * es indistinguible, mientras que en 900 px nativo cada punto de calidad cuesta
 * ~4 KB sobre el archivo final (el arte lleva degradados y brillos, que son
 * caros de comprimir). `minSize` desactiva los keyframes y recorta peso sin
 * tocar un pixel.
 *
 * Es idempotente: misma entrada y misma calidad -> mismos bytes.
 */

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const VECTOR = path.join(ROOT, 'design', 'BLOKICRUSH-LOGO.svg');
const SOURCE = path.join(ROOT, 'design', 'BlokiCrush Logo.png');
const TARGET = path.join(ROOT, 'public', 'src', 'assets', 'BLOKICRUSH-LOGO.webp');
const DEPLOY = path.join(
  ROOT,
  '.vercel',
  'output',
  'static',
  'src',
  'assets',
  'BLOKICRUSH-LOGO.webp'
);

// Contrato del logo: lienzo 2:1 (1774 / 887) y un ancho servido acotado.
const ASPECT = 1774 / 887;
const WIDTH = Number(process.env.LOGO_WIDTH || 900);
const MAX_BYTES = 200 * 1024;

// Ver el comentario de cabecera: 84 deja el archivo muy por debajo del tope sin
// que se note entre 330 y 505 px de ancho (el rango que pinta el CSS).
const QUALITY = Number(process.env.LOGO_QUALITY || 84);

/**
 * Rasteriza el maestro PNG desde el SVG cuando el vector es mas nuevo (o cuando
 * se pide con `--from-svg`). El SVG declara 1774 x 887, asi que a densidad 72
 * sharp produce exactamente el maestro del contrato.
 */
async function ensureMaster() {
  const force = process.argv.includes('--from-svg');
  if (!fs.existsSync(VECTOR)) {
    if (!fs.existsSync(SOURCE)) {
      throw new Error(`Faltan el vector y el maestro del logo: ${path.relative(ROOT, VECTOR)}`);
    }
    return;
  }
  const stale =
    force ||
    !fs.existsSync(SOURCE) ||
    fs.statSync(VECTOR).mtimeMs > fs.statSync(SOURCE).mtimeMs;
  if (!stale) return;

  const png = await sharp(fs.readFileSync(VECTOR), { density: 72 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(SOURCE, png);
  console.log(
    `vector  ${path.relative(ROOT, VECTOR)} -> ${path.relative(ROOT, SOURCE)}  ` +
      `${(png.length / 1024).toFixed(1)} kB`
  );
}

/** Decodifica una imagen en un unico RGBA para comparar el alfa pixel a pixel. */
async function decode(file) {
  const meta = await sharp(file).metadata();
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { meta, data, info };
}

(async () => {
  await ensureMaster();
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Falta el maestro del logo: ${path.relative(ROOT, SOURCE)}`);
  }

  const source = await decode(SOURCE);
  if (!source.meta.hasAlpha) {
    throw new Error('El maestro del logo debe traer canal alfa: el tema lo pinta sobre el cielo');
  }
  if (Math.abs(source.info.width / source.info.height - ASPECT) > 0.002) {
    throw new Error(
      `El maestro mide ${source.info.width}x${source.info.height} y el contrato exige 2:1: ` +
        'actualiza el test y build-logo-asset.js antes de publicarlo'
    );
  }

  const width = Math.min(WIDTH, source.info.width);
  const height = Math.round(width / ASPECT);

  // Se codifica desde el RGBA ya reescalado: asi la comparacion de alfa es
  // exacta y el WebP no arrastra el perfil del PNG original.
  const canvas = await sharp(SOURCE)
    .resize({ width, height, fit: 'fill', kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const webp = await sharp(canvas.data, {
    raw: { width: canvas.info.width, height: canvas.info.height, channels: 4 }
  })
    .webp({
      quality: QUALITY,
      alphaQuality: 100,
      effort: 6,
      smartSubsample: true,
      minSize: true
    })
    .toBuffer();

  const output = await decode(webp);
  if (output.meta.format !== 'webp') {
    throw new Error(`La salida no es WebP (${output.meta.format})`);
  }
  if (output.meta.pages) {
    throw new Error('El logo ya no es animado: la salida no debe traer bloque ANIM');
  }
  if (output.info.width !== width || output.info.height !== height) {
    throw new Error(
      `El WebP mide ${output.info.width}x${output.info.height}, se esperaba ${width}x${height}`
    );
  }

  // Alfa exacta: el canal alfa viaja sin perdida, byte a byte contra el lienzo.
  let alphaDiff = 0;
  for (let i = 3; i < canvas.data.length; i += 4) {
    if (canvas.data[i] !== output.data[i]) alphaDiff += 1;
  }
  if (alphaDiff > 0) {
    throw new Error(`El WebP altero el alfa en ${alphaDiff} pixeles: revisa alphaQuality`);
  }

  if (webp.length >= MAX_BYTES) {
    throw new Error(
      `El logo pesa ${(webp.length / 1024).toFixed(1)} KB y el contrato exige menos de ` +
        `${MAX_BYTES / 1024} KB: baja LOGO_QUALITY antes de publicarlo`
    );
  }

  fs.writeFileSync(TARGET, webp);
  // `.vercel/output` es un hard link del repo: si se rompe, se refresca a mano.
  if (fs.existsSync(DEPLOY) && fs.statSync(DEPLOY).ino !== fs.statSync(TARGET).ino) {
    fs.copyFileSync(TARGET, DEPLOY);
  }

  const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
  console.log(
    `origen  ${path.relative(ROOT, SOURCE)}  ${source.info.width}x${source.info.height}  ` +
      `${kb(fs.statSync(SOURCE).size)}`
  );
  console.log(
    `salida  ${path.relative(ROOT, TARGET)}  ${output.info.width}x${output.info.height}  ` +
      `${kb(webp.length)} (q=${QUALITY}, alfa intacta)`
  );
  console.log(
    `ahorro  ${(100 - (webp.length / fs.statSync(SOURCE).size) * 100).toFixed(1)} % menos que el maestro`
  );
})().catch((err) => {
  console.error(`build:logo · ${err.message}`);
  process.exitCode = 1;
});
