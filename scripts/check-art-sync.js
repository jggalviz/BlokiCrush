#!/usr/bin/env node
'use strict';

/**
 * Avisa cuando un maestro de `design/` es mas nuevo que el WebP publicado.
 *
 *   npm run check:art            # solo avisa (sale siempre con codigo 0)
 *   npm run check:art -- --strict # sale con codigo 1 si hay arte sin publicar
 *
 * Por que existe: `npm start` (`prestart`) regenera la configuracion, el espejo
 * `public/ui/**` y `server/generated/indexHtml.js`, pero NO compila el arte.
 * Los WebP de `public/src/assets/**` solo cambian al ejecutar `build:art`,
 * `build:bg`, `build:desktop-art`, `build:win` o `build:logo`. Sin este aviso
 * era facil reemplazar `design/marco_movil.png`, reiniciar y concluir que "las
 * imagenes no se actualizan": el navegador seguia recibiendo el WebP anterior
 * porque el maestro nunca se publico.
 *
 * `prestart` y `predev` lo ejecutan al final, asi que el aviso sale en cada
 * arranque. La comprobacion es solo de mtime: no abre ni decodifica imagenes.
 *
 * `GRACE_MS` evita falsos positivos cuando un `git checkout`, una copia o un
 * descomprimido dejan maestros y salidas con la misma hora (o con milisegundos
 * de diferencia por el orden de escritura).
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const GRACE_MS = 2000;

/**
 * Cada pieza declara sus maestros y el script que la publica. El logo entro con
 * dos maestros cuando `build:logo` rasterizaba el PNG desde el SVG; ahora el
 * maestro es el GIF animado (`--estatico` conserva aquella ruta, pero no es la
 * que se publica), asi que solo vigila ese archivo.
 */
const PIECES = [
  {
    target: 'BLOKICRUSH-LOGO.webp',
    masters: ['BROKI_crush_animacion-logo-LENTO.gif'],
    script: 'build:logo'
  },
  {
    target: 'BLOKICRUSH-LOGO-quieto.webp',
    masters: ['BROKI_crush_animacion-logo-LENTO.gif'],
    script: 'build:logo'
  },
  {
    target: 'reino_de_caramelos_y_arcoiris.webp',
    masters: ['reino_de_caramelos_y_arcoiris.png'],
    script: 'build:bg'
  },
  {
    target: 'avenida_fantastica_reino_caramelos.webp',
    masters: ['avenida_fantastica_reino_caramelos.png'],
    script: 'build:bg'
  },
  {
    target: 'marco_movil.webp',
    masters: ['marco_movil.png'],
    script: 'build:art'
  },
  {
    target: 'consola_movil.webp',
    masters: ['consola_movil.png'],
    script: 'build:art'
  },
  { target: 'd1.webp', masters: ['d1.png'], script: 'build:desktop-art' },
  { target: 'd3.webp', masters: ['d3.png'], script: 'build:desktop-art' },
  { target: 'd5.webp', masters: ['d5.png'], script: 'build:desktop-art' },
  { target: 'victoria_dulce.webp', masters: ['victoria_dulce.png'], script: 'build:win' }
];

const rel = (absolute) => path.relative(ROOT, absolute).split(path.sep).join('/');

const stamp = (date) =>
  `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ` +
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/**
 * Revisa una pieza.
 *
 * @returns {{ status: 'ok'|'stale'|'missing-target'|'missing-masters', staleBy: string[] }}
 */
function inspect(piece) {
  const targetPath = path.join(ROOT, 'public', 'src', 'assets', piece.target);
  const masters = piece.masters
    .map((name) => path.join(ROOT, 'design', name))
    .filter((absolute) => fs.existsSync(absolute));

  if (masters.length === 0) return { status: 'missing-masters', staleBy: [] };
  if (!fs.existsSync(targetPath)) return { status: 'missing-target', staleBy: [] };

  const targetMs = fs.statSync(targetPath).mtimeMs;
  const staleBy = masters
    .filter((absolute) => fs.statSync(absolute).mtimeMs > targetMs + GRACE_MS)
    .map((absolute) => `${rel(absolute)} (${stamp(fs.statSync(absolute).mtime)})`);

  return { status: staleBy.length > 0 ? 'stale' : 'ok', staleBy, targetPath, targetMs };
}

function main() {
  const strict = process.argv.includes('--strict');
  const stale = [];

  for (const piece of PIECES) {
    const result = inspect(piece);
    if (result.status === 'stale') stale.push({ piece, result });
    if (result.status === 'missing-target') {
      console.warn(
        `[check:art] falta public/src/assets/${piece.target}: ejecuta \`npm run ${piece.script}\``
      );
    }
  }

  if (stale.length === 0) {
    console.log(`[check:art] ${PIECES.length} piezas al dia (design/ ya esta publicado).`);
    return;
  }

  console.warn('[check:art] Hay arte en design/ mas nuevo que el WebP que sirve la app:');
  for (const { piece, result } of stale) {
    console.warn(
      `  ${piece.target}  <-  ${result.staleBy.join(', ')}  |  ${rel(result.targetPath)} (${stamp(
        new Date(result.targetMs)
      )})`
    );
  }
  const scripts = [...new Set(stale.map(({ piece }) => `npm run ${piece.script}`))];
  console.warn(`  -> ${scripts.join(' && ')}`);
  console.warn('  -> o todo de una vez: npm run build:assets');
  console.warn('  El navegador no vera el cambio hasta que exista el WebP.');

  if (strict) process.exitCode = 1;
}

main();
