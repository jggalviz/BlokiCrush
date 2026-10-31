/**
 * ARCHIVO GENERADO por scripts/build-engine.js. No editar a mano:
 *   npm run build:engine
 *
 * Fuentes (verbatim):
 *   - core/*.js            motor matematico autoritativo
 *   - config/gameConfig.js constantes compartidas
 *   - scripts/engine/browserCrypto.template.js  shim sincrono de node:crypto
 *
 * El bundle expone `engine` con la misma API que `require("../core")`:
 * gameInfo, playRound, createEngine, constantes y paytables. Se ejecuta en
 * el navegador para que el sitio estatico resuelva rondas de "Fichas de
 * Prueba" sin backend ni Supabase (ver docs/MODO_ESTATICO.md).
 */

export const ENGINE_BUNDLE = Object.freeze({
  entry: "core/index.js",
  cryptoShim: "node:crypto",
  modules: Object.freeze([
    "config/gameConfig.js",
    "core/constants.js",
    "core/fastRng.js",
    "core/grid.js",
    "core/index.js",
    "core/model.js",
    "core/money.js",
    "core/paytables.js",
    "core/pickers.js",
    "core/reels.js",
    "core/rng.js",
    "core/round.js",
    "core/spin.js",
  ])
});

const __modules = Object.create(null);
const __deps = {
  "config/gameConfig.js": {},
  "core/constants.js": {
    "./constants": "core/constants.js",
    "../config/gameConfig": "config/gameConfig.js"
  },
  "core/fastRng.js": {},
  "core/grid.js": {
    "./constants": "core/constants.js",
    "./money": "core/money.js"
  },
  "core/index.js": {
    "./constants": "core/constants.js",
    "./paytables": "core/paytables.js",
    "./money": "core/money.js",
    "./rng": "core/rng.js",
    "./reels": "core/reels.js",
    "./grid": "core/grid.js",
    "./spin": "core/spin.js",
    "./round": "core/round.js",
    "./model": "core/model.js"
  },
  "core/model.js": {
    "node:crypto": "node:crypto",
    "./constants": "core/constants.js",
    "./paytables": "core/paytables.js",
    "./money": "core/money.js",
    "./reels": "core/reels.js",
    "./pickers": "core/pickers.js"
  },
  "core/money.js": {
    "./constants": "core/constants.js"
  },
  "core/paytables.js": {},
  "core/pickers.js": {},
  "core/reels.js": {
    "./constants": "core/constants.js",
    "./rng": "core/rng.js",
    "./pickers": "core/pickers.js"
  },
  "core/rng.js": {
    "node:crypto": "node:crypto",
    "./constants": "core/constants.js"
  },
  "core/round.js": {
    "./constants": "core/constants.js",
    "./money": "core/money.js",
    "./rng": "core/rng.js",
    "./spin": "core/spin.js"
  },
  "core/spin.js": {
    "./constants": "core/constants.js",
    "./money": "core/money.js",
    "./reels": "core/reels.js",
    "./grid": "core/grid.js"
  }
};

function __defineModule(id, factory) {
  __modules[id] = factory;
}

/* ---------------------------------------------------------------------- */
/*  Shim sincrono de node:crypto (SHA-256 + HMAC-SHA256 + CSPRNG)         */
/* ---------------------------------------------------------------------- */
__defineModule("node:crypto", function (module, exports, require) {
/**
 * ============================================================================
 *  SHA-256 / HMAC-SHA256 SINCRONO PARA EL NAVEGADOR
 * ============================================================================
 *  Plantilla que `scripts/build-engine.js` incrusta como modulo `node:crypto`
 *  dentro del bundle del motor (`ui/engine/blokicrushEngine.js`). NO se sirve
 *  como archivo suelto ni se importa desde `ui/`.
 *
 *  Por que existe:
 *    `core/rng.js` y `core/model.js` usan `node:crypto` para el HMAC-DRBG
 *    certificado y para el checksum de las tiras. `crypto.subtle` es asincrono
 *    y el motor es sincrono, asi que el navegador necesita una implementacion
 *    sincrona equivalente. Es la misma primitiva (SHA-256 FIPS 180-4 + HMAC
 *    RFC 2104); `test/localEngine.test.js` compara la salida con `node:crypto`
 *    para impedir cualquier deriva.
 *
 *  Contrato implementado (solo lo que usa `core/`):
 *    - createHash('sha256').update(data).digest() / digest('hex')
 *    - createHmac('sha256', key).update(data).digest() / digest('hex')
 *    - randomBytes(n)     -> ByteArray (CSPRNG del navegador)
 *    - randomUUID()       -> UUID v4
 *    - Buffer.from(str|hex|bytes)
 * ============================================================================
 */

/* Constantes de ronda de SHA-256 (FIPS 180-4, 64 palabras). */
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

/* IV de SHA-256. */
const SHA256_IV = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
];

const HMAC_BLOCK_BYTES = 64;

/** Uint8Array con los accesores binarios que usa `core/` (Buffer de Node). */
class ByteArray extends Uint8Array {
  /** Codifica en hex (por defecto) o en latin1 (solo diagnostico). */
  toString(encoding) {
    if (encoding === 'hex') {
      let hex = '';
      for (let i = 0; i < this.length; i += 1) {
        hex += (this[i] < 16 ? '0' : '') + this[i].toString(16);
      }
      return hex;
    }
    let text = '';
    for (let i = 0; i < this.length; i += 1) text += String.fromCharCode(this[i]);
    return text;
  }

  /** Big-endian de 32 bits, igual que `Buffer#readUInt32BE`. */
  readUInt32BE(offset) {
    return (
      ((this[offset] << 24) |
        (this[offset + 1] << 16) |
        (this[offset + 2] << 8) |
        this[offset + 3]) >>> 0
    );
  }
}

function rotateRight(value, bits) {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

/** Copia cualquier origen soportado a un `ByteArray`. */
function toBytes(value) {
  if (value instanceof ByteArray) return value;
  if (value instanceof Uint8Array) return new ByteArray(value);
  if (value instanceof ArrayBuffer) return new ByteArray(new Uint8Array(value));
  if (Array.isArray(value)) return ByteArray.from(value);
  if (typeof value === 'string') return new ByteArray(new TextEncoder().encode(value));
  throw new TypeError('Valor binario no soportado por el shim criptografico.');
}

function toHexBytes(hex) {
  const clean = String(hex).trim();
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) {
    throw new TypeError('Cadena hexadecimal invalida.');
  }
  const out = new ByteArray(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** SHA-256 de un bloque de bytes. Devuelve 32 bytes. */
function sha256(bytes) {
  const input = toBytes(bytes);
  const bitLength = input.length * 8;
  const paddedLength = (((input.length + 8) >>> 6) + 1) * 64;
  const buffer = new Uint8Array(paddedLength);
  buffer.set(input);
  buffer[input.length] = 0x80;

  /* Longitud original en 64 bits big-endian (mensajes < 2^53 bits). */
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  const tail = paddedLength - 8;
  buffer[tail] = (high >>> 24) & 0xff;
  buffer[tail + 1] = (high >>> 16) & 0xff;
  buffer[tail + 2] = (high >>> 8) & 0xff;
  buffer[tail + 3] = high & 0xff;
  buffer[tail + 4] = (low >>> 24) & 0xff;
  buffer[tail + 5] = (low >>> 16) & 0xff;
  buffer[tail + 6] = (low >>> 8) & 0xff;
  buffer[tail + 7] = low & 0xff;

  const state = SHA256_IV.slice();
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let t = 0; t < 16; t += 1) {
      const base = offset + t * 4;
      w[t] = ((buffer[base] << 24) |
        (buffer[base + 1] << 16) |
        (buffer[base + 2] << 8) |
        buffer[base + 3]) >>> 0;
    }
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotateRight(w[t - 15], 7) ^ rotateRight(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotateRight(w[t - 2], 17) ^ rotateRight(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = state[0];
    let b = state[1];
    let c = state[2];
    let d = state[3];
    let e = state[4];
    let f = state[5];
    let g = state[6];
    let h = state[7];

    for (let t = 0; t < 64; t += 1) {
      const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sigma1 + choice + SHA256_K[t] + w[t]) >>> 0;
      const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sigma0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  const digest = new ByteArray(32);
  for (let i = 0; i < 8; i += 1) {
    digest[i * 4] = (state[i] >>> 24) & 0xff;
    digest[i * 4 + 1] = (state[i] >>> 16) & 0xff;
    digest[i * 4 + 2] = (state[i] >>> 8) & 0xff;
    digest[i * 4 + 3] = state[i] & 0xff;
  }
  return digest;
}

function assertSha256(algorithm) {
  const name = String(algorithm).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (name !== 'sha256') {
    throw new Error(`Algoritmo no soportado por el shim del navegador: ${algorithm}`);
  }
}

/** `crypto.createHash` de Node, version sincrona y solo SHA-256. */
function createHash(algorithm) {
  assertSha256(algorithm);
  const chunks = [];
  let size = 0;

  const hash = {
    update(data) {
      const bytes = toBytes(data);
      chunks.push(bytes);
      size += bytes.length;
      return hash;
    },
    digest(encoding) {
      const joined = new ByteArray(size);
      let offset = 0;
      for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.length;
      }
      const out = sha256(joined);
      return encoding === 'hex' ? out.toString('hex') : out;
    }
  };
  return hash;
}

/** `crypto.createHmac` de Node (HMAC-SHA256, RFC 2104) sincrono. */
function createHmac(algorithm, key) {
  assertSha256(algorithm);
  const rawKey = toBytes(key);
  const block = new ByteArray(HMAC_BLOCK_BYTES);
  const normalizedKey = rawKey.length > HMAC_BLOCK_BYTES ? sha256(rawKey) : rawKey;
  block.set(normalizedKey);

  const innerPad = new ByteArray(HMAC_BLOCK_BYTES);
  const outerPad = new ByteArray(HMAC_BLOCK_BYTES);
  for (let i = 0; i < HMAC_BLOCK_BYTES; i += 1) {
    innerPad[i] = block[i] ^ 0x36;
    outerPad[i] = block[i] ^ 0x5c;
  }

  const inner = createHash('sha256').update(innerPad);

  const hmac = {
    update(data) {
      inner.update(data);
      return hmac;
    },
    digest(encoding) {
      const outer = createHash('sha256').update(outerPad).update(inner.digest());
      const out = outer.digest();
      return encoding === 'hex' ? out.toString('hex') : out;
    }
  };
  return hmac;
}

/** CSPRNG del navegador (`crypto.getRandomValues`). */
function randomBytes(size) {
  const length = Number(size);
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError(`randomBytes(${size}) invalido.`);
  }
  const bytes = new ByteArray(length);
  const webCrypto = typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : null;
  if (!webCrypto || typeof webCrypto.getRandomValues !== 'function') {
    throw new Error('El navegador no expone crypto.getRandomValues: no se puede sembrar el RNG.');
  }
  /* getRandomValues admite como maximo 65536 bytes por llamada. */
  for (let offset = 0; offset < length; offset += 65536) {
    webCrypto.getRandomValues(bytes.subarray(offset, Math.min(offset + 65536, length)));
  }
  return bytes;
}

/** UUID v4 (para `roundId` y tokens locales). */
function randomUUID() {
  const webCrypto = typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : null;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') return webCrypto.randomUUID();

  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** `Buffer.from` minimo (utf8 | hex | bytes). */
const Buffer = {
  from(value, encoding) {
    if (typeof value === 'string') {
      return encoding === 'hex' ? toHexBytes(value) : toBytes(value);
    }
    return toBytes(value);
  },
  alloc(size) {
    return new ByteArray(size);
  }
};

module.exports = {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  Buffer,
  ByteArray,
  sha256
};


});

__defineModule("config/gameConfig.js", function (module, exports, require) {
'use strict';

/**
 * ============================================================================
 *  CONFIGURACION UNICA DEL JUEGO
 * ============================================================================
 *  Fuente de verdad para identidad, dimensiones, apuestas, limites, bonus y
 *  valores por defecto del entorno (incluido DEMO_MODE_ENABLED).
 *
 *  Reglas:
 *    - Solo datos: sin DOM, Express, base de datos, filesystem ni process.env.
 *    - Este archivo es CommonJS (lo consume `core/` y `server/`).
 *    - `ui/config/gameConfig.js` es un espejo ESM GENERADO para el cliente con
 *      `npm run build:config`; `public/ui/**` recibe la copia publicada. No
 *      editar esos archivos a mano.
 *    - Los valores de entorno reales se siguen leyendo en `server/config.js`;
 *      aqui viven sus DEFAULTS para que no haya copias en la logica.
 * ============================================================================
 */

/* ==========================================================================
 *  1. IDENTIDAD DEL JUEGO
 * ========================================================================== */

const GAME = Object.freeze({
  code: 'BLOKICRUSH_6X5_95_10K',
  name: 'BlokiCrush',
  engineVersion: '1.1.0',
  paytableVersion: 'BC65-95-10K-v2'
});

/* ==========================================================================
 *  2. DIMENSIONES, SIMBOLOS Y TIRAS
 * ========================================================================== */

const GRID_COLS = 6;
const GRID_ROWS = 5;
const MIN_GRID_PAY_SIZE = 8;

const GRID = Object.freeze({
  cols: GRID_COLS,
  rows: GRID_ROWS,
  cells: GRID_COLS * GRID_ROWS, // 30
  minPaySize: MIN_GRID_PAY_SIZE,
  /* Alias heredado: el minimo de pago es el mismo (8 apariciones). */
  minClusterSize: MIN_GRID_PAY_SIZE,
  /* Tramos de pago por dispersion: 8-9 / 10-11 / 12+. */
  payTiers: Object.freeze([MIN_GRID_PAY_SIZE, 10, 12]),

  /* Tira fisica determinista (ver docs/MATH_MODEL.md). */
  stripLength: 120,
  stripRunLengths: Object.freeze([1, 1, 2, 2, 3, 3, 4]),
  stripSeed: 0x7f4a7c15
});

const SCATTER = 'SC';
const MULTIPLIER = 'MX';

const SYMBOLS = Object.freeze({
  scatter: SCATTER,
  multiplier: MULTIPLIER,
  regular: Object.freeze(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9']),
  /* SCATTER y MULTIPLICADOR nunca se apilan (run = 1). */
  singleRun: Object.freeze([SCATTER, MULTIPLIER])
});

/* ==========================================================================
 *  3. APUESTAS Y LIMITES
 * ========================================================================== */

/** Escalera oficial de apuestas en creditos (validada por el backend). */
const BET_LADDER_CREDITS = Object.freeze([
  0.10, 0.20, 0.50, 1, 2, 5, 10, 20, 50, 100
]);

const DEFAULT_BET_CREDITS = 1;

const BETS = Object.freeze({
  ladderCredits: BET_LADDER_CREDITS,
  minCredits: BET_LADDER_CREDITS[0],
  maxCredits: BET_LADDER_CREDITS[BET_LADDER_CREDITS.length - 1],
  defaultCredits: DEFAULT_BET_CREDITS,
  defaultIndex: BET_LADDER_CREDITS.indexOf(DEFAULT_BET_CREDITS),
  /* Tiradas del boton Automatico en el cliente. */
  autoSpins: 10
});

const MAX_EXPOSURE_MULTIPLIER = 10000; // 10.000x
const MAX_FEATURE_SPINS = 10;
/** 1 unidad de apuesta = 10.000 micro-unidades (precision 0,0001x). */
const MICRO_PER_UNIT = 10000;

const LIMITS = Object.freeze({
  maxExposureMultiplier: MAX_EXPOSURE_MULTIPLIER,
  /* Tope de exposicion en micro-unidades de apuesta: 10.000x. */
  maxExposureMicro: MAX_EXPOSURE_MULTIPLIER * MICRO_PER_UNIT,
  maxCascadeSteps: 40,
  maxFeatureSpins: MAX_FEATURE_SPINS,
  /* Cotas internas del motor para evitar importes fuera de rango. */
  maxEngineAmountCents: 100000000
});

/* ==========================================================================
 *  4. BONUS Y RTP CERTIFICADO
 * ========================================================================== */

const FEATURE_CONFIG = Object.freeze({
  id: 'BLOKI_FEVER',
  label: 'Bloki Fever',
  costMultiplier: 100, // 100x la apuesta base
  spins: MAX_FEATURE_SPINS
});

/**
 * RTP certificado por simulacion (ver docs/MATH_MODEL.md).
 * `base` y `feature` son el RTP medido sobre la apuesta; `*StandardError` y
 * `*Ci95` documentan la precision de la medicion (error estandar en puntos
 * porcentuales). Se actualiza solo al recalibrar; NUNCA en caliente.
 */
const CERTIFIED_RTP = Object.freeze({
  target: 0.95,
  base: 0.9508,
  feature: 0.9498,
  baseStandardError: 0.0037,
  featureStandardError: 0.0016,
  baseCi95: Object.freeze([0.9434, 0.9581]),
  featureCi95: Object.freeze([0.9466, 0.9530]),
  simulatedRoundsBase: 1000000,
  simulatedRoundsFeature: 500000,
  simulatedSpinsFeature: 5000000,
  calibratedAt: '2026-10-27'
});

/* ==========================================================================
 *  5. MODO DEMO Y DEFAULTS DE ENTORNO
 * ========================================================================== */

const DEMO_CONFIG = Object.freeze({
  enabledByDefault: true,
  guestId: 'invitado_demo',
  guestName: 'Invitado Demo',
  currency: 'VES',
  startBalanceCents: 100000, // 1.000,00
  sessionTtlMs: 30 * 60 * 1000,
  tokenTtlSeconds: 2 * 60 * 60,
  maxSessions: 2000,
  maxIdempotentRounds: 5
});

/**
 * Contrato del servicio HTTP del cliente.
 *
 * `baseUrl` vacio significa mismo origen (`/api/...`). Para usar el motor
 * externo basta con definir `https://engine.latingames.net` en el runtime del
 * navegador (`window.__BLOKI_CRUSH__.apiBaseUrl`) o en
 * `<meta name="game-api-base" content="...">`; no hay que recompilar la UI.
 *
 * `connectOrigins` alimenta la CSP del backend y de Vercel. Si el motor cambia
 * de host, actualiza ambas cosas (config y cabeceras de despliegue).
 */
const API = Object.freeze({
  baseUrl: '',
  externalBaseUrl: 'https://engine.latingames.net',
  timeoutMs: 15000,
  connectOrigins: Object.freeze(['https://engine.latingames.net'])
});

/**
 * Defaults de variables de entorno. `server/config.js` lee `process.env` y usa
 * estos valores cuando la variable no esta definida; ningun otro modulo debe
 * repetir los numeros.
 */
const ENV_DEFAULTS = Object.freeze({
  NODE_ENV: 'development',
  PORT: 3000,
  ALLOWED_ORIGINS: Object.freeze(['http://localhost:3000', 'http://127.0.0.1:3000']),
  SUPABASE_SCHEMA: 'public',
  SESSION_TTL_SECONDS: 3600,
  ALLOW_DEV_SESSION: true,
  DEV_DEMO_PLAYER_ID: '00000000-0000-4000-8000-000000000001',

  /*
   * Modo autonomo local (operador virtual). El default es `false` para que en
   * produccion el backend siga exigiendo su driver real; el `.env` local lo
   * activa con 1 y `server/config.js` fuerza memoria + cartera virtual + CSP de
   * mismo origen.
   */
  BC_DEMO_OPERATOR_VIRTUAL: false,

  DEMO_MODE_ENABLED: DEMO_CONFIG.enabledByDefault,
  DEMO_GUEST_ID: DEMO_CONFIG.guestId,
  DEMO_GUEST_NAME: DEMO_CONFIG.guestName,
  DEMO_CURRENCY: DEMO_CONFIG.currency,
  DEMO_START_BALANCE_CENTS: DEMO_CONFIG.startBalanceCents,
  DEMO_SESSION_TTL_MS: DEMO_CONFIG.sessionTtlMs,
  DEMO_TOKEN_TTL_SECONDS: DEMO_CONFIG.tokenTtlSeconds,
  DEMO_MAX_SESSIONS: DEMO_CONFIG.maxSessions,
  DEMO_MAX_IDEMPOTENT_ROUNDS: DEMO_CONFIG.maxIdempotentRounds,

  MAX_EXPOSURE_MULTIPLIER,
  RATE_LIMIT_WINDOW_MS: 1000,
  RATE_LIMIT_MAX_REQUESTS: 12,
  MAX_BODY_BYTES: '8kb',
  IDEMPOTENCY_TTL_MS: 10 * 60 * 1000
});

/* ==========================================================================
 *  6. OBJETOS PUBLICOS Y EXPORTACIONES
 * ========================================================================== */

/** Configuracion que puede recibir el navegador (sin defaults de entorno). */
const PUBLIC_GAME_CONFIG = Object.freeze({
  game: GAME,
  grid: GRID,
  symbols: SYMBOLS,
  strips: Object.freeze({
    length: GRID.stripLength,
    runLengths: GRID.stripRunLengths,
    seed: GRID.stripSeed,
    singleRunSymbols: SYMBOLS.singleRun
  }),
  bets: BETS,
  limits: LIMITS,
  feature: FEATURE_CONFIG,
  rtp: CERTIFIED_RTP,
  demo: DEMO_CONFIG,
  api: API
});

/** Configuracion completa del backend (incluye defaults de entorno). */
const GAME_CONFIG = Object.freeze({
  ...PUBLIC_GAME_CONFIG,
  env: ENV_DEFAULTS
});

/**
 * Constantes planas compatibles con el contrato historico de `core/constants`.
 * Mantener los mismos nombres evita tocar las formulas del motor.
 */
const constants = Object.freeze({
  GAME_CODE: GAME.code,
  GAME_NAME: GAME.name,
  ENGINE_VERSION: GAME.engineVersion,
  PAYTABLE_VERSION: GAME.paytableVersion,

  GRID_COLS,
  GRID_ROWS,
  GRID_CELLS: GRID.cols * GRID.rows,
  MIN_GRID_PAY_SIZE,
  MIN_CLUSTER_SIZE: MIN_GRID_PAY_SIZE,

  MAX_EXPOSURE_MULTIPLIER: LIMITS.maxExposureMultiplier,
  MAX_CASCADE_STEPS: LIMITS.maxCascadeSteps,
  MAX_FEATURE_SPINS: LIMITS.maxFeatureSpins,
  MAX_ENGINE_AMOUNT_CENTS: LIMITS.maxEngineAmountCents,

  MICRO_PER_UNIT,
  MAX_EXPOSURE_MICRO: LIMITS.maxExposureMicro,

  SCATTER,
  MULTIPLIER,
  REGULAR_SYMBOLS: SYMBOLS.regular,
  BET_LADDER_CREDITS: BETS.ladderCredits,
  DEFAULT_BET_CREDITS: BETS.defaultCredits,
  DEFAULT_BET_INDEX: BETS.defaultIndex,
  AUTO_SPINS: BETS.autoSpins,

  STRIP_LENGTH: GRID.stripLength,
  STRIP_RUN_LENGTHS: GRID.stripRunLengths,
  STRIP_SEED: GRID.stripSeed,
  SINGLE_RUN_SYMBOLS: SYMBOLS.singleRun,

  FEATURE_CONFIG,
  CERTIFIED_RTP
});

module.exports = {
  GAME_CONFIG,
  PUBLIC_GAME_CONFIG,
  DEMO_CONFIG,
  ENV_DEFAULTS,

  /* API plana para `core/constants` y consumidores historicos. */
  ...constants,

  /**
   * Sub-objeto sin las constantes planas. Sirve para reexportar en el core sin
   * filtrar `GAME_CONFIG` ni metadatos de modulo.
   */
  constants
};

});

__defineModule("core/constants.js", function (module, exports, require) {
'use strict';

/**
 * Constantes del motor matematico.
 *
 * La definicion vive en `config/gameConfig.js` para que core, servidor y
 * cliente compartan una unica fuente de verdad. Este modulo conserva el
 * contrato historico (`require('./constants')`) y no contiene valores propios.
 */

module.exports = require('../config/gameConfig').constants;


});

__defineModule("core/fastRng.js", function (module, exports, require) {
'use strict';

/**
 * ============================================================================
 *  PRNG RAPIDO PARA SIMULACIONES OFFLINE (sfc32)
 * ============================================================================
 *  - Determinista: la misma semilla produce exactamente la misma secuencia.
 *  - NO se usa en produccion. El motor de juego usa siempre su HMAC-DRBG
 *    basado en `node:crypto` (ver `core/rng.js`).
 *  - `int(maxExclusive)` aplica muestreo por rechazo para no introducir sesgo
 *    modular, igual que el RNG real.
 *  - Modulo puro: no accede a DOM, UI, filesystem ni red.
 * ============================================================================
 */

/**
 * @param {number} seed semilla de 32 bits
 * @returns {{int: (maxExclusive:number)=>number, float: ()=>number, draws: ()=>number}}
 */
function createFastRng(seed) {
  let a = 0x9e3779b9;
  let b = 0x243f6a88;
  let c = 0xb7e15162;
  let d = seed >>> 0;
  let draws = 0;

  function nextUint32() {
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    draws += 1;
    return t;
  }
  for (let i = 0; i < 32; i += 1) nextUint32();

  function int(maxExclusive) {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 0x100000000) {
      throw new RangeError(`int(maxExclusive=${maxExclusive}) fuera de rango.`);
    }
    if (maxExclusive === 1) return 0;
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    let value;
    do {
      value = nextUint32();
    } while (value >= limit);
    return value % maxExclusive;
  }

  return { int, float: () => int(0x100000000) / 0x100000000, draws: () => draws };
}

module.exports = { createFastRng };

});

__defineModule("core/grid.js", function (module, exports, require) {
'use strict';

const {
  GRID_COLS,
  GRID_ROWS,
  MULTIPLIER,
  MIN_GRID_PAY_SIZE,
  REGULAR_SYMBOLS
} = require('./constants');
const { gridPayTier } = require('./money');

/**
 * Detecta los pagos por dispersion de una cuadricula.
 *
 * Cuenta TODAS las apariciones de cada simbolo regular (S1..S9) en las 30
 * celdas, sin importar adyacencia ni conectividad. Si el conteo alcanza
 * MIN_GRID_PAY_SIZE se paga el tramo correspondiente (8-9 / 10-11 / 12+) y se
 * devuelven todas las celdas del simbolo para que la cascada las elimine.
 *
 * @param {Array<Array<{s:string,v:number}>>} grid
 * @param {Record<string, Record<number, number>>} paytable micro-unidades
 * @returns {Array<{symbol:string,size:number,cells:Array<[number,number]>,
 *                  tier:number,payMicro:number}>}
 */
function findGridPays(grid, paytable) {
  const bySymbol = new Map();

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const cell = grid[row][col];
      if (!cell || !REGULAR_SYMBOLS.includes(cell.s)) continue;
      let entry = bySymbol.get(cell.s);
      if (!entry) {
        entry = [];
        bySymbol.set(cell.s, entry);
      }
      entry.push([row, col]);
    }
  }

  const pays = [];
  /* Orden normativo S1..S9 para que la auditoria sea determinista. */
  for (const symbol of REGULAR_SYMBOLS) {
    const cells = bySymbol.get(symbol);
    if (!cells || cells.length < MIN_GRID_PAY_SIZE) continue;

    const size = cells.length;
    const tier = gridPayTier(size);
    const payMicro = paytable[symbol] && paytable[symbol][tier] ? paytable[symbol][tier] : 0;
    pays.push({ symbol, size, cells, tier, payMicro });
  }

  return pays;
}

/** Lista de bombas visibles con su valor. */
function collectBombs(grid) {
  const bombs = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const cell = grid[row][col];
      if (cell && cell.s === MULTIPLIER) bombs.push({ r: row, c: col, value: cell.v });
    }
  }
  return bombs;
}

/** Matriz serializable (solo simbolos) para el cliente. */
function toMatrix(grid) {
  return grid.map((row) => row.map((cell) => (cell ? cell.s : null)));
}

module.exports = {
  findGridPays,
  collectBombs,
  toMatrix
};

});

__defineModule("core/index.js", function (module, exports, require) {
'use strict';

/**
 * ============================================================================
 *  BLOKICRUSH_6X5_95_10K  -  CORE MATEMATICO PURO
 * ============================================================================
 *  Este paquete contiene TODA la logica autoritativa del juego:
 *    - Paytables y constantes certificadas.
 *    - Generador aleatorio (CSPRNG HMAC-DRBG y PRNG offline determinista).
 *    - Construccion de tiras, gravedad y recargas.
 *    - Evaluacion 6x5, pagos por dispersion, cascadas y bombas.
 *    - Modelo matematico y resolucion de rondas.
 *
 *  Reglas de aislamiento:
 *    - Solo depende de `node:crypto` y de modulos relativos de `core/`.
 *    - No importa Express, base de datos, filesystem, DOM, canvas ni UI.
 *    - Las funciones reciben el estado/modelo por parametro y devuelven el
 *      resultado serializable de la tirada o de la ronda.
 * ============================================================================
 */

const constants = require('./constants');
const paytables = require('./paytables');
const {
  deepFreeze,
  gridPayTier,
  clusterTier
} = require('./money');
const {
  createRng,
  createSeeds
} = require('./rng');
const {
  buildStrip,
  buildStrips,
  createReelState,
  applyGravityAndRefill
} = require('./reels');
const {
  findGridPays,
  collectBombs,
  toMatrix
} = require('./grid');
const { playSpin } = require('./spin');
const { playRound } = require('./round');
const { buildModel, buildGameInfo } = require('./model');

/**
 * Crea una instancia del motor. En produccion usar la exportacion por defecto.
 * @param {object} [overrides] solo para calibracion/tests
 */
function createEngine(overrides = {}) {
  const model = buildModel(overrides);
  return {
    model,
    gameInfo: buildGameInfo(model),
    version: constants.ENGINE_VERSION,
    playRound: (options) => playRound(model, options),
    internals: {
      createRng,
      createSeeds,
      buildStrips,
      buildStrip,
      createReelState,
      applyGravityAndRefill,
      findGridPays,
      /* Alias heredado para consumidores internos existentes. */
      findClusters: findGridPays,
      collectBombs,
      toMatrix,
      playSpin: (params) =>
        playSpin({
          ...params,
          pickers: params.pickers || model.base.pickers,
          strips: params.strips || model.base.strips,
          paytable: params.paytable || model.gridPaytableMicro,
          scatterPays: params.scatterPays || model.scatterPaysMicro
        })
    }
  };
}

/** Valida que un importe en creditos pertenezca a la escalera oficial. */
function isValidBetCredits(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  const cents = Math.round(value * 100);
  if (Math.abs(value * 100 - cents) > 1e-6) return false;
  return constants.BET_LADDER_CREDITS.some((bet) => Math.round(bet * 100) === cents);
}

function creditsToCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const cents = Math.round(value * 100);
  if (cents <= 0 || Math.abs(value * 100 - cents) > 1e-6) return null;
  return cents;
}

const defaultEngine = createEngine();

module.exports = {
  /* Instancia de produccion */
  playRound: defaultEngine.playRound,
  gameInfo: defaultEngine.gameInfo,
  model: defaultEngine.model,
  createEngine,
  /* Constantes y metadatos */
  ...constants,
  ...paytables,
  /* Helpers de validacion y utilidades */
  isValidBetCredits,
  creditsToCents,
  gridPayTier,
  clusterTier,
  deepFreeze
};

});

__defineModule("core/model.js", function (module, exports, require) {
'use strict';

const crypto = require('node:crypto');

const {
  GAME_CODE,
  GAME_NAME,
  ENGINE_VERSION,
  PAYTABLE_VERSION,
  GRID_COLS,
  GRID_ROWS,
  MIN_CLUSTER_SIZE,
  MAX_EXPOSURE_MULTIPLIER,
  STRIP_LENGTH,
  STRIP_SEED,
  BET_LADDER_CREDITS,
  FEATURE_CONFIG,
  CERTIFIED_RTP
} = require('./constants');
const {
  GRID_PAYS_UNITS,
  SCATTER_PAYS_UNITS,
  BASE_WEIGHTS,
  FEATURE_WEIGHTS,
  BASE_MULTIPLIER_TABLE,
  FEATURE_MULTIPLIER_TABLE
} = require('./paytables');
const { deepFreeze, mapGridPays, mapPays } = require('./money');
const { buildStrips } = require('./reels');
const { compilePicker, compileMultiplierPicker } = require('./pickers');

/* ==========================================================================
 *  8. CONSTRUCCION DEL MODELO Y API PUBLICA DEL MOTOR
 * ========================================================================== */

/**
 * Compila un modelo matematico completo. Los `overrides` existen para la
 * calibracion offline (scripts/simulate.js) y los tests; el endpoint de
 * produccion usa SIEMPRE el modelo por defecto (createEngine() sin args).
 */
function buildModel(overrides = {}) {
  const gridPaysUnits = overrides.gridPaysUnits
    || overrides.clusterPaysUnits
    || GRID_PAYS_UNITS;
  const scatterPaysUnits = overrides.scatterPaysUnits || SCATTER_PAYS_UNITS;
  const baseWeights = overrides.baseWeights || BASE_WEIGHTS;
  const featureWeights = overrides.featureWeights || FEATURE_WEIGHTS;
  const baseMultiplierTable = overrides.baseMultiplierTable || BASE_MULTIPLIER_TABLE;
  const featureMultiplierTable = overrides.featureMultiplierTable || FEATURE_MULTIPLIER_TABLE;
  const featureConfig = Object.assign({}, FEATURE_CONFIG, overrides.featureConfig || {});

  const gridPaytableMicro = mapGridPays(gridPaysUnits);
  const model = {
    paytableVersion: overrides.paytableVersion || PAYTABLE_VERSION,
    gridPaysUnits,
    /* Alias heredado del contrato anterior. */
    clusterPaysUnits: gridPaysUnits,
    scatterPaysUnits,
    gridPaytableMicro,
    clusterPaytableMicro: gridPaytableMicro,
    scatterPaysMicro: mapPays(scatterPaysUnits),
    maxExposureMultiplier: overrides.maxExposureMultiplier || MAX_EXPOSURE_MULTIPLIER,
    base: {
      weights: baseWeights,
      multiplierTable: baseMultiplierTable,
      strips: buildStrips(baseWeights, STRIP_SEED),
      pickers: {
        symbols: compilePicker(baseWeights),
        multipliers: compileMultiplierPicker(baseMultiplierTable)
      }
    },
    feature: {
      id: featureConfig.id,
      label: featureConfig.label,
      costMultiplier: featureConfig.costMultiplier,
      spins: featureConfig.spins,
      weights: featureWeights,
      multiplierTable: featureMultiplierTable,
      strips: buildStrips(featureWeights, (STRIP_SEED ^ 0x5bd1e995) >>> 0),
      pickers: {
        symbols: compilePicker(featureWeights),
        multipliers: compileMultiplierPicker(featureMultiplierTable)
      }
    }
  };

  return deepFreeze(model);
}

/** Descripcion publica (sin logica) para /api/game y para la UI. */
function buildGameInfo(model) {
  const multiplierDistribution = {};
  for (const key of Object.keys(model.base.multiplierTable)) {
    multiplierDistribution[key] = Number(
      (model.base.multiplierTable[key] / model.base.pickers.multipliers.total).toFixed(6)
    );
  }

  /* Rango efectivo de bombas derivado del modelo (admite overrides). */
  const multiplierValues = Object.keys(model.base.multiplierTable)
    .concat(Object.keys(model.feature.multiplierTable))
    .map(Number);
  const multiplierMin = Math.min(...multiplierValues);
  const multiplierMax = Math.max(...multiplierValues);

  /* Comprobante de las tiras fisicas: permite al auditor verificar que el
     despliegue sirve exactamente las tiras certificadas. */
  const stripChecksum = crypto
    .createHash('sha256')
    .update(model.base.strips.map((strip) => strip.join('')).join('|'))
    .digest('hex');
  const composition = {};
  for (const strip of model.base.strips) {
    for (const symbol of strip) composition[symbol] = (composition[symbol] || 0) + 1;
  }
  const positions = model.base.strips.length * STRIP_LENGTH;
  const symbolDistribution = {};
  for (const symbol of Object.keys(composition)) {
    symbolDistribution[symbol] = Number((composition[symbol] / positions).toFixed(6));
  }

  return Object.freeze({
    code: GAME_CODE,
    name: GAME_NAME,
    engineVersion: ENGINE_VERSION,
    paytableVersion: model.paytableVersion,
    grid: { cols: GRID_COLS, rows: GRID_ROWS },
    payMode: 'GRID_PAYS',
    minGridPaySize: MIN_CLUSTER_SIZE,
    /* Alias heredado: mismo valor que minGridPaySize. */
    minClusterSize: MIN_CLUSTER_SIZE,
    maxExposureMultiplier: model.maxExposureMultiplier,
    betLadder: BET_LADDER_CREDITS,
    certifiedRtp: CERTIFIED_RTP,
    clusterPays: model.clusterPaysUnits,
    gridPays: model.clusterPaysUnits,
    scatterPays: model.scatterPaysUnits,
    strips: {
      length: STRIP_LENGTH,
      columns: GRID_COLS,
      checksum: stripChecksum,
      symbolDistribution
    },
    multiplier: {
      min: multiplierMin,
      max: multiplierMax,
      distribution: multiplierDistribution,
      rule: 'La suma de las bombas de la cuadricula final multiplica el total ganado.'
    },
    feature: {
      id: model.feature.id,
      label: model.feature.label,
      costMultiplier: model.feature.costMultiplier,
      spins: model.feature.spins
    },
    rules: [
      `Cuadricula fija de ${GRID_COLS}x${GRID_ROWS} con pagos por dispersion de ${MIN_CLUSTER_SIZE} o mas simbolos iguales.`,
      'Los simbolos se cuentan en cualquier posicion de la cuadricula; no hace falta que esten conectados ni adyacentes.',
      'Todas las celdas de cada simbolo ganador se eliminan y provocan cascadas hasta que no queden premios.',
      'El SCATTER y las bombas MX no se eliminan durante las cascadas; las bombas aplican su suma al final.',
      `El SCATTER paga solo en la tirada inicial: 3/4/5/6+ = ${model.scatterPaysUnits[3]}x/${model.scatterPaysUnits[4]}x/${model.scatterPaysUnits[5]}x/${model.scatterPaysUnits[6]}x.`,
      `Cada bomba vale entre ${multiplierMin}x y ${multiplierMax}x; al final de la ronda se suman y multiplican el premio.`,
      `La ganancia maxima por ronda esta limitada a ${model.maxExposureMultiplier.toLocaleString('es-ES')}x la apuesta base.`
    ]
  });
}

module.exports = { buildModel, buildGameInfo };

});

__defineModule("core/money.js", function (module, exports, require) {
'use strict';

const { MIN_GRID_PAY_SIZE, MICRO_PER_UNIT } = require('./constants');

/* ==========================================================================
 *  2. UTILIDADES
 * ========================================================================== */

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

function unitsToMicro(units) {
  return Math.round(units * MICRO_PER_UNIT);
}

function microToCents(micro, betCents) {
  if (!Number.isFinite(micro) || micro <= 0) return 0;
  return Math.floor((micro * betCents) / MICRO_PER_UNIT);
}

function mapGridPays(paysUnits) {
  const table = {};
  for (const symbol of Object.keys(paysUnits)) {
    table[symbol] = {};
    for (const size of Object.keys(paysUnits[symbol])) {
      table[symbol][Number(size)] = unitsToMicro(paysUnits[symbol][size]);
    }
    Object.freeze(table[symbol]);
  }
  return Object.freeze(table);
}

function mapPays(paysUnits) {
  const table = {};
  for (const key of Object.keys(paysUnits)) {
    table[Number(key)] = unitsToMicro(paysUnits[key]);
  }
  return Object.freeze(table);
}

/** Devuelve el tramo de pago (8 / 10 / 12) segun el conteo disperso. */
function gridPayTier(size) {
  if (size >= 12) return 12;
  if (size >= 10) return 10;
  if (size >= MIN_GRID_PAY_SIZE) return 8;
  return 0;
}

/** Alias heredado del calculo de tramos. */
const clusterTier = gridPayTier;

/**
 * Tramo de pago de scatter aplicable a `count` flores.
 * El ultimo tramo de la tabla es abierto ("6+"), asi que se acota a su clave.
 * Se memoiza por tabla para no recorrer claves en cada tirada.
 */
const scatterTopTierCache = new WeakMap();

function scatterTopTier(scatterPays) {
  let top = scatterTopTierCache.get(scatterPays);
  if (top === undefined) {
    top = Object.keys(scatterPays).reduce((max, key) => Math.max(max, Number(key) || 0), 0);
    scatterTopTierCache.set(scatterPays, top);
  }
  return top;
}

function assertInteger(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    const err = new Error(`${name} invalido: ${value}. Debe ser entero entre ${min} y ${max}.`);
    err.code = 'INVALID_ARGUMENT';
    throw err;
  }
  return value;
}

module.exports = {
  deepFreeze,
  unitsToMicro,
  microToCents,
  mapGridPays,
  mapPays,
  gridPayTier,
  clusterTier,
  scatterTopTier,
  assertInteger
};

});

__defineModule("core/paytables.js", function (module, exports, require) {
'use strict';

/* --------------------------------------------------------------------------
 *  TABLA DE PAGOS POR DISPERSION  (en multiplos de la apuesta total)
 *  Clave = cantidad minima del tramo. Los tramos son EXACTAMENTE:
 *  8-9 / 10-11 / 12+
 *  El nombre CLUSTER_PAYS_UNITS se conserva por compatibilidad de API.
 * -------------------------------------------------------------------------- */
const GRID_PAYS_UNITS = Object.freeze({
  S1: Object.freeze({ 8: 0.0927, 10: 0.2313, 12: 0.5146 }),
  S2: Object.freeze({ 8: 0.1131, 10: 0.2833, 12: 0.6685 }),
  S3: Object.freeze({ 8: 0.1386, 10: 0.3342, 12: 0.8234 }),
  S4: Object.freeze({ 8: 0.1651, 10: 0.4117, 12: 0.9762 }),
  S5: Object.freeze({ 8: 0.2109, 10: 0.5146, 12: 1.1831 }),
  S6: Object.freeze({ 8: 0.267, 10: 0.6685, 12: 1.4908 }),
  S7: Object.freeze({ 8: 0.3393, 10: 0.8234, 12: 1.8505 }),
  S8: Object.freeze({ 8: 0.4535, 10: 1.1311, 12: 2.3641 }),
  S9: Object.freeze({ 8: 0.6063, 10: 1.4908, 12: 2.9806 })
});

/** Alias historico publicado por /api/game como `clusterPays`. */
const CLUSTER_PAYS_UNITS = GRID_PAYS_UNITS;

/** Pagos de scatter segun cantidad en la cuadricula inicial (multiplos). */
const SCATTER_PAYS_UNITS = Object.freeze({
  3: 7.6,
  4: 22.7,
  5: 75.4,
  6: 226
});

const BASE_WEIGHTS = Object.freeze({
  S1: 1700,
  S2: 1550,
  S3: 1400,
  S4: 1250,
  S5: 1100,
  S6: 1000,
  S7: 900,
  S8: 800,
  S9: 700,
  SC: 310,
  MX: 175
});

/** Pesos potenciados del modo BLOKI FEVER (mas bombas, mismos pagos dispersos). */
const FEATURE_WEIGHTS = Object.freeze({
  S1: 1700,
  S2: 1550,
  S3: 1400,
  S4: 1250,
  S5: 1100,
  S6: 1000,
  S7: 900,
  S8: 800,
  S9: 700,
  SC: 310,
  MX: 1040
});

/* --------------------------------------------------------------------------
 *  1.3 TABLA DE VALORES DE BOMBA (2x..250x) - SESGADA AL RANGO BAJO
 *      Media base ~5,50x | Media feature ~15,25x
 * -------------------------------------------------------------------------- */
const BASE_MULTIPLIER_TABLE = Object.freeze({
  2: 2200,
  3: 2000,
  4: 1600,
  5: 1200,
  6: 900,
  8: 650,
  10: 450,
  12: 300,
  15: 220,
  20: 150,
  25: 90,
  50: 40,
  100: 12,
  250: 3
});

const FEATURE_MULTIPLIER_TABLE = Object.freeze({
  2: 450,
  3: 520,
  4: 620,
  5: 680,
  6: 730,
  8: 760,
  11: 780,
  13: 740,
  16: 690,
  21: 620,
  26: 520,
  52: 340,
  104: 143,
  250: 37
});

module.exports = {
  GRID_PAYS_UNITS,
  CLUSTER_PAYS_UNITS,
  SCATTER_PAYS_UNITS,
  BASE_WEIGHTS,
  FEATURE_WEIGHTS,
  BASE_MULTIPLIER_TABLE,
  FEATURE_MULTIPLIER_TABLE
};

});

__defineModule("core/pickers.js", function (module, exports, require) {
'use strict';

/* ==========================================================================
 *  4. TIRAS VIRTUALES PONDERADAS
 * ========================================================================== */

/**
 * Compila una tabla de pesos en una estructura de busqueda binaria acumulada.
 * @param {Record<string, number>} weights
 */
function compilePicker(weights) {
  const keys = Object.keys(weights);
  const symbols = [];
  const cumulative = [];
  let total = 0;
  for (const key of keys) {
    const weight = weights[key];
    if (!Number.isSafeInteger(weight) || weight < 0) {
      throw new Error(`Peso invalido para ${key}: ${weight}`);
    }
    if (weight === 0) continue;
    total += weight;
    symbols.push(key);
    cumulative.push(total);
  }
  if (total <= 0) throw new Error('La tabla de pesos no puede estar vacia.');
  return Object.freeze({
    symbols: Object.freeze(symbols),
    cumulative: Object.freeze(cumulative),
    total
  });
}

/** Selecciona una clave con probabilidad proporcional a su peso. */
function pickWeighted(picker, rng) {
  const ticket = rng.int(picker.total);
  let low = 0;
  let high = picker.cumulative.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (ticket < picker.cumulative[mid]) high = mid;
    else low = mid + 1;
  }
  return picker.symbols[low];
}

/** Compila la tabla de valores de bomba (2x..250x) con pesos acumulados. */
function compileMultiplierPicker(table) {
  const values = [];
  const cumulative = [];
  let total = 0;
  for (const key of Object.keys(table)) {
    const value = Number(key);
    const weight = table[key];
    if (!Number.isSafeInteger(value) || value < 2 || value > 250) {
      throw new Error(`Valor de multiplicador fuera de [2,250]: ${key}`);
    }
    total += weight;
    values.push(value);
    cumulative.push(total);
  }
  return Object.freeze({ values: Object.freeze(values), cumulative: Object.freeze(cumulative), total });
}

function pickMultiplier(picker, rng) {
  const ticket = rng.int(picker.total);
  let low = 0;
  let high = picker.cumulative.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (ticket < picker.cumulative[mid]) high = mid;
    else low = mid + 1;
  }
  return picker.values[low];
}

module.exports = {
  compilePicker,
  pickWeighted,
  compileMultiplierPicker,
  pickMultiplier
};

});

__defineModule("core/reels.js", function (module, exports, require) {
'use strict';

const {
  GRID_COLS,
  GRID_ROWS,
  MULTIPLIER,
  STRIP_LENGTH,
  STRIP_RUN_LENGTHS,
  SINGLE_RUN_SYMBOLS
} = require('./constants');
const { createStripRng } = require('./rng');
const { pickMultiplier } = require('./pickers');

/* ==========================================================================
 *  5. TIRAS FISICAS, GRAVEDAD Y DETECCION DE PAGOS DISPERSOS
 * ========================================================================== */

/** Celda: { s: simbolo, v: valor de bomba (0 si no es bomba) }. */
function createCell(symbol, value) {
  return { s: symbol, v: symbol === MULTIPLIER ? value : 0 };
}

function createEmptyGrid() {
  return Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(null));
}

function cloneGrid(grid) {
  return grid.map((row) => row.map((cell) => (cell ? { s: cell.s, v: cell.v } : null)));
}

function buildStrip(weights, length, seed) {
  const symbols = Object.keys(weights);
  const total = symbols.reduce((sum, symbol) => sum + weights[symbol], 0);
  const rng = createStripRng(seed);
  const strip = [];
  let guard = 0;

  while (strip.length < length) {
    guard += 1;
    if (guard > length * 100) throw new Error('No se pudo construir la tira virtual.');
    let ticket = rng.int(total);
    let symbol = symbols[symbols.length - 1];
    for (const candidate of symbols) {
      if (ticket < weights[candidate]) {
        symbol = candidate;
        break;
      }
      ticket -= weights[candidate];
    }
    const runLength = SINGLE_RUN_SYMBOLS.includes(symbol)
      ? 1
      : STRIP_RUN_LENGTHS[rng.int(STRIP_RUN_LENGTHS.length)];
    for (let i = 0; i < runLength && strip.length < length; i += 1) {
      strip.push(symbol);
    }
  }

  return Object.freeze(strip);
}

function buildStrips(weights, seed) {
  return Object.freeze(
    Array.from({ length: GRID_COLS }, (_, col) =>
      buildStrip(weights, STRIP_LENGTH, (seed ^ Math.imul(col + 1, 0x9e3779b9)) >>> 0)
    )
  );
}

function stripAt(strip, position) {
  const len = strip.length;
  return strip[((position % len) + len) % len];
}

/**
 * Extrae un simbolo de la tira. Si la posicion es MULTIPLICADOR se sortea
 * su valor (2x..250x) con el CSPRNG de la ronda.
 */
function drawFromStrip(strip, position, rng, multiplierPicker) {
  const symbol = stripAt(strip, position);
  if (symbol === MULTIPLIER) {
    return createCell(MULTIPLIER, pickMultiplier(multiplierPicker, rng));
  }
  return createCell(symbol, 0);
}

/**
 * Tirada inicial: cada columna elige una parada aleatoria (CSPRNG) y se
 * toman 5 posiciones consecutivas. La fila inferior (4) corresponde a la
 * parada; las superiores avanzan en la tira.
 */
function createReelState(rng, strips, multiplierPicker) {
  const grid = createEmptyGrid();
  const cursors = new Array(GRID_COLS).fill(0);

  for (let col = 0; col < GRID_COLS; col += 1) {
    const strip = strips[col];
    const stop = rng.int(strip.length);
    for (let i = 0; i < GRID_ROWS; i += 1) {
      const row = GRID_ROWS - 1 - i;
      grid[row][col] = drawFromStrip(strip, stop + i, rng, multiplierPicker);
    }
    cursors[col] = (stop + GRID_ROWS) % strip.length;
  }

  return { grid, cursors, strips };
}

/**
 * Aplica gravedad a cada columna y rellena los huecos desde arriba
 * continuando la tira fisica (el cursor avanza). Las bombas caen como
 * cualquier otro simbolo y NUNCA se eliminan.
 * @param {Set<number>} removedSet indices lineales (row * GRID_COLS + col)
 */
function applyGravityAndRefill(grid, removedSet, reelState, rng, multiplierPicker) {
  for (let col = 0; col < GRID_COLS; col += 1) {
    const survivors = [];
    for (let row = GRID_ROWS - 1; row >= 0; row -= 1) {
      const cell = grid[row][col];
      if (cell !== null && !removedSet.has(row * GRID_COLS + col)) {
        survivors.push(cell);
      }
    }

    let write = GRID_ROWS - 1;
    for (const cell of survivors) {
      grid[write][col] = cell;
      write -= 1;
    }

    const strip = reelState.strips[col];
    while (write >= 0) {
      grid[write][col] = drawFromStrip(strip, reelState.cursors[col], rng, multiplierPicker);
      reelState.cursors[col] = (reelState.cursors[col] + 1) % strip.length;
      write -= 1;
    }
  }
  return grid;
}

module.exports = {
  createCell,
  createEmptyGrid,
  cloneGrid,
  buildStrip,
  buildStrips,
  stripAt,
  drawFromStrip,
  createReelState,
  applyGravityAndRefill
};

});

__defineModule("core/rng.js", function (module, exports, require) {
'use strict';

const crypto = require('node:crypto');

const { ENGINE_VERSION } = require('./constants');

/* ==========================================================================
 *  3. GENERADOR ALEATORIO CRIPTOGRAFICO (CSPRNG / HMAC-DRBG)
 *     - Semilla: crypto.randomBytes(32) -> 256 bits de entropia.
 *     - Flujo: HMAC-SHA256(serverSeed, `${clientSeed}:${counter}`).
 *     - Muestreo por rechazo: elimina el sesgo modular (GLI-19 3.2.1).
 * ========================================================================== */

const UINT32_RANGE = 0x100000000; // 2^32
const DRBG_MAX_BLOCKS = 0x7fffffff;

/**
 * Crea el flujo aleatorio determinista de la ronda.
 * @param {{serverSeed: string, clientSeed: string}} seeds
 * @returns {{int: (maxExclusive:number)=>number, float: ()=>number,
 *            draws: ()=>number, getState: ()=>{counter:number}}}
 */
function createRng({ serverSeed, clientSeed }) {
  if (typeof serverSeed !== 'string' || !/^[0-9a-f]{64}$/i.test(serverSeed)) {
    throw new Error('serverSeed debe ser 32 bytes en hexadecimal (64 chars).');
  }
  const clientSeedText = typeof clientSeed === 'string' && clientSeed.length > 0
    ? clientSeed
    : 'default-client-seed';

  const key = Buffer.from(serverSeed, 'hex');
  const data = Buffer.from(clientSeedText, 'utf8');
  const mac = crypto.createHmac('sha256', key);
  mac.update(data);
  mac.update(Buffer.from(':0', 'utf8'));
  let block = mac.digest();
  let offset = 0;
  let blockCounter = 1;
  let draws = 0;

  function nextUint32() {
    if (offset + 4 > block.length) {
      if (blockCounter > DRBG_MAX_BLOCKS) {
        throw new Error('DRBG agotado: limite de bloques excedido.');
      }
      const h = crypto.createHmac('sha256', key);
      h.update(data);
      h.update(Buffer.from(`:${blockCounter}`, 'utf8'));
      block = h.digest();
      offset = 0;
      blockCounter += 1;
    }
    const value = block.readUInt32BE(offset);
    offset += 4;
    draws += 1;
    return value;
  }

  /**
   * Entero uniforme en [0, maxExclusive). Rechazo sobre el mayor multiplo
   * de maxExclusive que cabe en 2^32.
   */
  function int(maxExclusive) {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
      throw new RangeError(`int(maxExclusive=${maxExclusive}) fuera de rango.`);
    }
    if (maxExclusive === 1) return 0;
    const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
    let sample;
    do {
      sample = nextUint32();
    } while (sample >= limit);
    return sample % maxExclusive;
  }

  return {
    int,
    float: () => int(UINT32_RANGE) / UINT32_RANGE,
    draws: () => draws,
    getState: () => ({ counter: blockCounter, offset, draws })
  };
}

/** Genera el par de semillas de una ronda con el CSPRNG del sistema. */
function createSeeds(clientSeed) {
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const safeClientSeed = normalizeClientSeed(clientSeed);
  const rngHash = crypto
    .createHash('sha256')
    .update(`${serverSeed}:${safeClientSeed}:${ENGINE_VERSION}`)
    .digest('hex');
  return {
    serverSeed,
    clientSeed: safeClientSeed,
    serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
    rngHash
  };
}

/** El client seed es informativo/auditoria; se sanea y acota a 64 chars. */
function normalizeClientSeed(clientSeed) {
  if (typeof clientSeed !== 'string') return crypto.randomBytes(16).toString('hex');
  const clean = clientSeed.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 64);
  return clean.length >= 4 ? clean : crypto.randomBytes(16).toString('hex');
}

/* --------------------------------------------------------------------------
 *  5.1 CONSTRUCCION DETERMINISTA DE LAS TIRAS
 *      mulberry32 (PRNG de construccion, NO de juego) genera siempre las
 *      mismas tiras a partir de STRIP_SEED. Las tiras son parte de las
 *      reglas del juego y se publican hasheadas en /api/game para auditoria.
 * -------------------------------------------------------------------------- */
function createStripRng(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(max) {
      return Math.floor(this.next() * max);
    }
  };
}

module.exports = {
  UINT32_RANGE,
  DRBG_MAX_BLOCKS,
  createRng,
  createSeeds,
  normalizeClientSeed,
  createStripRng
};

});

__defineModule("core/round.js", function (module, exports, require) {
'use strict';

const {
  GAME_CODE,
  GAME_NAME,
  ENGINE_VERSION,
  MICRO_PER_UNIT,
  MAX_ENGINE_AMOUNT_CENTS,
  CERTIFIED_RTP
} = require('./constants');
const { assertInteger } = require('./money');
const { createRng, createSeeds } = require('./rng');
const { playSpin } = require('./spin');

/* ==========================================================================
 *  7. RONDA COMPLETA (modo base y compra de bonus)
 * ========================================================================== */

/**
 * Ejecuta una ronda autoritativa completa.
 *
 * @param {object} model     modelo matematico compilado
 * @param {object} options
 * @param {number} options.betCents        apuesta base en centimos
 * @param {boolean} [options.buyFeature]   true = BLOKI FEVER (100x bet)
 * @param {string} [options.clientSeed]    semilla informativa del cliente
 * @param {string} [options.roundId]       id de ronda (para el hash de auditoria)
 * @param {object} [options.rng]           solo tests/simulacion
 * @returns {object} resultado de la ronda
 */
function playRound(model, options = {}) {
  const {
    betCents,
    buyFeature = false,
    clientSeed,
    roundId = null,
    rng: injectedRng = null
  } = options;

  assertInteger(betCents, 'betCents', { min: 1, max: MAX_ENGINE_AMOUNT_CENTS });
  if (typeof buyFeature !== 'boolean') {
    const err = new Error('buyFeature debe ser booleano.');
    err.code = 'INVALID_ARGUMENT';
    throw err;
  }

  const seeds = injectedRng ? null : createSeeds(clientSeed);
  const rng = injectedRng || createRng(seeds);

  const creditCost = buyFeature ? model.feature.costMultiplier : 1;
  const wagerCents = betCents * creditCost;
  assertInteger(wagerCents, 'wagerCents', { min: 1, max: MAX_ENGINE_AMOUNT_CENTS });
  const maxWinCents = betCents * model.maxExposureMultiplier;

  const plannedSpins = buyFeature ? model.feature.spins : 1;
  const pickers = buyFeature ? model.feature.pickers : model.base.pickers;
  const spins = [];
  let totalWinCents = 0;
  let totalBaseWinMicro = 0;
  let capped = false;

  for (let spinIndex = 0; spinIndex < plannedSpins; spinIndex += 1) {
    const remaining = maxWinCents - totalWinCents;
    if (remaining <= 0) {
      capped = true;
      break;
    }
    const spin = playSpin({
      rng,
      pickers,
      strips: buyFeature ? model.feature.strips : model.base.strips,
      paytable: model.gridPaytableMicro,
      scatterPays: model.scatterPaysMicro,
      betCents,
      winBudgetCents: remaining,
      spinIndex
    });
    spins.push(spin);
    totalWinCents += spin.winCents;
    totalBaseWinMicro += spin.baseWinMicro;
    if (spin.capped) {
      capped = true;
      break;
    }
  }

  if (totalWinCents > maxWinCents) {
    totalWinCents = maxWinCents;
    capped = true;
  }

  const primary = spins[0];
  const isFeature = buyFeature;

  const result = {
    gameCode: GAME_CODE,
    gameName: GAME_NAME,
    engineVersion: ENGINE_VERSION,
    paytableVersion: model.paytableVersion,
    mode: isFeature ? 'BUY_FEATURE' : 'BASE',
    betCents,
    wagerCents,
    maxWinCents,
    totalWinCents,
    totalWinCredits: Number((totalWinCents / 100).toFixed(2)),
    totalBaseWinMicro,
    totalBaseWinUnits: Number((totalBaseWinMicro / MICRO_PER_UNIT).toFixed(4)),
    capped,
    maxWinReached: totalWinCents >= maxWinCents,
    spinsPlayed: spins.length,
    spinsPlanned: plannedSpins,
    spins,
    /* Acceso directo para el modo base (el cliente tambien puede usar spins[]) */
    initialGrid: isFeature ? null : primary.initialGrid,
    finalGrid: isFeature ? null : primary.finalGrid,
    cascades: isFeature ? [] : primary.cascades,
    scatter: isFeature ? null : primary.scatter,
    bombs: isFeature ? null : primary.bombs,
    multiplier: isFeature ? null : primary.multiplier,
    multiplierApplied: isFeature ? null : primary.multiplierApplied,
    audit: {
      roundId,
      serverSeed: seeds ? seeds.serverSeed : null,
      serverSeedHash: seeds ? seeds.serverSeedHash : null,
      clientSeed: seeds ? seeds.clientSeed : null,
      rngHash: seeds ? seeds.rngHash : null,
      rngDraws: typeof rng.draws === 'function' ? rng.draws() : null,
      generatedAt: new Date().toISOString(),
      certifiedRtp: CERTIFIED_RTP,
      paytableVersion: model.paytableVersion,
      engineVersion: ENGINE_VERSION
    }
  };

  if (isFeature) {
    result.feature = {
      id: model.feature.id,
      label: model.feature.label,
      costMultiplier: model.feature.costMultiplier,
      spins: model.feature.spins
    };
  }

  return result;
}

module.exports = { playRound };

});

__defineModule("core/spin.js", function (module, exports, require) {
'use strict';

const {
  GRID_COLS,
  GRID_ROWS,
  SCATTER,
  MAX_CASCADE_STEPS,
  MAX_EXPOSURE_MICRO,
  MICRO_PER_UNIT
} = require('./constants');
const { microToCents, scatterTopTier } = require('./money');
const { createReelState, applyGravityAndRefill } = require('./reels');
const { findGridPays, collectBombs, toMatrix } = require('./grid');

/* ==========================================================================
 *  6. RESOLUCION DE UNA TIRADA (con cascadas)
 * ========================================================================== */

/**
 * Ejecuta una tirada completa: drop inicial, evaluacion, cascadas y
 * recoleccion del multiplicador final.
 *
 * @param {object} params
 * @param {object} params.rng               generador (CSPRNG o inyectado en tests)
 * @param {object} params.pickers           pickers compilados del modo
 * @param {Array<Array<string>>} params.strips tiras fisicas del modo
 * @param {object} params.paytable          tabla de pagos en micro-unidades
 * @param {object} params.scatterPays       pagos de scatter en micro-unidades
 * @param {number} params.betCents          apuesta base en centimos
 * @param {number} params.winBudgetCents    maximo pagable en esta tirada
 * @param {number} params.spinIndex         indice (modo base => 0)
 * @returns {object} resultado serializable de la tirada
 */
function playSpin({
  rng, pickers, strips, paytable, scatterPays, betCents, winBudgetCents, spinIndex = 0
}) {
  const reelState = createReelState(rng, strips, pickers.multipliers);
  let grid = reelState.grid;
  const initialGrid = toMatrix(grid);

  /* --- Scatter: solo se evalua en la cuadricula inicial --- */
  const scatterCells = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      if (grid[row][col].s === SCATTER) scatterCells.push([row, col]);
    }
  }
  const scatterPayMicro = scatterPays[Math.min(scatterCells.length, scatterTopTier(scatterPays))] || 0;
  let gridWinMicro = 0;
  const cascades = [];
  let capped = false;

  /* --- Bucle de cascadas --- */
  for (let stepIndex = 0; stepIndex < MAX_CASCADE_STEPS; stepIndex += 1) {
    const gridPays = findGridPays(grid, paytable);
    if (gridPays.length === 0) break;

    const stepWinMicro = gridPays.reduce((sum, pay) => sum + pay.payMicro, 0);
    gridWinMicro += stepWinMicro;

    const removedCells = [];
    const removedSet = new Set();
    for (const pay of gridPays) {
      for (const [r, c] of pay.cells) {
        removedCells.push([r, c]);
        removedSet.add(r * GRID_COLS + c);
      }
    }

    const step = {
      index: stepIndex,
      grid: toMatrix(grid),
      bombs: collectBombs(grid),
      payType: 'GRID_PAYS',
      clusters: gridPays.map((pay) => ({
        symbol: pay.symbol,
        size: pay.size,
        tier: pay.tier,
        payMicro: pay.payMicro,
        payUnits: Number((pay.payMicro / MICRO_PER_UNIT).toFixed(4)),
        payCredits: Number(((pay.payMicro * betCents) / (MICRO_PER_UNIT * 100)).toFixed(2)),
        cells: pay.cells
      })),
      removedCells,
      winMicro: stepWinMicro,
      winCents: microToCents(stepWinMicro, betCents),
      gridAfter: null
    };

    grid = applyGravityAndRefill(grid, removedSet, reelState, rng, pickers.multipliers);
    step.gridAfter = toMatrix(grid);
    step.bombsAfter = collectBombs(grid);
    cascades.push(step);

    /* Corte por exposicion: el ganador base ya supera el tope de la ronda */
    if (gridWinMicro >= MAX_EXPOSURE_MICRO) {
      capped = true;
      break;
    }
  }

  /* --- Multiplicador: suma de bombas en la cuadricula final --- */
  const finalGrid = toMatrix(grid);
  const bombs = collectBombs(grid);
  const multiplier = bombs.length > 0
    ? bombs.reduce((sum, bomb) => sum + bomb.value, 0)
    : 1;

  const baseWinMicro = gridWinMicro + scatterPayMicro;

  /* --- Conversion monetaria unica (redondeo hacia abajo al centimo) --- */
  let winCents;
  if (baseWinMicro <= 0) {
    winCents = 0;
  } else if (baseWinMicro * multiplier >= MAX_EXPOSURE_MICRO) {
    winCents = Math.min(betCents * MAX_EXPOSURE_MULTIPLIER, winBudgetCents);
    capped = true;
  } else {
    winCents = microToCents(baseWinMicro * multiplier, betCents);
  }

  if (winCents > winBudgetCents) {
    winCents = winBudgetCents;
    capped = true;
  }

  return {
    index: spinIndex,
    initialGrid,
    finalGrid,
    cascades,
    scatter: {
      count: scatterCells.length,
      cells: scatterCells,
      payMicro: scatterPayMicro,
      payUnits: Number((scatterPayMicro / MICRO_PER_UNIT).toFixed(4)),
      payCents: microToCents(scatterPayMicro, betCents)
    },
    /* Alias heredado del contrato anterior. */
    clusterWinMicro: gridWinMicro,
    gridWinMicro,
    baseWinMicro,
    baseWinUnits: Number((baseWinMicro / MICRO_PER_UNIT).toFixed(4)),
    multiplier,
    multiplierApplied: baseWinMicro > 0 ? multiplier : 0,
    bombs,
    winCents,
    winCredits: Number((winCents / 100).toFixed(2)),
    cascadeCount: cascades.length,
    capped
  };
}

module.exports = { playSpin };

});

const __cache = Object.create(null);

/** Cargador CommonJS minimo; resuelve solo los ids declarados en __deps. */
function __require(id) {
  const cached = __cache[id];
  if (cached) return cached.exports;
  const factory = __modules[id];
  if (!factory) throw new Error(`[blokicrush] modulo ausente en el bundle: ${id}`);
  const module = { exports: {} };
  __cache[id] = module;
  const table = __deps[id] || {};
  factory(module, module.exports, (specifier) => {
    const target = table[specifier];
    if (!target) throw new Error(`[blokicrush] require no resuelto: ${specifier} (desde ${id})`);
    return __require(target);
  });
  return module.exports;
}

/** `Buffer` global que espera `core/rng.js` (lo aporta el shim). */
const Buffer = __require("node:crypto").Buffer;

/** Instancia unica del motor, igual que `module.exports` de core/index.js. */
export const engine = __require("core/index.js");

export default engine;
