'use strict';

/**
 * Contrato del motor que corre en el NAVEGADOR (`ui/engine/blokicrushEngine.js`).
 *
 * El sitio estatico no tiene backend, asi que la ronda la resuelve el mismo
 * `core/` empaquetado por `scripts/build-engine.js`. Estos tests garantizan:
 *
 *   1. El bundle esta sincronizado con su fuente (`npm run build:engine`).
 *   2. Incluye todos los modulos de `core/`.
 *   3. El shim de `node:crypto` produce EXACTAMENTE el mismo HMAC-DRBG que Node
 *      (si divergiera, el RTP y la auditoria dejarian de coincidir).
 *   4. Las rondas resueltas son identicas a las del servidor para la misma
 *      semilla inyectada (base y compra de bonus).
 *   5. `gameInfo` publica los mismos valores y las mismas tiras certificadas.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BUILD_ENGINE = require('../scripts/build-engine');
const core = require('../core');
const { createFastRng } = require('../core/fastRng');

const ROOT_DIR = path.join(__dirname, '..');
const BUNDLE_PATH = BUILD_ENGINE.TARGET_PATH;
const relative = (file) => path.relative(ROOT_DIR, file).replace(/\\/g, '/');

/** Importa el bundle ESM (autocontenido) sin depender del loader de Node. */
async function loadBundle() {
  const source = fs.readFileSync(BUNDLE_PATH, 'utf8');
  const url = `data:text/javascript;base64,${Buffer.from(source, 'utf8').toString('base64')}`;
  return import(url);
}

/** Compara rondas ignorando el sello de tiempo de auditoria. */
function stripTimestamps(round) {
  return { ...round, audit: { ...round.audit, generatedAt: null } };
}

test('ui/engine/blokicrushEngine.js esta sincronizado con core/ (npm run build:engine)', () => {
  assert.ok(fs.existsSync(BUNDLE_PATH), 'Falta el bundle: ejecuta `npm run build:engine`');
  assert.equal(
    fs.readFileSync(BUNDLE_PATH, 'utf8'),
    BUILD_ENGINE.buildEngineSource(),
    `El bundle ${relative(BUNDLE_PATH)} quedo desactualizado: ejecuta \`npm run build:engine\``
  );
});

test('el bundle incluye todos los modulos de core/ y la configuracion compartida', async () => {
  const { ENGINE_BUNDLE } = await loadBundle();

  assert.equal(ENGINE_BUNDLE.entry, 'core/index.js');
  assert.equal(ENGINE_BUNDLE.cryptoShim, 'node:crypto');

  const bundled = new Set(ENGINE_BUNDLE.modules);
  for (const id of BUILD_ENGINE.listCoreModules()) {
    assert.ok(bundled.has(id), `Falta ${id} en el bundle del motor (npm run build:engine)`);
  }
  assert.ok(bundled.has('config/gameConfig.js'), 'Falta la configuracion compartida');
});

test('el shim de node:crypto reproduce el HMAC-DRBG del servidor draw a draw', async () => {
  const { engine: browserEngine } = await loadBundle();
  const seeds = { serverSeed: 'a'.repeat(64), clientSeed: 'contrato-local-1' };

  const serverRng = core.createEngine().internals.createRng(seeds);
  const browserRng = browserEngine.createEngine().internals.createRng(seeds);

  for (let draw = 0; draw < 4000; draw += 1) {
    const bound = 1 + (draw % 1013);
    assert.equal(
      browserRng.int(bound),
      serverRng.int(bound),
      `Draw ${draw}: el HMAC-DRBG del navegador se separa del de Node`
    );
  }
  assert.deepEqual(browserRng.getState(), serverRng.getState(), 'Los contadores del DRBG deben coincidir');
});

test('las rondas del navegador son identicas a las del servidor (misma semilla)', async () => {
  const { engine: browserEngine } = await loadBundle();
  const serverEngine = core.createEngine();

  const cases = [
    { betCents: 100 },
    { betCents: 1000 },
    { betCents: 2000, buyFeature: true }
  ];

  for (const [index, options] of cases.entries()) {
    const seed = 1234 + index * 777;
    const serverRound = serverEngine.playRound({ ...options, rng: createFastRng(seed) });
    const browserRound = browserEngine.createEngine().playRound({ ...options, rng: createFastRng(seed) });

    assert.deepEqual(
      stripTimestamps(browserRound),
      stripTimestamps(serverRound),
      `La ronda ${JSON.stringify(options)} difiere entre navegador y servidor`
    );
  }
});

test('el motor del navegador resuelve una ronda real sin rng inyectado', async () => {
  const { engine: browserEngine } = await loadBundle();
  const round = browserEngine.playRound({ betCents: 100, clientSeed: 'navegador-1' });

  assert.equal(round.betCents, 100);
  assert.equal(round.mode, 'BASE');
  assert.equal(round.spinsPlayed, 1);
  assert.equal(round.spins.length, 1);
  assert.equal(round.initialGrid.length, 5);
  assert.equal(round.initialGrid[0].length, 6);
  assert.match(round.audit.serverSeed, /^[0-9a-f]{64}$/);
  assert.match(round.audit.serverSeedHash, /^[0-9a-f]{64}$/);
  assert.match(round.audit.rngHash, /^[0-9a-f]{64}$/);
  assert.ok(round.audit.rngDraws > 0, 'El DRBG debe registrar las extracciones');
});

test('gameInfo del bundle coincide con el del servidor (incluidas las tiras)', async () => {
  const { engine: browserEngine } = await loadBundle();

  assert.deepEqual(browserEngine.gameInfo, core.gameInfo);
  assert.equal(browserEngine.ENGINE_VERSION, core.ENGINE_VERSION);
  assert.equal(browserEngine.PAYTABLE_VERSION, core.PAYTABLE_VERSION);
  assert.equal(browserEngine.CERTIFIED_RTP.base, core.CERTIFIED_RTP.base);
  assert.deepEqual(browserEngine.BET_LADDER_CREDITS, core.BET_LADDER_CREDITS);
});
