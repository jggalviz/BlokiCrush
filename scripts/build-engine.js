'use strict';

/**
 * Genera `ui/engine/blokicrushEngine.js`: el motor matematico (`core/`) listo
 * para ejecutarse en el navegador.
 *
 * Por que existe:
 *   El despliegue estatico (Vercel + `public/`) no tiene backend, pero las
 *   rondas deben seguir resolviendose con el MISMO motor autoritativo. Este
 *   build empaqueta `core/**` y `config/gameConfig.js` **verbatim** dentro de un
 *   ESM autocontenido, con un cargador CommonJS minimo y un shim sincrono de
 *   `node:crypto` (`scripts/engine/browserCrypto.template.js`).
 *
 * Reglas:
 *   - No hay copia manual del motor: si cambia `core/`, se regenera con
 *     `npm run build:engine` (o automaticamente en `npm start`/`vercel-build`).
 *   - El bundle no importa nada: un solo `<script type="module">` basta y la
 *     CSP `script-src 'self'` lo permite.
 *   - `test/localEngine.test.js` compara el bundle con `core/` (mismas tiras,
 *     mismo HMAC-DRBG, mismas rondas) y falla si el archivo quedo obsoleto.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.join(__dirname, '..');
const CORE_DIR = path.join(ROOT_DIR, 'core');
const TARGET_DIR = path.join(ROOT_DIR, 'ui', 'engine');
const TARGET_PATH = path.join(TARGET_DIR, 'blokicrushEngine.js');
const SHIM_PATH = path.join(__dirname, 'engine', 'browserCrypto.template.js');

/** Modulo de entrada: es el mismo que usa el servidor (`require('../../core')`). */
const ENTRY_ID = 'core/index.js';
/** Configuracion que `core/constants.js` requiere (fuente unica de valores). */
const CONFIG_MODULE = 'config/gameConfig.js';
/** Id sintetico del shim que sustituye a `require('node:crypto')`. */
const CRYPTO_MODULE = 'node:crypto';

const REQUIRE_PATTERN = /require\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Todos los modulos `.js` de `core/` (incluye futuros modulos sin tocar esto). */
function listCoreModules() {
  return fs
    .readdirSync(CORE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => `core/${entry.name}`)
    .sort();
}

/** Traduce `require('...')` a un id del bundle. */
function resolveSpecifier(fromId, specifier) {
  if (specifier === CRYPTO_MODULE) return CRYPTO_MODULE;
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromId), specifier));
    return joined.endsWith('.js') ? joined : `${joined}.js`;
  }
  throw new Error(
    `[build:engine] require no soportado en ${fromId}: "${specifier}". ` +
      'El bundle solo admite rutas relativas de core/ y node:crypto.'
  );
}

function readSource(id) {
  return fs.readFileSync(path.join(ROOT_DIR, id), 'utf8');
}

/** Lee los modulos y valida que cada `require` tenga destino dentro del bundle. */
function collectModules() {
  const ids = [...listCoreModules(), CONFIG_MODULE].sort();
  const sources = new Map(ids.map((id) => [id, readSource(id)]));
  const deps = new Map();

  for (const id of ids) {
    const map = {};
    for (const match of sources.get(id).matchAll(REQUIRE_PATTERN)) {
      const specifier = match[1];
      const target = resolveSpecifier(id, specifier);
      if (target !== CRYPTO_MODULE && !sources.has(target)) {
        throw new Error(
          `[build:engine] ${id} requiere "${specifier}" (${target}), que no esta en el bundle. ` +
            'Anade el archivo a core/ o a la lista de modulos extra.'
        );
      }
      map[specifier] = target;
    }
    deps.set(id, map);
  }

  return { ids, sources, deps };
}


/** Fuente completa del bundle (sin escribir en disco). */
function buildEngineSource() {
  const { ids, sources, deps } = collectModules();
  const shim = fs.readFileSync(SHIM_PATH, 'utf8');

  const lines = [
    '/**',
    ' * ARCHIVO GENERADO por scripts/build-engine.js. No editar a mano:',
    ' *   npm run build:engine',
    ' *',
    ' * Fuentes (verbatim):',
    ' *   - core/*.js            motor matematico autoritativo',
    ' *   - config/gameConfig.js constantes compartidas',
    ' *   - scripts/engine/browserCrypto.template.js  shim sincrono de node:crypto',
    ' *',
    ' * El bundle expone `engine` con la misma API que `require("../core")`:',
    ' * gameInfo, playRound, createEngine, constantes y paytables. Se ejecuta en',
    ' * el navegador para que el sitio estatico resuelva rondas de "Fichas de',
    ' * Prueba" sin backend ni Supabase (ver docs/MODO_ESTATICO.md).',
    ' */',
    '',
    'export const ENGINE_BUNDLE = Object.freeze({',
    `  entry: ${JSON.stringify(ENTRY_ID)},`,
    `  cryptoShim: ${JSON.stringify(CRYPTO_MODULE)},`,
    '  modules: Object.freeze([',
    ...ids.map((id) => `    ${JSON.stringify(id)},`),
    '  ])',
    '});',
    '',
    'const __modules = Object.create(null);',
    `const __deps = ${JSON.stringify(Object.fromEntries(deps), null, 2)};`,
    '',
    'function __defineModule(id, factory) {',
    '  __modules[id] = factory;',
    '}',
    '',
    '/* ---------------------------------------------------------------------- */',
    '/*  Shim sincrono de node:crypto (SHA-256 + HMAC-SHA256 + CSPRNG)         */',
    '/* ---------------------------------------------------------------------- */',
    `__defineModule(${JSON.stringify(CRYPTO_MODULE)}, function (module, exports, require) {`,
    shim,
    '});',
    ''
  ];

  for (const id of ids) {
    lines.push(
      `__defineModule(${JSON.stringify(id)}, function (module, exports, require) {`,
      sources.get(id),
      '});',
      ''
    );
  }

  lines.push(
    'const __cache = Object.create(null);',
    '',
    '/** Cargador CommonJS minimo; resuelve solo los ids declarados en __deps. */',
    'function __require(id) {',
    '  const cached = __cache[id];',
    '  if (cached) return cached.exports;',
    '  const factory = __modules[id];',
    '  if (!factory) throw new Error(`[blokicrush] modulo ausente en el bundle: ${id}`);',
    '  const module = { exports: {} };',
    '  __cache[id] = module;',
    '  const table = __deps[id] || {};',
    '  factory(module, module.exports, (specifier) => {',
    '    const target = table[specifier];',
    '    if (!target) throw new Error(`[blokicrush] require no resuelto: ${specifier} (desde ${id})`);',
    '    return __require(target);',
    '  });',
    '  return module.exports;',
    '}',
    '',
    '/** `Buffer` global que espera `core/rng.js` (lo aporta el shim). */',
    `const Buffer = __require(${JSON.stringify(CRYPTO_MODULE)}).Buffer;`,
    '',
    '/** Instancia unica del motor, igual que `module.exports` de core/index.js. */',
    `export const engine = __require(${JSON.stringify(ENTRY_ID)});`,
    '',
    'export default engine;',
    ''
  );

  return lines.join('\n');
}

/** Escribe el bundle y devuelve la fuente generada. */
function writeEngineBundle() {
  const source = buildEngineSource();
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.writeFileSync(TARGET_PATH, source, 'utf8');
  return source;
}

if (require.main === module) {
  const source = writeEngineBundle();
  // eslint-disable-next-line no-console
  console.log(
    `[build:engine] ${path.relative(ROOT_DIR, TARGET_PATH)} actualizado ` +
      `(${Buffer.byteLength(source, 'utf8')} bytes).`
  );
}

module.exports = { TARGET_PATH, SHIM_PATH, buildEngineSource, writeEngineBundle, listCoreModules };
