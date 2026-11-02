#!/usr/bin/env node
'use strict';

/**
 * Publica el logotipo de BlokiCrush.
 *
 *   npm run build:logo                  # GIF maestro -> WebP animado (ruta viva)
 *   npm run build:logo -- --estatico    # ruta antigua: SVG/PNG -> WebP estatico
 *
 * El maestro es `design/BROKI_crush_animacion-logo-LENTO.gif`: 493 x 509 px,
 * seis fotogramas en bucle infinito y alfa real. Es el lockup completo (mascota
 * con gorra + "BLOKI CRUSH" en letras de caramelo) dentro de una silueta
 * redondeada, o sea un cuadrado, no el wordmark 2:1 de antes. El maestro vive
 * fuera de `public/` porque todo lo que hay en `public/src/**` se publica en el
 * CDN y el GIF pesa 606 kB: solo hace falta para reexportar.
 *
 * Los seis fotogramas no duran lo mismo: el primero es el arranque corto
 * (500 ms) y el resto sostiene la animacion (1,7 s + 4 x 2,5 s) hasta completar
 * 12,2 s por vuelta. Es la version «lento corregido» del ciclo; el lockup
 * anterior —cinco fotogramas de 500 ms— queda archivado en
 * `design/BROKI_crush_animacion-logo-rapido.gif` y no se publica.
 *
 * El script escribe `public/src/assets/BLOKICRUSH-LOGO.webp` respetando el
 * contrato de `test/frontendAssets.test.js`:
 *   - WebP animado: VP8X con el bit de animacion, bloque ANIM y seis ANMF;
 *   - 320 x 320 px, cuadrado. La caja del CSS tambien es 1:1 (41 px en un
 *     movil de 390 px, 166 px en escritorio), asi que 320 cubre casi 2x en
 *     pantalla retina de escritorio y sobra en el movil;
 *   - recortado a la tinta (489 x 480 desde 1,3) y centrado en un lienzo
 *     cuadrado transparente: el 1,9 % que separa ancho y alto se reparte a los
 *     lados en vez de desplazar la mascota o forzar un `object-fit` raro;
 *   - los seis fotogramas y sus tiempos intactos, en bucle infinito (loop 0);
 *   - alfa sin perdida (`alphaQuality: 100`), que es lo que deja el fondo del
 *     marco a la vista alrededor de la silueta;
 *   - menos de 200 KB: a 320 px y q=80 queda en ~140 KB (el GIF pesa 606 kB).
 *
 * Tambien escribe `BLOKICRUSH-LOGO-quieto.webp`: el primer fotograma como WebP
 * estatico (~40 KB) para el `<picture>` que sirve el HTML cuando el usuario pide
 * movimiento reducido. Sale del mismo lienzo, asi que entre las dos versiones
 * solo cambia el movimiento.
 *
 * `--estatico` conserva la ruta anterior (vector `BLOKICRUSH-LOGO.svg` ->
 * maestro `BlokiCrush Logo.png` -> WebP estatico de 900 x 450) para volver al
 * wordmark sin rebuscar en el historial. El test valida la ruta animada, que es
 * la publicada; el resto de scripts de arte (`build:art`, `build:bg`, ...) no
 * cambian.
 *
 * Es idempotente: misma entrada y misma calidad -> mismos bytes.
 */

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const ANIM_SOURCE = path.join(ROOT, 'design', 'BROKI_crush_animacion-logo-LENTO.gif');
const VECTOR = path.join(ROOT, 'design', 'BLOKICRUSH-LOGO.svg');
const STATIC_SOURCE = path.join(ROOT, 'design', 'BlokiCrush Logo.png');
const TARGET = path.join(ROOT, 'public', 'src', 'assets', 'BLOKICRUSH-LOGO.webp');
const QUIET_TARGET = path.join(ROOT, 'public', 'src', 'assets', 'BLOKICRUSH-LOGO-quieto.webp');
const DEPLOY = path.join(
  ROOT,
  '.vercel',
  'output',
  'static',
  'src',
  'assets',
  'BLOKICRUSH-LOGO.webp'
);

// Contrato del logo animado. El maestro no reparte el tiempo por igual entre
// sus fotogramas, asi que las duraciones se declaran una a una (en ms) en vez
// de con una sola constante: `sharp` conserva el `delay` de cada frame y tanto
// el script como el test comparan la lista completa.
const SIZE = Number(process.env.LOGO_SIZE || 320);
const FRAME_DELAYS = Object.freeze([500, 1700, 2500, 2500, 2500, 2500]);
const FRAMES = FRAME_DELAYS.length;
const LOOP_MS = FRAME_DELAYS.reduce((total, ms) => total + ms, 0);
const MAX_BYTES = 200 * 1024;

// El fotograma quieto (para `prefers-reduced-motion`) es una sola imagen, asi
// que se puede permitir mas calidad y menos peso.
const MAX_QUIET_BYTES = 80 * 1024;

// 80 deja el archivo en ~140 KB a 320 px. El logo se pinta a 41 px (movil) o
// 166 px (escritorio), asi que ahi el error no se ve; cada punto de calidad
// cuesta ~5 KB y el arte lleva degradados caros de comprimir.
const QUALITY = Number(process.env.LOGO_QUALITY || 80);

// Contrato de la ruta estatica (solo con --estatico).
const STATIC_ASPECT = 1620 / 810;
const STATIC_WIDTH = Number(process.env.LOGO_WIDTH || 900);

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
const rel = (absolute) => path.relative(ROOT, absolute).split(path.sep).join('/');

/** Trocea un contenedor RIFF/WebP en sus chunks, en orden. */
function riffChunks(buffer) {
  const chunks = [];
  for (let offset = 12; offset + 8 <= buffer.length; ) {
    const fourCC = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    chunks.push({ fourCC, size, at: offset });
    offset += 8 + size + (size % 2);
  }
  return chunks;
}

/** Caja de la tinta (alfa > 8) uniendo todos los fotogramas. */
function inkBox(data, frameSize, pages) {
  let minX = frameSize.width;
  let minY = frameSize.height;
  let maxX = -1;
  let maxY = -1;
  for (let frame = 0; frame < pages; frame++) {
    const base = frame * frameSize.width * frameSize.height * 4;
    for (let y = 0; y < frameSize.height; y++) {
      for (let x = 0; x < frameSize.width; x++) {
        if (data[base + (y * frameSize.width + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }
  if (maxX < 0) throw new Error('El logotipo es una imagen vacia: no hay tinta que recortar');
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}


/**
 * Ruta viva: GIF animado -> WebP animado cuadrado de 320 px.
 */
async function buildAnimated() {
  if (!fs.existsSync(ANIM_SOURCE)) {
    throw new Error(`Falta el maestro animado del logo: ${rel(ANIM_SOURCE)}`);
  }

  const meta = await sharp(ANIM_SOURCE, { animated: true }).metadata();
  const pages = meta.pages || 1;
  const delays = meta.delay || [];
  if (meta.format !== 'gif') {
    throw new Error(`El maestro animado debe ser un GIF (es ${meta.format})`);
  }
  if (!meta.hasAlpha) {
    throw new Error('El maestro animado debe traer alfa: el logo se pinta sobre el marco de caramelo');
  }
  if (pages !== FRAMES) {
    throw new Error(
      `El maestro trae ${pages} fotogramas y el contrato pide ${FRAMES}: actualiza el test y ` +
        'build-logo-asset.js antes de publicarlo'
    );
  }
  if (delays.length !== FRAMES || delays.some((ms, index) => ms !== FRAME_DELAYS[index])) {
    throw new Error(
      `Los tiempos del maestro son [${delays.join(', ')}] ms y el contrato pide ` +
        `[${FRAME_DELAYS.join(', ')}] ms: actualiza el test y build-logo-asset.js antes de publicarlo`
    );
  }

  const strip = await sharp(ANIM_SOURCE, { animated: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const box = inkBox(strip.data, { width: meta.width, height: meta.pageHeight }, pages);

  // Recorte a la tinta + lienzo cuadrado transparente. Se repite la misma
  // cadena dos veces (referencia en RGBA y codificacion) para poder comparar el
  // alfa del WebP contra el lienzo exacto que se le entrego.
  const prepare = () =>
    sharp(ANIM_SOURCE, { animated: true })
      .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
      .resize({
        width: SIZE,
        height: SIZE,
        fit: 'contain',
        kernel: 'lanczos3',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .ensureAlpha();

  const canvas = await prepare().raw().toBuffer({ resolveWithObject: true });
  const webp = await prepare()
    .webp({
      quality: QUALITY,
      alphaQuality: 100,
      effort: 6,
      smartSubsample: true,
      minSize: true,
      loop: 0
    })
    .toBuffer();

  const output = await sharp(webp, { animated: true }).metadata();
  if (output.format !== 'webp') {
    throw new Error(`La salida no es WebP (${output.format})`);
  }
  if (output.pages !== FRAMES) {
    throw new Error(`El WebP trae ${output.pages} fotogramas de ${FRAMES}: se perdio la animacion`);
  }
  if (output.width !== SIZE || output.pageHeight !== SIZE) {
    throw new Error(
      `El WebP mide ${output.width}x${output.pageHeight} y el contrato pide ${SIZE}x${SIZE}`
    );
  }
  if (output.loop !== 0) {
    throw new Error(`El WebP declara loop ${output.loop} y el contrato pide 0 (infinito)`);
  }
  const outDelays = output.delay || [];
  if (outDelays.length !== FRAMES || outDelays.some((ms, index) => ms !== FRAME_DELAYS[index])) {
    throw new Error(
      `Los tiempos del WebP son [${outDelays.join(', ')}] ms y el contrato pide ` +
        `[${FRAME_DELAYS.join(', ')}] ms: se perdio el ritmo del maestro`
    );
  }

  const chunks = riffChunks(webp);
  const vp8x = chunks.find((chunk) => chunk.fourCC === 'VP8X');
  if (!vp8x) {
    throw new Error('El WebP animado debe declarar caracteristicas extendidas (VP8X)');
  }
  const flags = webp[vp8x.at + 8];
  if ((flags & 0x02) === 0) throw new Error('VP8X no declara animacion (falta el bit 0x02)');
  if ((flags & 0x10) === 0) throw new Error('VP8X no declara canal alfa (falta el bit 0x10)');
  if (!chunks.some((chunk) => chunk.fourCC === 'ANIM')) {
    throw new Error('Falta el bloque ANIM: el logo se serviria estatico');
  }
  const frames = chunks.filter((chunk) => chunk.fourCC === 'ANMF').length;
  if (frames !== FRAMES) {
    throw new Error(`El WebP trae ${frames} bloques ANMF y el contrato pide ${FRAMES}`);
  }

  // Alfa exacta: viaja sin perdida (`alphaQuality: 100`), byte a byte.
  const decoded = await sharp(webp, { animated: true }).ensureAlpha().raw().toBuffer();
  if (decoded.length !== canvas.data.length) {
    throw new Error('El WebP decodificado no mide lo mismo que el lienzo de referencia');
  }
  let alphaDiff = 0;
  for (let i = 3; i < canvas.data.length; i += 4) {
    if (canvas.data[i] !== decoded[i]) alphaDiff += 1;
  }
  if (alphaDiff > 0) {
    throw new Error(`El WebP altero el alfa en ${alphaDiff} pixeles: revisa alphaQuality`);
  }

  if (webp.length >= MAX_BYTES) {
    throw new Error(
      `El logo pesa ${kb(webp.length)} y el contrato exige menos de ${MAX_BYTES / 1024} KB: ` +
        'baja LOGO_QUALITY o LOGO_SIZE antes de publicarlo'
    );
  }

  // Fotograma quieto para `prefers-reduced-motion`: sale del mismo lienzo (el
  // primer fotograma), asi que el cambio entre las dos versiones es solo el
  // movimiento, nunca el encuadre ni el color.
  const frameBytes = SIZE * SIZE * 4;
  const firstFrame = Buffer.from(canvas.data.subarray(0, frameBytes));
  const still = await sharp(firstFrame, { raw: { width: SIZE, height: SIZE, channels: 4 } })
    .webp({ quality: QUALITY, alphaQuality: 100, effort: 6, smartSubsample: true, minSize: true })
    .toBuffer();

  const stillMeta = await sharp(still).metadata();
  if (stillMeta.format !== 'webp' || stillMeta.pages) {
    throw new Error('El fotograma quieto debe ser un WebP estatico (sin ANIM)');
  }
  if (stillMeta.width !== SIZE || stillMeta.height !== SIZE) {
    throw new Error(`El fotograma quieto mide ${stillMeta.width}x${stillMeta.height}, se esperaba ${SIZE}x${SIZE}`);
  }
  if (riffChunks(still).some((chunk) => chunk.fourCC === 'ANIM')) {
    throw new Error('El fotograma quieto no debe traer bloque ANIM');
  }
  const stillDecoded = await sharp(still).ensureAlpha().raw().toBuffer();
  let stillAlphaDiff = 0;
  for (let i = 3; i < firstFrame.length; i += 4) {
    if (firstFrame[i] !== stillDecoded[i]) stillAlphaDiff += 1;
  }
  if (stillAlphaDiff > 0) {
    throw new Error(`El fotograma quieto altero el alfa en ${stillAlphaDiff} pixeles`);
  }
  if (still.length >= MAX_QUIET_BYTES) {
    throw new Error(
      `El fotograma quieto pesa ${kb(still.length)} y el contrato exige menos de ` +
        `${MAX_QUIET_BYTES / 1024} KB`
    );
  }

  publish(webp);
  publish(still, QUIET_TARGET);

  console.log(
    `origen  ${rel(ANIM_SOURCE)}  ${meta.width}x${meta.pageHeight}  ${kb(fs.statSync(ANIM_SOURCE).size)}  ` +
      `(${pages} fotogramas de ${FRAME_DELAYS.join('/')} ms = ${LOOP_MS} ms por vuelta, bucle infinito)`
  );
  console.log(
    `recorte ${box.width}x${box.height} desde ${box.left},${box.top} -> lienzo ${SIZE}x${SIZE} con alfa`
  );
  console.log(
    `salida  ${rel(TARGET)}  ${output.width}x${output.pageHeight} x${output.pages}  ${kb(webp.length)}  ` +
      `(q=${QUALITY}, alfa intacta, loop ${output.loop})`
  );
  console.log(
    `ahorro  ${(100 - (webp.length / fs.statSync(ANIM_SOURCE).size) * 100).toFixed(1)} % menos que el maestro`
  );
  console.log(
    `quieto  ${rel(QUIET_TARGET)}  ${SIZE}x${SIZE}  ${kb(still.length)}  ` +
      '(primer fotograma fijo para prefers-reduced-motion)'
  );
}

/** Escribe un WebP publicado y refresca el hard link de `.vercel/output`. */
function publish(buffer, target = TARGET) {
  fs.writeFileSync(target, buffer);
  if (target !== TARGET) return;
  if (fs.existsSync(DEPLOY) && fs.statSync(DEPLOY).ino !== fs.statSync(TARGET).ino) {
    fs.copyFileSync(TARGET, DEPLOY);
  }
}

/**
 * Rasteriza el maestro PNG desde el SVG cuando el vector es mas nuevo (o cuando
 * se pide con `--from-svg`). El SVG declara 1620 x 810, asi que a densidad 72
 * sharp produce exactamente el maestro del contrato estatico.
 */
async function ensureStaticMaster() {
  const force = process.argv.includes('--from-svg');
  if (!fs.existsSync(VECTOR)) {
    if (!fs.existsSync(STATIC_SOURCE)) {
      throw new Error(`Faltan el vector y el maestro del logo: ${rel(VECTOR)}`);
    }
    return;
  }
  const stale =
    force ||
    !fs.existsSync(STATIC_SOURCE) ||
    fs.statSync(VECTOR).mtimeMs > fs.statSync(STATIC_SOURCE).mtimeMs;
  if (!stale) return;

  const png = await sharp(fs.readFileSync(VECTOR), { density: 72 }).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(STATIC_SOURCE, png);
  console.log(`vector  ${rel(VECTOR)} -> ${rel(STATIC_SOURCE)}  ${kb(png.length)}`);
}

/**
 * Ruta de respaldo: wordmark estatico 2:1 desde el vector. Se activa con
 * `--estatico`; sirve para volver al lockup anterior sin rastrear commits.
 */
async function buildStatic() {
  await ensureStaticMaster();
  if (!fs.existsSync(STATIC_SOURCE)) {
    throw new Error(`Falta el maestro estatico del logo: ${rel(STATIC_SOURCE)}`);
  }

  const meta = await sharp(STATIC_SOURCE).metadata();
  if (!meta.hasAlpha) {
    throw new Error('El maestro del logo debe traer canal alfa: el tema lo pinta sobre el cielo');
  }
  if (Math.abs(meta.width / meta.height - STATIC_ASPECT) > 0.002) {
    throw new Error(
      `El maestro mide ${meta.width}x${meta.height} y el contrato estatico exige 2:1: ` +
        'actualiza el test y build-logo-asset.js antes de publicarlo'
    );
  }

  const width = Math.min(STATIC_WIDTH, meta.width);
  const height = Math.round(width / STATIC_ASPECT);

  const canvas = await sharp(STATIC_SOURCE)
    .resize({ width, height, fit: 'fill', kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const webp = await sharp(canvas.data, {
    raw: { width: canvas.info.width, height: canvas.info.height, channels: 4 }
  })
    .webp({ quality: QUALITY, alphaQuality: 100, effort: 6, smartSubsample: true, minSize: true })
    .toBuffer();

  const output = await sharp(webp).metadata();
  if (output.format !== 'webp') {
    throw new Error(`La salida no es WebP (${output.format})`);
  }
  if (output.pages) {
    throw new Error('La ruta estatica no debe producir animacion (bloque ANIM)');
  }
  if (output.width !== width || output.height !== height) {
    throw new Error(`El WebP mide ${output.width}x${output.height}, se esperaba ${width}x${height}`);
  }

  const decoded = await sharp(webp).ensureAlpha().raw().toBuffer();
  let alphaDiff = 0;
  for (let i = 3; i < canvas.data.length; i += 4) {
    if (canvas.data[i] !== decoded[i]) alphaDiff += 1;
  }
  if (alphaDiff > 0) {
    throw new Error(`El WebP altero el alfa en ${alphaDiff} pixeles: revisa alphaQuality`);
  }

  if (webp.length >= MAX_BYTES) {
    throw new Error(
      `El logo pesa ${kb(webp.length)} y el contrato exige menos de ${MAX_BYTES / 1024} KB: ` +
        'baja LOGO_QUALITY antes de publicarlo'
    );
  }

  publish(webp);

  console.log(`origen  ${rel(STATIC_SOURCE)}  ${width}x${height}  ${kb(fs.statSync(STATIC_SOURCE).size)}`);
  console.log(`salida  ${rel(TARGET)}  ${output.width}x${output.height}  ${kb(webp.length)} (q=${QUALITY}, alfa intacta)`);
}

(async () => {
  if (process.argv.includes('--estatico')) {
    await buildStatic();
  } else {
    await buildAnimated();
  }
})().catch((err) => {
  console.error(`build:logo · ${err.message}`);
  process.exitCode = 1;
});


