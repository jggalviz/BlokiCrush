# Modo estático (Vercel sin backend)

Despliegue **autónomo**: el sitio se publica como estáticos y el juego se resuelve
**entero en el navegador**. No hay funciones serverless, ni `/api/*`, ni Supabase.

```
public/                     ← raíz publicada (outputDirectory de Vercel)
├── index.html              ← <meta name="game-api-mode" content="local">
├── ui/                     ← espejo GENERADO de ui/ (npm run build:ui)
│   ├── main.js             ← elige LocalApiClient (local) o ApiClient (http)
│   ├── engine/             ← MOTOR empaquetado (npm run build:engine)
│   └── services/
│       ├── LocalApiClient.js   ← "API" local: gameInfo/player/session/spin
│       └── LocalWallet.js      ← cartera virtual en localStorage
└── src/                    ← CSS, arte, fuentes y audio
```

## 1. El motor viaja al navegador

`scripts/build-engine.js` empaqueta `core/**` y `config/gameConfig.js`
**verbatim** en un único módulo ESM autocontenido,
`ui/engine/blokicrushEngine.js`, publicado luego como
`public/ui/engine/blokicrushEngine.js`.

- Un cargador CommonJS mínimo (unas 20 líneas generadas) ejecuta los módulos tal
  cual están en `core/`: no hay copia manual del motor, así que **no puede
  desincronizarse**.
- `node:crypto` se sustituye por un shim sincrónico de SHA-256/HMAC-SHA256
  (`scripts/engine/browserCrypto.template.js`), porque `crypto.subtle` es
  asíncrono y el motor es síncrono. La semilla sigue saliendo de
  `crypto.getRandomValues`.
- La API expuesta es la misma que `require('../core')`: `playRound`,
  `gameInfo`, `createEngine`, `BET_LADDER_CREDITS`, `FEATURE_CONFIG`,
  `CERTIFIED_RTP`, `MAX_EXPOSURE_MULTIPLIER`…

`test/localEngine.test.js` lo verifica en cada `npm test`:

| Comprobación | Detalle |
| --- | --- |
| Frescura | el archivo en disco es byte a byte lo que generaría el script |
| Cobertura | están todos los módulos de `core/` |
| RNG | 4.000 extracciones del HMAC-DRBG idénticas a `node:crypto` |
| Rondas | base y compra de bonus idénticas al servidor con la misma semilla |
| Metadatos | `gameInfo` (incluidas las tiras y su checksum) coincide |

## 2. Cartera virtual en el navegador

`ui/services/LocalApiClient.js` replica la superficie de `ApiClient`
(`gameInfo()`, `player()`, `createDemoSession()`, `spin()`, `health()`) y delega
el dinero en `ui/services/LocalWallet.js`:

| Regla | Implementación |
| --- | --- |
| Saldo inicial | 1.000,00 VES (`DEMO.startBalanceCents`) |
| Persistencia | `localStorage` → `blokicrush.demo.wallet.v1` (memoria si está bloqueado) |
| Contabilidad | centimos enteros; el saldo solo cambia en `commit()` |
| Idempotencia | últimas `DEMO.maxIdempotentRounds` `roundRef`; un reintento devuelve la misma ronda con `replayed: true` |
| Caducidad | TTL deslizante (`DEMO.sessionTtlMs`, 30 min): sin actividad se abre cartera nueva |
| Recarga | el botón **Fichas de Prueba** abre sesión limpia (`createDemoSession`) |
| Errores | mismos códigos y estados que el backend: `INVALID_BET` (400), `INVALID_ROUND_REF` (400), `INVALID_CLIENT_SEED` (400), `INSUFFICIENT_FUNDS` (402), `DEV_SESSION_DISABLED` (403) |

`test/localDemoMode.test.js` compara además **las claves del payload** local con
las del backend real (`POST /api/demo/session`, `GET /api/game`,
`GET /api/player`, `POST /api/spin`): si el contrato del servidor cambia, el test
falla hasta que el cliente local se actualice.

## 3. Cómo se elige el modo

`resolveApiMode()` (en `LocalApiClient.js`) respeta este orden:

1. `window.__BLOKI_CRUSH__ = { mode: 'http' | 'local' }` (runtime del operador).
2. `?mode=local` / `?mode=http` en la URL (diagnóstico).
3. `<meta name="game-api-mode" content="local">` del HTML publicado.
4. **Por defecto `local`.**

Con `local` la máquina arranca directamente en "Fichas de Prueba": saldo virtual,
sin modal de token, sin red. `http` mantiene el comportamiento anterior
(`ApiClient` → `/api/*`) para quien despliegue `server/`.

## 4. Build y verificación

```bash
npm run build:engine   # regenera ui/engine/blokicrushEngine.js desde core/
npm run build:ui       # publica el espejo public/ui/** (incluye el motor)
npm run build:index    # regenera server/generated/indexHtml.js
npm test               # contrato del motor, cartera local y despliegue
```

`npm run vercel-build` (el que usa Vercel) encadena
`build:config → build:engine → build:ui → build:index`.

## 5. Límites (léelos antes de publicar)

- **No es dinero real.** Sin servidor no hay autoridad: quien abra las
  herramientas del navegador puede editar el saldo guardado o llamar al motor
  directamente. El modo `local` existe para demos, ferias y pruebas de UX.
- La cartera es **por navegador y por origen**: borrar los datos del sitio
  reinicia las fichas (igual que reiniciar el proceso en el servidor).
- El RTP sigue siendo el certificado porque la matemática es la misma, pero la
  auditoría de servidor (`server/services/gameService.js`) no se ejecuta.
- Para operar con saldo real: `server/` + Supabase y `<meta name="game-api-mode"
  content="http">` (ver [`DEPLOY_VERCEL.md`](DEPLOY_VERCEL.md)).
