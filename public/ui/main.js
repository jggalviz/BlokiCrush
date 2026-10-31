/**
 * Punto de entrada del cliente visual.
 *
 * Composicion de la capa UI:
 *   - `ApiClient` / `LocalApiClient` (services): transporte. El backend HTTP es
 *     opcional; por defecto el juego corre con el motor local en el navegador
 *     ("Fichas de Prueba"), que es lo que necesita el sitio estatico.
 *   - `SessionManager` (services): token, storage y sesion demo.
 *   - `GameController` (controllers): estado de apuesta y decisiones de flujo.
 *   - `GameView` + `RoundAnimator` (renderers): dibujado del payload.
 *   - `GameControls` (components): eventos de usuario -> acciones.
 *
 * El cliente no conoce las probabilidades: todo lo que muestra viene de
 * `gameInfo()` y de las respuestas de `spin()`, ya resueltas por el motor.
 */

import { ApiClient, ApiError } from './services/ApiClient.js';
import { LocalApiClient, HTTP_MODE, resolveApiMode } from './services/LocalApiClient.js';
import { SessionManager } from './services/SessionManager.js';
import { createSfx } from './audio/sfx.js';
import { GameView } from './renderers/GameView.js';
import { GameController } from './controllers/GameController.js';
import { GameControls } from './components/GameControls.js';

function describe(error) {
  if (error instanceof ApiError) return error.message;
  if (error && error.message) return error.message;
  return 'Error inesperado.';
}

function bootstrap() {
  const ui = new GameView();
  ui.mount();

  let session = null;
  const getToken = () => (session ? session.current() : null);

  /* Modo por defecto: `local` (motor en el navegador, sin backend). Un
     despliegue con servidor propio activa `http` con
     `<meta name="game-api-mode" content="http">` o
     `window.__BLOKI_CRUSH__ = { mode: 'http' }`. */
  const api = resolveApiMode() === HTTP_MODE
    ? new ApiClient({ getToken })
    : new LocalApiClient({ getToken });

  session = new SessionManager(api);

  const sfx = createSfx();
  const game = new GameController({ api, ui, sfx, session });
  new GameControls({ ui, controller: game }).mount();

  /* --- Arranque ---
     Sin token valido el cliente entra en modo prueba automaticamente: la
     maquina queda lista para girar con saldo virtual y sin modal previo. */
  const start = () => game.boot().catch(async (error) => {
    ui.setBusy(false);
    if (error && (error.code === 'SESSION_REQUIRED' || (error instanceof ApiError && error.isAuth))) {
      /* Sin token valido se entra en modo prueba. La puerta de token queda solo
         para cuando el servidor desactiva las fichas de prueba. */
      const demo = await game.startDemoMode({ silent: true });
      if (demo) return;

      if (!game.demoIsBlocked_()) {
        /* Fallo transitorio (red, 429, 5xx): no se pide token. */
        ui.setStatus('Modo prueba no disponible · reintenta');
        return;
      }

      ui.setStatus('Sesión requerida');
      ui.showAuthGate({
        onSubmit: (token) => {
          session.setToken(token);
          ui.setStatus('Verificando token…');
          start();
        },
        onDemo: () => {
          void game.startDemoMode();
        }
      });
      return;
    }
    ui.setStatus(`Sin conexión · ${(error && error.code) || 'ERROR'}`);
    ui.toast(describe(error), { type: 'error', timeout: 6000 });
    // eslint-disable-next-line no-console
    console.error('[blokicrush] fallo de arranque:', error);
  });

  start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
