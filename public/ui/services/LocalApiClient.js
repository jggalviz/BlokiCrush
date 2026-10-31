/**
 * Cliente de juego 100 % local ("fichas de prueba" sin backend).
 *
 * Es el sustituto de `ApiClient` cuando el sitio se publica como estatico
 * (Vercel + `public/`, sin Supabase ni Express). Expone la MISMA superficie que
 * `ApiClient` —`gameInfo()`, `player()`, `createDemoSession()`, `spin()`,
 * `health()`— y devuelve payloads con la misma forma que
 * `server/services/gameService.js`, de modo que `SessionManager`,
 * `GameController` y los renderers no cambian.
 *
 * Reparto de responsabilidades:
 *   - `ui/engine/blokicrushEngine.js` (GENERADO desde `core/`) resuelve la ronda
 *     con el motor autoritativo: tiras certificadas, HMAC-DRBG y cascadas.
 *   - `ui/services/LocalWallet.js` lleva el saldo virtual (centimos enteros),
 *     la idempotencia por `roundRef` y la persistencia en `localStorage`.
 *   - Este modulo valida la entrada como el backend, cobra/paga y compone el
 *     payload publico. Nada de red: no usa `fetch`.
 *
 * Importante: al no existir servidor, el saldo y el resultado son manipulables
 * por el propio jugador. Es un modo DEMO con fichas ficticias; para dinero real
 * hace falta el backend (`ui/services/ApiClient.js` + `server/`).
 */

import { ApiError, RUNTIME_CONFIG_KEY } from './ApiClient.js';
import { DEMO } from '../config/gameConfig.js';
import { LocalWallet } from './LocalWallet.js';
import engine from '../engine/blokicrushEngine.js';

/* -------------------------------------------------------------------------- */
/*  Seleccion de modo: local (estatico) o http (backend)                      */
/* -------------------------------------------------------------------------- */

export const LOCAL_MODE = 'local';
export const HTTP_MODE = 'http';
export const MODE_META_NAME = 'game-api-mode';
/** El sitio publicado es estatico: las fichas de prueba locales son el default. */
export const DEFAULT_API_MODE = LOCAL_MODE;

const MODE_ALIASES = Object.freeze({
  local: LOCAL_MODE,
  demo: LOCAL_MODE,
  offline: LOCAL_MODE,
  static: LOCAL_MODE,
  http: HTTP_MODE,
  server: HTTP_MODE,
  remote: HTTP_MODE,
  api: HTTP_MODE
});

/** Normaliza `'server'`/`'demo'`/... a `'local'` o `'http'`; `null` si no vale. */
export function normalizeApiMode(value) {
  if (typeof value !== 'string') return null;
  return MODE_ALIASES[value.trim().toLowerCase()] || null;
}

/**
 * Modo efectivo del cliente, por prioridad:
 *   1. `window.__BLOKI_CRUSH__.mode` (lo inyecta el operador en runtime).
 *   2. `?mode=local|http` (diagnostico desde la URL).
 *   3. `<meta name="game-api-mode" content="local|http">` del HTML.
 *   4. `DEFAULT_API_MODE` (`local`): sin backend, la maquina arranca en fichas.
 *
 * @param {{ windowRef?: object, documentRef?: object }} [refs]
 * @returns {'local'|'http'}
 */
export function resolveApiMode({ windowRef = globalThis.window, documentRef = globalThis.document } = {}) {
  const runtime = windowRef && windowRef[RUNTIME_CONFIG_KEY];
  const fromRuntime = normalizeApiMode(runtime && runtime.mode);
  if (fromRuntime) return fromRuntime;

  try {
    const search = windowRef && windowRef.location && windowRef.location.search;
    if (search) {
      const fromUrl = normalizeApiMode(new URLSearchParams(search).get('mode'));
      if (fromUrl) return fromUrl;
    }
  } catch {
    /* URL no parseable: se ignora el override */
  }

  if (documentRef && typeof documentRef.querySelector === 'function') {
    const meta = documentRef.querySelector(`meta[name="${MODE_META_NAME}"]`);
    const fromMeta = normalizeApiMode(meta && meta.content);
    if (fromMeta) return fromMeta;
  }

  return DEFAULT_API_MODE;
}

/* -------------------------------------------------------------------------- */
/*  Validacion (mismo contrato que server/services/gameService.js)            */
/* -------------------------------------------------------------------------- */

const ROUND_REF_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const CLIENT_SEED_PATTERN = /^[\x20-\x7E]{0,64}$/;

function centsToCredits(cents) {
  return Number((cents / 100).toFixed(2));
}

function httpError(status, code, message) {
  return new ApiError({ code, message, status, kind: 'http' });
}

function validateBetCents(betCents) {
  if (!Number.isInteger(betCents)) {
    throw httpError(400, 'INVALID_BET', 'La apuesta debe expresarse en centimos enteros.');
  }
  const credits = betCents / 100;
  const allowed = engine.BET_LADDER_CREDITS.some(
    (bet) => Math.round(bet * 100) === Math.round(credits * 100)
  );
  if (!allowed) {
    throw new ApiError({
      code: 'INVALID_BET',
      message: `Apuesta no permitida. Escalera valida: ${engine.BET_LADDER_CREDITS.join(', ')}`,
      status: 400,
      kind: 'http',
      details: { betLadder: engine.BET_LADDER_CREDITS }
    });
  }
}

function validateRoundRef(roundRef) {
  if (roundRef === undefined || roundRef === null || roundRef === '') return null;
  if (typeof roundRef !== 'string' || !ROUND_REF_PATTERN.test(roundRef)) {
    throw httpError(
      400,
      'INVALID_ROUND_REF',
      'roundRef debe tener entre 8 y 64 caracteres [A-Za-z0-9_-].'
    );
  }
  return roundRef;
}

function validateClientSeed(clientSeed) {
  if (clientSeed === undefined || clientSeed === null || clientSeed === '') return undefined;
  if (typeof clientSeed !== 'string' || !CLIENT_SEED_PATTERN.test(clientSeed)) {
    throw httpError(
      400,
      'INVALID_CLIENT_SEED',
      'clientSeed debe ser texto ASCII imprimible de maximo 64 caracteres.'
    );
  }
  return clientSeed;
}

/* -------------------------------------------------------------------------- */
/*  Payload publico                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Envelope publico de una ronda: misma forma que `toPublicRound` del servidor.
 * La UI (animador, historial, HUD) consume estos nombres tal cual.
 */
function toPublicRound({ roundId, engineResult, balanceCents, currency, replayed, library = engine }) {
  const certifiedRtp = engineResult.mode === 'BUY_FEATURE'
    ? library.CERTIFIED_RTP.feature
    : library.CERTIFIED_RTP.base;

  return {
    roundId,
    replayed,
    /* true = ronda de "Fichas de Prueba": saldo virtual, sin cargo real. */
    demo: true,
    balance: {
      cents: balanceCents,
      credits: centsToCredits(balanceCents),
      currency
    },
    game: {
      code: library.GAME_CODE,
      engineVersion: engineResult.engineVersion,
      paytableVersion: engineResult.paytableVersion
    },
    mode: engineResult.mode,
    betCents: engineResult.betCents,
    betCredits: centsToCredits(engineResult.betCents),
    wagerCents: engineResult.wagerCents,
    wagerCredits: centsToCredits(engineResult.wagerCents),
    totalWinCents: engineResult.totalWinCents,
    totalWinCredits: engineResult.totalWinCredits,
    winMultiplier: Number((engineResult.totalWinCents / engineResult.betCents).toFixed(4)),
    maxWinCents: engineResult.maxWinCents,
    maxWinMultiplier: library.MAX_EXPOSURE_MULTIPLIER,
    capped: engineResult.capped,
    maxWinReached: engineResult.maxWinReached,
    spinsPlayed: engineResult.spinsPlayed,
    spinsPlanned: engineResult.spinsPlanned,
    spins: engineResult.spins,
    initialGrid: engineResult.initialGrid,
    finalGrid: engineResult.finalGrid,
    cascades: engineResult.cascades,
    scatter: engineResult.scatter,
    bombs: engineResult.bombs,
    multiplier: engineResult.multiplier,
    multiplierApplied: engineResult.multiplierApplied,
    feature: engineResult.feature || null,
    audit: {
      ...engineResult.audit,
      certifiedRtp
    }
  };
}


/* -------------------------------------------------------------------------- */
/*  Cliente local                                                             */
/* -------------------------------------------------------------------------- */

export class LocalApiClient {
  /**
   * @param {object} [options]
   * @param {() => (string|null)} [options.getToken] compatibilidad con `ApiClient`
   * @param {object|null} [options.storage] almacenamiento inyectable (tests)
   * @param {() => number} [options.now] reloj inyectable (tests)
   * @param {object} [options.library] motor alternativo (tests)
   * @param {() => string} [options.randomUUID] generador de ids (tests)
   */
  constructor({
    getToken = () => null,
    storage = null,
    now = () => Date.now(),
    library = engine,
    randomUUID = () => globalThis.crypto.randomUUID()
  } = {}) {
    this.getToken = getToken;
    this.library = library;
    this.randomUUID = randomUUID;
    this.wallet = new LocalWallet({ storage, now });
    this.cachedGameInfo = null;
    /** Identifica el transporte en `health()` y en los logs de la UI. */
    this.mode = LOCAL_MODE;
  }

  /** Equivalente a `GET /api/health`. */
  async health() {
    return {
      ok: true,
      status: 'UP',
      runtime: LOCAL_MODE,
      engineVersion: this.library.ENGINE_VERSION,
      paytableVersion: this.library.PAYTABLE_VERSION,
      dbDriver: 'local-storage',
      certifiedRtp: this.library.CERTIFIED_RTP,
      demo: true
    };
  }

  /** Equivalente a `GET /api/game`: informacion publica + parametros demo. */
  async gameInfo() {
    if (!this.cachedGameInfo) {
      this.cachedGameInfo = {
        ok: true,
        game: {
          ...this.library.gameInfo,
          demo: {
            enabled: true,
            guestId: DEMO.guestId,
            guestName: DEMO.guestName,
            currency: DEMO.currency,
            startBalanceCents: DEMO.startBalanceCents,
            startBalanceCredits: centsToCredits(DEMO.startBalanceCents)
          }
        }
      };
    }
    return this.cachedGameInfo;
  }

  /**
   * Equivalente a `POST /api/demo/session`: abre cartera virtual limpia con el
   * saldo inicial. Es tambien la via de recarga ("Fichas de Prueba").
   */
  async createDemoSession(alias = DEMO.guestId) {
    const sessionId = this.randomUUID();
    const state = this.wallet.open({ alias, sessionId });
    const ttlSeconds = DEMO.tokenTtlSeconds;

    return {
      ok: true,
      demo: true,
      token: `local.${sessionId}`,
      tokenType: 'Bearer',
      expiresAt: new Date(state.createdAt + ttlSeconds * 1000).toISOString(),
      ttlSeconds,
      sessionId,
      player: {
        id: sessionId,
        alias: state.alias,
        displayName: state.displayName,
        currency: state.currency
      },
      balance: {
        cents: state.balanceCents,
        credits: centsToCredits(state.balanceCents),
        currency: state.currency
      }
    };
  }

  /** `POST /api/session` no existe sin backend: es un despliegue de dinero real. */
  async createSession() {
    throw httpError(
      403,
      'DEV_SESSION_DISABLED',
      'El sitio estatico no emite sesiones de dinero real: usa las Fichas de Prueba.'
    );
  }

  /** Equivalente a `GET /api/player`. */
  async player() {
    const snapshot = this.wallet.snapshot();
    return {
      ok: true,
      demo: true,
      player: {
        id: snapshot.sessionId,
        displayName: snapshot.displayName,
        currency: snapshot.currency
      },
      balance: snapshot.balance,
      stats: snapshot.stats
    };
  }

  /**
   * Equivalente a `POST /api/spin`: resuelve la ronda con el motor local y la
   * liquida en la cartera virtual. Devuelve el mismo envelope que el backend.
   */
  async spin({ betCents, buyFeature = false, roundRef, clientSeed } = {}) {
    validateBetCents(betCents);
    if (typeof buyFeature !== 'boolean') {
      throw httpError(400, 'INVALID_MODE', 'buyFeature debe ser booleano.');
    }
    const ref = validateRoundRef(roundRef);
    const seed = validateClientSeed(clientSeed);

    /* Reintento idempotente: misma roundRef -> misma ronda, sin re-cobrar. */
    const replay = this.wallet.findReplay(ref);
    if (replay) {
      return { ok: true, ...replay.payload, replayed: true };
    }

    const wagerCents = buyFeature
      ? betCents * this.library.FEATURE_CONFIG.costMultiplier
      : betCents;

    /* Rechazo temprano, igual que el backend (la cartera es la autoridad). */
    if (this.wallet.snapshot().balance.cents < wagerCents) {
      throw httpError(
        402,
        'INSUFFICIENT_FUNDS',
        `Fichas de prueba insuficientes: se necesitan ${centsToCredits(wagerCents)} creditos virtuales.`
      );
    }

    const roundId = this.randomUUID();
    let engineResult;
    try {
      engineResult = this.library.playRound({
        betCents,
        buyFeature,
        clientSeed: seed,
        roundId
      });
    } catch {
      throw httpError(500, 'INTERNAL_ERROR', 'El motor no pudo resolver la ronda.');
    }

    let committed;
    try {
      committed = this.wallet.commit({
        roundRef: ref,
        roundId,
        wagerCents: engineResult.wagerCents,
        winCents: engineResult.totalWinCents,
        buildPayload: (settledCents) => toPublicRound({
          roundId,
          engineResult,
          balanceCents: settledCents,
          currency: this.wallet.currency,
          replayed: false,
          library: this.library
        })
      });
    } catch (error) {
      if (error && error.code === 'INSUFFICIENT_FUNDS') {
        throw httpError(402, 'INSUFFICIENT_FUNDS', 'Fichas de prueba insuficientes.');
      }
      throw httpError(
        400,
        (error && error.code) || 'INVALID_AMOUNT',
        (error && error.message) || 'No se pudo liquidar la ronda.'
      );
    }

    return { ok: true, ...committed.payload, replayed: committed.replayed };
  }
}

