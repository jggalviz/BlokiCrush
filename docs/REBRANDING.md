# Rebranding de BlokiCrush (azul vidrio / rojo / oro)

La interfaz esta partida en dos capas para poder cambiar la identidad visual
**sin tocar la logica del juego** ni el pipeline de cache:

| Capa | Archivo | Se edita para |
| --- | --- | --- |
| Maqueta base | `public/src/css/style.css` | Geometria, arte (marcos, consola), animaciones |
| Marca | `public/src/css/theme.css` | Paleta, acentos, superficies, tipografia, relieve |

`theme.css` se carga **despues** de `style.css` (ambos en `public/index.html`) y
todos sus selectores llevan el prefijo `html[data-theme="blokicrush"]`, asi
que ganan por especificidad sin `!important` y sin duplicar la maqueta.

## Que puede repintar el tema (y que no)

No todo el juego es CSS. La ultima capa de `style.css` viste la maquina con
**arte bitmap** colocado por porcentajes medidos sobre cada dibujo, asi que hay
que distinguir dos grupos antes de tocar nada:

| Superficie | Como se pinta | Editable desde `theme.css` |
| --- | --- | --- |
| Barra superior, boton "Fichas de Prueba", modal, anillo de foco | CSS | **Si** |
| Marco interior del tablero (`.board`, `.tile`) | Gradientes CSS | **Si** |
| Carcasa de controles y botones (escritorio) | Recortes de `d3.webp` | No: reexportar arte |
| Nube del logo (`.machine__hero`, escritorio) | `d5.webp` | No: reexportar arte |
| Marco del tablero (escritorio) | `d1.webp` | No: reexportar arte |
| Carcasa movil (`.machine__table`, `.controls`) | `marco_movil.webp`, `consola_movil.webp` | No: reexportar arte |
| Fondo de escenario | `fondo_desktop` / `fondo_movil` | No: reexportar arte |
| Logotipo | `BLOKICRUSH-LOGO.webp` (desde `design/BLOKICRUSH-LOGO.svg`) | No: reexportar arte |
| Simbolos del tablero | `public/src/assets/symbols/*.png` | No: reexportar arte |

La barra superior y las 30 casillas se pintan con el **azul de la consola**:
`theme.css` define `--brand-blue` / `--brand-blue-deep` (los mismos tonos que
`--gbtn-blue-*` en `style.css`) y `--brand-blue-ink` para contornos y sombras. La
barra es vidrio translucido (degradado con alfa + `backdrop-filter`) y las
casillas son vidrio azul sobre el interior palido del tablero, asi el marco del
arte —rojo, blanco y azul— queda integrado con la interfaz en vez de flotar
sobre ella.

Consecuencia practica: los tokens de caramelo de `style.css`
(`--candy-solid-body`, `--candy-solid-wash`, `--candy-rim`, `--candy-depth`,
`--gbtn-*`) **ya no se ven** en la maqueta final: el arte ocupa su lugar. Por eso
`theme.css` no los reasigna: hacerlo no cambiaria un pixel y confundiria al
siguiente que lo lea. Cuando se reexporte el arte con la paleta de marca, esos
tokens se pueden retirar de `style.css` o reutilizarse para las piezas nuevas.

## Activar / desactivar el tema

El tema **ya esta activo**: `public/index.html` abre con

```html
<html lang="es" data-theme="blokicrush">
```

Para volver al look candy original (comparativa o rollback) borra el atributo:

```html
<html lang="es">
```

Despues de editar el HTML:

```bash
npm run build:index     # public/index.html -> server/generated/indexHtml.js
npm start
```

El test `test/deploymentConfig.test.js` falla si te olvidas del `build:index`.

## Paleta

Todo se define una vez, en el bloque `:root` de `theme.css`:

```css
--brand-red: #c8102e;        /* accion, cifras, acentos */
--brand-red-dark: #8f0a1f;   /* bordes y relieve */
--brand-red-soft: #e04a5f;   /* hover / degradados */
--brand-red-tint: #fdeaec;   /* fondos suaves */
--brand-gold: #ffc21a;       /* premio y ficha del boton de prueba */
--brand-blue: #5a72f4;       /* vidrio de la barra y las casillas */
--brand-blue-deep: #2e36bc;  /* base del vidrio */
--brand-blue-ink: #101a4d;   /* contornos y sombras */
--brand-white: #ffffff;      /* superficies */
--brand-grey-50: #f7f8fa;
--brand-grey-100: #eef0f4;
--brand-grey-200: #dcdfe6;   /* bordes */
--brand-grey-700: #4a505b;   /* texto secundario */
--brand-ink: #1b1e23;        /* texto principal */
```

Los tokens historicos del tema base magenta (`--mint`, `--coral`, `--mango`) se
remapean a la paleta de marca dentro del bloque del tema. `--gold` y `--lime` se
dejan **intactos** a proposito: son el color del premio (saldo, simbolo `S9`,
placa MAX) y siguen leyendose bien sobre las superficies nuevas. Si cambia el
rojo corporativo, basta con editar `--brand-red` y sus dos variantes; para el
vidrio, `--brand-blue`, `--brand-blue-deep` y `--brand-blue-ink`.

Tipografia: `--brand-font` y `--brand-font-display` ya apuntan a los WOFF2
locales (Fredoka / Lilita One, servidos desde `public/src/assets/fonts`). Para
cambiar de familia hay que anadir los `@font-face` en `style.css` y actualizar
estas dos variables; la CSP (`font-src 'self'`) exige servir las fuentes desde
el propio origen.

## Logotipo

1. Edita el vector en `design/` (fuera de `public/`, no viaja al CDN):
   `BLOKICRUSH-LOGO.svg`, lienzo 1620 x 810 (2:1). El lienzo ya viene recortado
   al alfa real del lockup (la tinta ocupa el ~87 % del ancho), asi que el aire
   transparente no se paga en tamano percibido.
2. `npm run build:logo` rasteriza el maestro `design/BlokiCrush Logo.png`
   cuando el SVG es mas nuevo y publica
   `public/src/assets/BLOKICRUSH-LOGO.webp` (900 x 450, alfa real, < 200 KB).
   `npm run build:logo -- --from-svg` fuerza las dos etapas (SVG -> PNG maestro
   -> WebP) cuando se cambia el arte.
3. El HTML reserva la caja con la proporcion del arte:

```html
<img class="machine__logo" src="/src/assets/BLOKICRUSH-LOGO.webp"
     alt="BlokiCrush" width="480" height="240" fetchpriority="high" />
```

   El tamano reservado (`width`/`height`) evita saltos de layout y declara la
   proporcion real del arte, **2:1** (1620 x 810 en el maestro, 900 x 450 en el
   WebP servido). En movil la caja del logo (`--logo-w` / `--logo-h` en
   `style.css`) usa esa misma
   proporcion y la imagen la rellena entera; si se cambia el arte por otro de
   distinta relacion hay que actualizar ambos sitios o el `object-fit: contain`
   devolvera el aire dentro de la caja.
   En movil la caja se ata al **alto del marco** (`--logo-w: calc(var(--frame-h) *
   0.30)`, con `--logo-h` a la mitad para conservar el 2:1) y se pega dentro de la
   nube de caramelo que dibuja el propio marco (x 2,64-32,30 % y 0,00-17,85 % del
   recorte): la chapa escala con el arte en todo el rango 320-899 px, sin aire
   reservado ni tramo intermedio, y a 390 x 844 mide 81 px de ancho (21,3 % del
   marco). El balanceo de la pegatina baja a 2-4 px y 1,4-2 grados para no salir
   de la nube. En escritorio el logo ocupa el 37 % del marco (297 px a 1366 x 768,
   406 px a 1920 x 1080).
   La barra del navegador movil usa la meta `theme-color`, ya en azul de marca:
   `<meta name="theme-color" content="#3a4fd8" />`.

Piel movil vigente: la dulce (`design/marco_movil.png` 1325 x 941 y
`design/consola_movil.png` 1952 x 904, publicados como `marco_movil.webp` y
`consola_movil.webp`), con la avenida de caramelo como fondo. Los maestros de la
piel deportiva anterior siguen en `design/marco_movil_estadio.png`,
`design/consola_movil_estadio.png` y `design/avenida_estadio.png`: no se publican,
pero dejan rastro de los recortes que midio el CSS movil antes del cambio.
En escritorio el arte de marca (`d1`, `d3`, `d5`) ya es el candy del rebranding.

Los simbolos del tablero (20 PNG en `public/src/assets/symbols/`) se mapean en
`ui/lib/format.js` (`SYMBOL_IMAGE_PATH`). Si se sustituyen por iconografia de
marca, hay que conservar los nombres `candy_*.png` o actualizar ese mapeo;
`test/frontendAssets.test.js` valida que las 11 imagenes existan.

## Textos y componentes

| Zona | Archivo |
| --- | --- |
| Cabecera, HUD, botones, modal | `public/index.html` |
| Renderer del tablero, HUD, modal de reglas, overlay WIN | `ui/renderers/GameView.js` |
| Efectos (chispas, lluvia de monedas, cartel de premio) | `ui/renderers/fx.js` |
| Niveles de premio y umbrales | `ui/lib/winLevel.js` |
| Formato de importes | `ui/lib/format.js` |
| Estilos | `public/src/css/style.css` + `public/src/css/theme.css` |

Reglas de arquitectura que **no** se deben romper (`test/uiArchitecture.test.js`):
`ApiClient` es el unico modulo con red, `GameController` no toca el DOM, y los
renderers solo pintan el payload del servidor (la cifra final siempre viene del
backend).

## Cache y publicacion

- `public/ui/**` es un espejo generado desde `ui/`: tras editar `ui/` ejecuta
  `npm run build:ui` (o `npm start`, que lo hace en `prestart`). El test
  `uiArchitecture.test.js` falla si el espejo queda desactualizado.
- Ningun asset lleva hash en el nombre: se revalida en cada visita. Express envia
  `Cache-Control: no-cache` para HTML/JS/CSS (una copia vieja rompe la app: es el
  sintoma clasico de "el logo no cambia") y `public, max-age=0, must-revalidate`
  para imagenes, audio y fuentes. El navegador revalida siempre y el servidor
  responde `304` cuando el archivo no cambio; `vercel.json` aplica la misma
  politica a `/src/(.*)` y `/ui/(.*)`. `no-cache` **no** se usa en imagenes a
  proposito: con esa cabecera el modulo `fresh()` de Express desactiva el atajo
  condicional y cada recarga reenviaria el arte completo (~1 MB en movil).
- `theme.css` vive en `public/src/css/`, cubierto por la regla `/src/(.*)` de
  `vercel.json`, asi que hereda la misma politica sin cambios de configuracion.
- El arte **no** se compila en `npm start`: los WebP de `public/src/assets/**`
  solo cambian al ejecutar `npm run build:assets` (o el script de la pieza:
  `build:art`, `build:bg`, `build:desktop-art`, `build:win`, `build:logo`).
  `prestart` ejecuta `npm run check:art`, que avisa cuando un maestro de
  `design/` es mas nuevo que su WebP y nombra el comando exacto; sin ese aviso
  es facil reiniciar y creer que el arte nuevo "no se actualiza" cuando en
  realidad nunca se publico.

## Checklist al terminar el rebranding

1. `html data-theme="blokicrush"` en `public/index.html` (ya puesto).
2. `npm run build:index && npm run build:ui && npm run build:config`.
3. `npm test`: la unica familia de tests que fija la identidad candy es
   `test/frontendAssets.test.js` (fondo `#8be8ff`, arte de consola `d1/d3/d5` y
   geometria del marco). Esas aserciones describen la maqueta base; si el
   rebranding tambien cambia el arte, hay que actualizar esos valores en el
   test junto con `style.css`. El mismo test comprueba que `theme.css` siga
   siendo CSS plano, sin `!important`, con prefijo de tema y sin medidas.
4. Revisar contraste de texto (WCAG AA) sobre blanco, sobre el rojo y sobre el
   vidrio azul.
5. `npm start` + `/api/health` deben seguir mostrando `operator.mode =
   LOCAL_VIRTUAL_DEMO` y una ronda completa debe pagar igual que antes: el
   rebranding es solo presentacion.
6. Si se reexportan los assets, actualizar tambien la tabla de alcance de este
   documento y quitar de `theme.css` las excepciones que dejen de aplicar.
