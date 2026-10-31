#!/usr/bin/env node
'use strict';

/**
 * Optimiza el cartel de victoria (WIN overlay).
 *
 *   npm run build:win
 *
 * El maestro vive en `design/victoria_dulce.png`: el cartel de caramelo
 * brillante (la ardilla con gorra, las piruletas de arcoiris y el WIN dorado),
 * 1536 x 1024 px y alfa real (las esquinas son transparentes). Igual que el
 * resto del arte, se archiva fuera de `public/` porque todo lo que hay en
 * `public/src/**` se publica en el CDN y el PNG pesa 3,0 MB. El cartel anterior
 * (el mono de la piel dulce) queda archivado en
 * `design/victoria_dulce_clasica.png`: no se publica, pero deja rastro del
 * lienzo 3:2 que midio el CSS.
 *
 * El script escribe `public/src/assets/victoria_dulce.webp` con este contrato:
 *   - WebP con alfa (VP8X + ALPH + VP8) a calidad 90. `alphaQuality: 100`
 *     conserva el canal alfa sin perdida: el recorte del cartel no gana halos
 *     blancos ni escalones en el borde de las letras.
 *   - 1152 x 768 px (75 % del maestro, misma relacion 3:2). El CSS no pinta el
 *     arte por encima de 640 px CSS, asi que 1152 cubre pantallas retina (1,8x)
 *     sin pagar el lienzo completo a q=90 (580 KB contra los 409 KB de aqui).
 *   - Antes de reescalar se mide la caja del alfa visible, pero solo se recorta
 *     si el aire supera el 2 % de un eje (`MIN_TRIM_PCT`). El cartel va a
 *     sangre (12 px de aire en el lado mas ancho), y el 3:2 del lienzo es parte
 *     del contrato: el HTML lo declara con `width="1152" height="768"` y
 *     `.win__art` escala con `calc(58vh * 1.5)`. Recortar un 1 % solo cambiaria
 *     esas tres medidas a cambio de nada; un maestro con aire de verdad si se
 *     publica recortado, y entonces el script avisa de que hay que actualizar
 *     el HTML y el CSS.
 *   - Tope de peso: 450 KB (el WebP actual ronda los 409 KB).
 *
 * Es idempotente: misma entrada y misma calidad -> mismos bytes.
 */

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'design', 'victoria_dulce.png');
const TARGET = path.join(ROOT, 'public', 'src', 'assets', 'victoria_dulce.webp');
const DEPLOY = path.join(ROOT, '.vercel', 'output', 'static', 'src', 'assets', 'victoria_dulce.webp');

// El arte se pinta como maximo a 640 px CSS: 1152 px cubre retina sin inflar
// la descarga (580 KB a lienzo completo contra 409 KB aqui).
const TARGET_WIDTH = 1152;
const QUALITY = Number(process.env.WIN_QUALITY || 90);
const MAX_BYTES = 450 * 1024;
// Alfa por debajo de 8/255 no se ve sobre el velo: no cuenta como arte y no
// sostiene un recorte.
const ALPHA_FLOOR = 8;
// Solo se recorta si el aire quitado llega al 2 % de un eje (ver cabecera).
const MIN_TRIM_PCT = 0.02;

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

/**
 * Caja del alfa visible del maestro.
 *
 * Se mide pixel a pixel en vez de usar `trim()` porque sharp devuelve
 * `trimOffsetLeft` negativos cuando el umbral recorta poco (este cartel da -12
 * sobre un lienzo de 1536 px) y una caja negativa recortaria fuera de la
 * imagen. Recorrer 1,5 Mpx cuesta milisegundos y da la caja exacta.
 *
 * @returns {Promise<{ left: number, top: number, width: number, height: number }>}
 */
async function alphaBox(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const alpha = channels - 1;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    const row = y * width * channels;
    for (let x = 0; x < width; x += 1) {
      if (data[row + x * channels + alpha] <= ALPHA_FLOOR) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right < 0) {
    throw new Error(`${path.basename(file)} no tiene un solo pixel visible: revisa el alfa`);
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

(async () => {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Falta el maestro ${path.relative(ROOT, SOURCE)}: mueve el PNG a design/`);
  }

  const master = await sharp(SOURCE).metadata();
  if (!master.width || !master.height) {
    throw new Error(`${path.basename(SOURCE)} no declara medidas: revisa el PNG`);
  }
  if (!master.hasAlpha) {
    throw new Error(
      'El maestro no trae canal alfa: el cartel se recorta sobre el juego y un fondo ' +
        'opaco taparia la pantalla. Exporta el PNG con transparencia.'
    );
  }

  // Caja del alfa visible. El cartel va a sangre, asi que el recorte normal es
  // un no-op; solo se aplica cuando el aire compensa (ver MIN_TRIM_PCT) para no
  // romper el 3:2 que declaran el HTML y `.win__art`.
  const box = await alphaBox(SOURCE);
  const airX = (master.width - box.width) / master.width;
  const airY = (master.height - box.height) / master.height;
  const worthCrop = Math.max(airX, airY) >= MIN_TRIM_PCT;
  const frame = worthCrop ? box : { width: master.width, height: master.height };
  const air = `L${box.left} T${box.top} R${master.width - box.left - box.width} B${
    master.height - box.top - box.height
  }`;

  const flattened = await sharp(SOURCE).ensureAlpha().toBuffer();
  const authored = worthCrop
    ? await sharp(flattened)
        .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
        .toBuffer()
    : flattened;

  const webp = await sharp(authored)
    .resize({ width: TARGET_WIDTH, fit: 'inside', withoutEnlargement: true })
    .webp({
      quality: QUALITY,
      alphaQuality: 100,
      effort: 6,
      smartSubsample: true
    })
    .toBuffer();

  const out = await sharp(webp).metadata();
  if (out.format !== 'webp') {
    throw new Error(`El destino no es un WebP real: ${out.format}`);
  }
  if (!out.hasAlpha) {
    throw new Error('El WebP salio sin canal alfa: revisa alphaQuality y el maestro');
  }
  if (out.width !== TARGET_WIDTH) {
    throw new Error(
      `El WebP mide ${out.width}px de ancho y el contrato exige ${TARGET_WIDTH}px ` +
        '(ver cabecera: es el 75 % del maestro)'
    );
  }
  if (Math.abs(out.width / out.height - frame.width / frame.height) > 0.002) {
    throw new Error(
      `El WebP mide ${out.width}x${out.height} y rompe la relacion de la caja publicada ` +
        `${frame.width}x${frame.height}: el cartel se deformaria`
    );
  }
  // El HTML declara `width="1152" height="768"` y `.win__art` escala con
  // `calc(58vh * 1.5)`: si un maestro llega con aire de sobra y se recorta a
  // otra relacion, esas medidas se quedan cortas y hay que tocarlas a mano.
  const ratio = frame.width / frame.height;
  if (Math.abs(ratio - 3 / 2) > 0.005) {
    console.warn(
      `aviso  el cartel se publica a ${ratio.toFixed(3)}:1 y ya no es 3:2: ` +
        'actualiza width/height de #win-art y el factor de .win__art'
    );
  }
  if (webp.length >= MAX_BYTES) {
    throw new Error(
      `El cartel pesa ${kb(webp.length)} y el contrato exige menos de ${MAX_BYTES / 1024} KB: ` +
        'baja WIN_QUALITY antes de publicarlo'
    );
  }

  fs.writeFileSync(TARGET, webp);
  // `.vercel/output` es un hard link del repo: si se rompe, se refresca a mano.
  if (fs.existsSync(DEPLOY) && fs.statSync(DEPLOY).ino !== fs.statSync(TARGET).ino) {
    fs.copyFileSync(TARGET, DEPLOY);
  }

  console.log(
    `origen  ${path.relative(ROOT, SOURCE)}  ${master.width}x${master.height}  ` +
      `${kb(fs.statSync(SOURCE).size)}  ${
        worthCrop
          ? `(alfa recortado a ${box.width}x${box.height} desde ${box.left},${box.top})`
          : `(alfa a sangre: aire ${air}, se conserva el lienzo 3:2)`
      }`
  );
  console.log(
    `salida  ${path.relative(ROOT, TARGET)}  ${out.width}x${out.height}  ` +
      `${kb(webp.length)} (q=${QUALITY}, alfa intacta)`
  );
  console.log(
    `ahorro  ${(100 - (webp.length / fs.statSync(SOURCE).size) * 100).toFixed(1)} % menos que el maestro`
  );
})().catch((err) => {
  console.error(`build:win · ${err.message}`);
  process.exitCode = 1;
});
