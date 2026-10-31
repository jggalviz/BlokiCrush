/**
 * Cartera virtual de "Fichas de Prueba" en el navegador.
 *
 * Es el equivalente local de `server/services/demoWallet.js` para el despliegue
 * estatico (sin backend ni Supabase):
 *
 *   - El saldo vive en `localStorage` (clave `blokicrush.demo.wallet.v1`), con
 *     memoria como respaldo si el navegador bloquea el almacenamiento.
 *   - El saldo lo calcula SIEMPRE este modulo a partir del resultado del motor:
 *     la UI solo pinta `balance.cents` que devuelve `LocalApiClient`.
 *   - Idempotencia por `roundRef`: se memorizan las ultimas
 *     `DEMO.maxIdempotentRounds` rondas y un reintento devuelve la misma ronda
 *     sin volver a cobrar.
 *   - TTL deslizante (`DEMO.sessionTtlMs`): cada tirada renueva la caducidad. Si
 *     la cartera caduca (inactividad), la siguiente peticion abre una nueva con
 *     el saldo inicial, igual que reiniciar el proceso en el servidor.
 *   - Toda la contabilidad se hace en centimos enteros (nunca hay flotantes).
 */

import { DEMO } from '../config/gameConfig.js';

export const WALLET_STORAGE_KEY = 'blokicrush.demo.wallet.v1';
export const WALLET_SCHEMA = 1;

/** Valores por defecto (los mismos que publica `config/gameConfig.js`). */
export const WALLET_DEFAULTS = Object.freeze({
  guestId: DEMO.guestId,
  guestName: DEMO.guestName,
  currency: DEMO.currency,
  startBalanceCents: DEMO.startBalanceCents,
  sessionTtlMs: DEMO.sessionTtlMs,
  maxIdempotentRounds: DEMO.maxIdempotentRounds
});

/**
 * Almacenamiento tolerante a fallos: `localStorage` en el navegador o el
 * almacen inyectado en los tests. Devuelve `null` si el navegador lo bloquea.
 *
 * @param {object|null} [storage]
 * @returns {object|null}
 */
export function resolveStorage(storage) {
  if (storage) return storage;
  try {
    const fallback = globalThis.localStorage;
    if (!fallback) return null;
    const probe = '__blokicrush_wallet__';
    fallback.setItem(probe, '1');
    fallback.removeItem(probe);
    return fallback;
  } catch {
    return null;
  }
}

function centsToCredits(cents) {
  return Number((cents / 100).toFixed(2));
}

function walletError(code, status, message) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

export class LocalWallet {
  /**
   * @param {object} [options]
   * @param {object|null} [options.storage] `localStorage` o un doble de test
   * @param {() => number} [options.now]    reloj inyectable
   */
  constructor({
    storage = null,
    now = () => Date.now(),
    guestId = WALLET_DEFAULTS.guestId,
    guestName = WALLET_DEFAULTS.guestName,
    currency = WALLET_DEFAULTS.currency,
    startBalanceCents = WALLET_DEFAULTS.startBalanceCents,
    sessionTtlMs = WALLET_DEFAULTS.sessionTtlMs,
    maxIdempotentRounds = WALLET_DEFAULTS.maxIdempotentRounds
  } = {}) {
    this.storage = resolveStorage(storage);
    this.now = now;
    this.guestId = guestId;
    this.guestName = guestName;
    this.currency = currency;
    this.startBalanceCents = startBalanceCents;
    this.sessionTtlMs = sessionTtlMs;
    this.maxIdempotentRounds = maxIdempotentRounds;
    /** Respaldo en memoria cuando el navegador no permite persistir. */
    this.memoryRaw = null;
  }

  /* ------------------------------------------------------------ persistencia */

  readRaw() {
    if (!this.storage) return this.memoryRaw;
    try {
      return this.storage.getItem(WALLET_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  writeRaw(raw) {
    this.memoryRaw = raw;
    if (!this.storage) return;
    try {
      this.storage.setItem(WALLET_STORAGE_KEY, raw);
    } catch {
      /* cuota llena o almacenamiento bloqueado: se sigue en memoria */
    }
  }

  /** Estado guardado o `null` si no existe, esta corrupto o ha caducado. */
  read() {
    const raw = this.readRaw();
    if (!raw) return null;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!parsed || parsed.version !== WALLET_SCHEMA) return null;
    if (!Number.isInteger(parsed.balanceCents) || parsed.balanceCents < 0) return null;
    if (!Array.isArray(parsed.rounds)) return null;
    /* Caducada: la siguiente operacion abre cartera nueva con saldo inicial. */
    if (typeof parsed.expiresAt === 'number' && parsed.expiresAt <= this.now()) return null;
    return parsed;
  }

  save(state) {
    this.writeRaw(JSON.stringify(state));
  }

  /* -------------------------------------------------------------- ciclo vida */

  /** Abre una cartera limpia con el saldo inicial (boton "Fichas de Prueba"). */
  open({ alias, sessionId } = {}) {
    const timestamp = this.now();
    const state = {
      version: WALLET_SCHEMA,
      sessionId: sessionId || null,
      alias: alias || this.guestId,
      displayName: this.guestName,
      currency: this.currency,
      balanceCents: this.startBalanceCents,
      spinCount: 0,
      totalWageredCents: 0,
      totalWonCents: 0,
      rounds: [],
      createdAt: timestamp,
      expiresAt: timestamp + this.sessionTtlMs
    };
    this.save(state);
    return state;
  }

  /** Cartera existente o nueva; renueva el TTL (igual que `demoWallet.ensure`). */
  ensure(options) {
    const state = this.read();
    if (!state) return this.open(options);

    state.expiresAt = this.now() + this.sessionTtlMs;
    this.save(state);
    return state;
  }

  /** Descarta la cartera guardada (tests y "reiniciar fichas"). */
  clear() {
    this.writeRaw('');
  }

  /* ---------------------------------------------------------------- lectura */

  /** Ronda ya liquidada con esa referencia, o `null` (no altera el saldo). */
  findReplay(roundRef) {
    if (!roundRef) return null;
    const state = this.read();
    if (!state) return null;
    return state.rounds.find((entry) => entry.roundRef === roundRef) || null;
  }

  /** Vista publica (lo unico que se envia a la UI). */
  snapshot() {
    const state = this.ensure();
    return {
      sessionId: state.sessionId,
      alias: state.alias,
      displayName: state.displayName,
      currency: state.currency,
      balance: {
        cents: state.balanceCents,
        credits: centsToCredits(state.balanceCents),
        currency: state.currency
      },
      stats: {
        spinCount: state.spinCount,
        totalWageredCents: state.totalWageredCents,
        totalWonCents: state.totalWonCents
      }
    };
  }

  /* --------------------------------------------------------------- escritura */

  /**
   * Liquida una ronda en la cartera virtual.
   *
   * @param {object} params
   * @param {string|null} [params.roundRef] clave de idempotencia del cliente
   * @param {string} params.roundId
   * @param {number} params.wagerCents  apuesta (incluye el coste del bonus)
   * @param {number} params.winCents
   * @param {(balanceCents: number) => object} params.buildPayload
   *   recibe el saldo ya liquidado y devuelve el payload publico de la ronda
   * @returns {{ replayed: boolean, roundId: string, balanceCents: number, payload: object }}
   * @throws {Error} `code = INSUFFICIENT_FUNDS | INVALID_AMOUNT`
   */
  commit({ roundRef = null, roundId, wagerCents, winCents, buildPayload }) {
    if (roundRef) {
      const stored = this.findReplay(roundRef);
      if (stored) {
        return {
          replayed: true,
          roundId: stored.roundId,
          balanceCents: stored.balanceCents,
          payload: { ...stored.payload, replayed: true }
        };
      }
    }

    if (
      !Number.isInteger(wagerCents) || wagerCents < 0 ||
      !Number.isInteger(winCents) || winCents < 0
    ) {
      throw walletError('INVALID_AMOUNT', 400, 'Importes invalidos en la cartera virtual.');
    }

    const state = this.ensure();
    if (state.balanceCents < wagerCents) {
      throw walletError(
        'INSUFFICIENT_FUNDS',
        402,
        'Fichas de prueba insuficientes: pulsa "Fichas de Prueba" para recargar.'
      );
    }

    state.balanceCents = state.balanceCents - wagerCents + winCents;
    state.spinCount += 1;
    state.totalWageredCents += wagerCents;
    state.totalWonCents += winCents;
    state.expiresAt = this.now() + this.sessionTtlMs;

    const payload = buildPayload(state.balanceCents);

    if (roundRef) {
      state.rounds.push({ roundRef, roundId, balanceCents: state.balanceCents, payload });
      /* Se descarta la referencia mas antigua (misma politica que el servidor). */
      while (state.rounds.length > this.maxIdempotentRounds) state.rounds.shift();
    }

    this.save(state);
    return { replayed: false, roundId, balanceCents: state.balanceCents, payload };
  }
}

