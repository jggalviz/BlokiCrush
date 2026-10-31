'use strict';

/**
 * Modo "Fichas de Prueba" 100 % local (sitio estatico sin backend).
 *
 * `ui/services/LocalApiClient.js` sustituye al transporte HTTP cuando la pagina
 * se publica en Vercel como sitio estatico: expone la misma superficie que
 * `ApiClient`, resuelve la ronda con el motor empaquetado y liquida el saldo
 * virtual en `localStorage`. Aqui se fija:
 *
 *   - La cartera arranca en 1.000,00 VES y se debita/acredita en centimos.
 *   - La idempotencia por `roundRef` no cobra dos veces.
 *   - Los errores conservan los codigos del backend (400/402/403).
 *   - El payload tiene EXACTAMENTE las mismas claves que el del servidor.
 *   - La cartera sobrevive a recargas y caduca por inactividad.
 */

require('./helpers/env');

const test = require('node:test');
const assert = require('node:assert/strict');

const { DEMO_CONFIG } = require('../config/gameConfig');
const { loadUiModule } = require('./helpers/uiModules');
const { startServer, createClient: createHttpClient } = require('./helpers/server');

let modulesPromise = null;

/** Carga (una sola vez) los modulos de la UI que se van a ejercitar. */
function uiModules() {
  if (!modulesPromise) modulesPromise = loadUiModule('services/LocalApiClient.js');
  return modulesPromise;
}

/** `localStorage` en memoria: el navegador de los tests. */
function createStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map)
  };
}

/** Ids deterministas para que las aserciones no dependan del CSPRNG. */
function sequentialUuid() {
  let counter = 0;
  return () => {
    counter += 1;
    return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
  };
}

async function createLocalClient({ storage = createStorage(), now = () => Date.now() } = {}) {
  const { LocalApiClient } = await uiModules();
  const client = new LocalApiClient({ storage, now, randomUUID: sequentialUuid() });
  return { client, storage };
}

/** Claves ordenadas (contrato de forma con el backend). */
const keys = (value) => Object.keys(value || {}).sort();

test('resolveApiMode: runtime > URL > meta > default local', async () => {
  const { resolveApiMode, normalizeApiMode, DEFAULT_API_MODE, HTTP_MODE, LOCAL_MODE } = await uiModules();

  assert.equal(DEFAULT_API_MODE, LOCAL_MODE, 'sin configuracion el sitio estatico corre en local');
  assert.equal(normalizeApiMode('SERVER'), HTTP_MODE);
  assert.equal(normalizeApiMode('offline'), LOCAL_MODE);
  assert.equal(normalizeApiMode('nonsense'), null);

  const meta = (content) => ({ querySelector: () => ({ content }) });

  assert.equal(
    resolveApiMode({ windowRef: { __BLOKI_CRUSH__: { mode: 'http' } }, documentRef: null }),
    HTTP_MODE,
    'el runtime del operador manda'
  );
  assert.equal(
    resolveApiMode({
      windowRef: { location: { search: '?mode=local' } },
      documentRef: meta('http')
    }),
    LOCAL_MODE,
    'la query de diagnostico gana al meta'
  );
  assert.equal(
    resolveApiMode({ windowRef: {}, documentRef: meta('http') }),
    HTTP_MODE,
    'el meta declara el modo en el HTML publicado'
  );
  assert.equal(
    resolveApiMode({ windowRef: {}, documentRef: meta('') }),
    LOCAL_MODE,
    'sin meta ni runtime se juega con fichas locales'
  );
});

test('gameInfo local publica la misma informacion publica y el bloque demo', async () => {
  const { client } = await createLocalClient();
  const payload = await client.gameInfo();

  assert.equal(payload.ok, true);
  assert.equal(payload.game.code, 'BLOKICRUSH_6X5_95_10K');
  assert.deepEqual(payload.game.betLadder, [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]);
  assert.equal(payload.game.grid.cols, 6);
  assert.equal(payload.game.grid.rows, 5);
  assert.equal(payload.game.demo.enabled, true);
  assert.equal(payload.game.demo.currency, DEMO_CONFIG.currency);
  assert.equal(payload.game.demo.startBalanceCents, 100000);
  assert.equal(payload.game.demo.startBalanceCredits, 1000);
  assert.match(payload.game.strips.checksum, /^[0-9a-f]{64}$/);
});

test('la sesion local abre cartera con 1.000,00 VES virtuales y token propio', async () => {
  const { client } = await createLocalClient();
  const session = await client.createDemoSession();

  assert.equal(session.ok, true);
  assert.equal(session.demo, true);
  assert.match(session.token, /^local\./);
  assert.equal(session.tokenType, 'Bearer');
  assert.equal(session.ttlSeconds, DEMO_CONFIG.tokenTtlSeconds);
  assert.equal(session.player.alias, DEMO_CONFIG.guestId);
  assert.equal(session.player.displayName, DEMO_CONFIG.guestName);
  assert.deepEqual(session.balance, { cents: 100000, credits: 1000, currency: DEMO_CONFIG.currency });

  const player = await client.player();
  assert.equal(player.demo, true);
  assert.equal(player.balance.cents, 100000);
  assert.deepEqual(player.stats, { spinCount: 0, totalWageredCents: 0, totalWonCents: 0 });
});

test('spin descuenta la apuesta y paga el premio del motor local', async () => {
  const { client } = await createLocalClient();
  await client.createDemoSession();

  const round = await client.spin({
    betCents: 100,
    roundRef: 'local-round-1',
    clientSeed: 'cliente-1'
  });

  assert.equal(round.ok, true);
  assert.equal(round.demo, true);
  assert.equal(round.replayed, false);
  assert.equal(round.mode, 'BASE');
  assert.equal(round.spinsPlayed, 1);
  assert.equal(round.balance.cents, 100000 - 100 + round.totalWinCents);
  assert.equal(round.balance.credits, Number((round.balance.cents / 100).toFixed(2)));
  assert.equal(round.balance.currency, DEMO_CONFIG.currency);
  assert.equal(round.game.code, 'BLOKICRUSH_6X5_95_10K');
  assert.equal(round.wagerCents, 100);
  assert.equal(round.spins.length, 1);
  assert.match(round.audit.serverSeedHash, /^[0-9a-f]{64}$/);
  assert.equal(round.audit.clientSeed, 'cliente-1');
  assert.ok(round.audit.rngDraws > 0);
  assert.equal(round.audit.certifiedRtp, 0.9508);

  const player = await client.player();
  assert.equal(player.balance.cents, round.balance.cents);
  assert.equal(player.stats.spinCount, 1);
  assert.equal(player.stats.totalWageredCents, 100);
  assert.equal(player.stats.totalWonCents, round.totalWinCents);
});

test('una misma roundRef no cobra dos veces (idempotencia)', async () => {
  const { client } = await createLocalClient();
  await client.createDemoSession();

  const first = await client.spin({ betCents: 100, roundRef: 'replay-ref-1' });
  const second = await client.spin({ betCents: 100, roundRef: 'replay-ref-1' });

  assert.equal(second.replayed, true);
  assert.equal(second.roundId, first.roundId);
  assert.equal(second.balance.cents, first.balance.cents);
  assert.equal(second.totalWinCents, first.totalWinCents);

  const player = await client.player();
  assert.equal(player.stats.spinCount, 1, 'el reintento no debe contar como tirada nueva');
});

test('la compra de bonus cobra bet x 100 y devuelve 10 giros', async () => {
  const { client } = await createLocalClient();
  await client.createDemoSession();

  const before = (await client.player()).balance.cents;
  const round = await client.spin({ betCents: 100, buyFeature: true, roundRef: 'bonus-ref-1' });

  assert.equal(round.mode, 'BUY_FEATURE');
  assert.equal(round.wagerCents, 10000);
  assert.equal(round.spinsPlanned, 10);
  assert.equal(round.feature.id, 'BLOKI_FEVER');
  assert.equal(round.balance.cents, before - 10000 + round.totalWinCents);
});

test('los errores conservan los codigos del backend', async () => {
  const { client } = await createLocalClient();
  await client.createDemoSession();

  const rejectWith = async (promise, code, status) => {
    await assert.rejects(promise, (error) => {
      assert.equal(error.code, code);
      assert.equal(error.status, status);
      return true;
    });
  };

  await rejectWith(client.spin({ betCents: 99 }), 'INVALID_BET', 400);
  await rejectWith(client.spin({ betCents: 100.5 }), 'INVALID_BET', 400);
  await rejectWith(client.spin({ betCents: 100, buyFeature: 'si' }), 'INVALID_MODE', 400);
  await rejectWith(client.spin({ betCents: 100, roundRef: 'corto' }), 'INVALID_ROUND_REF', 400);
  await rejectWith(
    client.spin({ betCents: 100, clientSeed: 'x'.repeat(65) }),
    'INVALID_CLIENT_SEED',
    400
  );
  /* 100 creditos + bonus 100x = 10.000,00 VES > cartera inicial. */
  await rejectWith(
    client.spin({ betCents: 10000, buyFeature: true }),
    'INSUFFICIENT_FUNDS',
    402
  );
  await rejectWith(client.createSession(), 'DEV_SESSION_DISABLED', 403);
});

test('la cartera persiste entre recargas y se reinicia si caduca por inactividad', async () => {
  const storage = createStorage();
  let clock = Date.parse('2026-10-30T12:00:00.000Z');
  const now = () => clock;

  const first = await createLocalClient({ storage, now });
  await first.client.createDemoSession();
  const round = await first.client.spin({ betCents: 100, roundRef: 'persist-ref-1' });
  const saved = await first.client.player();

  /* Otra instancia (recarga de la pagina) sobre el mismo almacenamiento. */
  const second = await createLocalClient({ storage, now });
  const restored = await second.client.player();
  assert.equal(restored.balance.cents, saved.balance.cents);
  assert.equal(restored.stats.spinCount, 1);
  assert.equal(restored.player.id, saved.player.id);
  assert.ok(storage.dump()['blokicrush.demo.wallet.v1'].includes(round.roundId));

  /* Pasado el TTL deslizante la cartera se abre de nuevo con el saldo inicial. */
  clock += DEMO_CONFIG.sessionTtlMs + 1;
  const afterIdle = await second.client.player();
  assert.equal(afterIdle.balance.cents, DEMO_CONFIG.startBalanceCents);
  assert.equal(afterIdle.stats.spinCount, 0);
});

test('el payload local tiene las mismas claves que el del backend', async () => {
  const { client } = await createLocalClient();
  const localGame = await client.gameInfo();
  const localPlayer = await client.player();
  const localRound = await client.spin({ betCents: 100, roundRef: 'contrato-ref-1' });

  const server = await startServer();
  const request = createHttpClient(server.baseUrl);

  try {
    const session = await request('POST', '/api/demo/session', {
      body: { playerId: 'invitado_demo' }
    });
    assert.equal(session.status, 200, 'el backend debe emitir sesion demo para comparar');

    const remoteGame = await request('GET', '/api/game');
    const remotePlayer = await request('GET', '/api/player', { token: session.body.token });
    const remoteRound = await request('POST', '/api/spin', {
      token: session.body.token,
      body: { betCents: 100, roundRef: 'contrato-remoto-1', clientSeed: 'contrato-1' }
    });

    assert.equal(remoteRound.status, 200);

    assert.deepEqual(keys(localGame.game), keys(remoteGame.body.game), 'GET /api/game');
    assert.deepEqual(keys(localGame.game.demo), keys(remoteGame.body.game.demo));
    assert.deepEqual(keys(localPlayer), keys(remotePlayer.body), 'GET /api/player');
    assert.deepEqual(keys(localPlayer.player), keys(remotePlayer.body.player));
    assert.deepEqual(keys(localPlayer.balance), keys(remotePlayer.body.balance));
    assert.deepEqual(keys(localPlayer.stats), keys(remotePlayer.body.stats));

    assert.deepEqual(keys(localRound), keys(remoteRound.body), 'POST /api/spin');
    assert.deepEqual(keys(localRound.balance), keys(remoteRound.body.balance));
    assert.deepEqual(keys(localRound.game), keys(remoteRound.body.game));
    assert.deepEqual(keys(localRound.audit), keys(remoteRound.body.audit));
    assert.deepEqual(keys(localRound.scatter), keys(remoteRound.body.scatter));
    assert.deepEqual(keys(localRound.spins[0]), keys(remoteRound.body.spins[0]));
    assert.deepEqual(keys(localRound.spins[0].scatter), keys(remoteRound.body.spins[0].scatter));
  } finally {
    await server.close();
  }
});
