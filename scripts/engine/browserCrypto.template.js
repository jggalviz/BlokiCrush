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

