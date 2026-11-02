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
| Dock flotante (Fichas de Prueba · Sonido · Ayuda), modal, anillo de foco | CSS | **Si** |
| Marco interior del tablero (`.board`, `.tile`) | Gradientes CSS | **Si** |
| Carcasa de controles y botones (escritorio) | Recortes de `d3.webp` | No: reexportar arte |
| Nube del logo (`.machine__hero`, escritorio) | `d5.webp` | No: reexportar arte |
| Marco del tablero (escritorio) | `d1.webp` | No: reexportar arte |
| Carcasa movil (`.machine__table`, `.controls`) | `marco_movil.webp`, `consola_movil.webp` | No: reexportar arte |
| Fondo de escenario | `fondo_desktop` / `fondo_movil` | No: reexportar arte |
| Logotipo | `BLOKICRUSH-LOGO.webp` (GIF animado `BROKI_crush_animacion-logo-LENTO.gif`) | No: reexportar arte |
| Simbolos del tablero | `public/src/assets/symbols/*.png` | No: reexportar arte |

La **barra superior azul ya no existe** y el **bloque de marca tampoco**: el
encabezado solo aloja el dock con los tres controles en la esquina superior
derecha (ver «Controles flotantes» mas abajo). Lo que sigue pintandose
con el **azul de la consola** son las 30 casillas y las tres placas del dock:
`theme.css` define `--brand-blue` / `--brand-blue-deep` (los mismos tonos que
`--gbtn-blue-*` en `style.css`) y `--brand-blue-ink` para contornos y sombras.
Las casillas son vidrio azul sobre el interior palido del tablero, asi el marco
del arte —rojo, blanco y azul— queda integrado con la interfaz en vez de flotar
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
--brand-blue: #5a72f4;       /* vidrio de las casillas y tinta del dock */
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

El lockup es **cuadrado** (mascota con gorra + "BLOKI CRUSH" en letras de caramelo
dentro de una silueta redondeada) y esta **animado**: seis fotogramas en bucle
infinito en los que la mascota lame el chupachus. Los tiempos no son uniformes —
500 ms el primero y 1,7 s + 4 x 2,5 s el resto, o sea 12,2 s por vuelta —, que es
la version «lento corregido» de la animacion.

1. El maestro vive en `design/` (fuera de `public/`, no viaja al CDN):
   `BROKI_crush_animacion-logo-LENTO.gif`, 493 x 509 px, alfa real, ~592 KB. El
   ciclo anterior (cinco fotogramas de 500 ms) queda archivado en
   `design/BROKI_crush_animacion-logo-rapido.gif`.
2. `npm run build:logo` recorta el GIF a la tinta (489 x 480 desde 1,3), lo
   centra en un lienzo cuadrado transparente y publica
   `public/src/assets/BLOKICRUSH-LOGO.webp` (320 x 320, seis fotogramas con sus
   tiempos intactos, bucle infinito, alfa sin perdida, ~140 KB) y
   `public/src/assets/BLOKICRUSH-LOGO-quieto.webp` (el primer fotograma como
   estatico, ~42 KB). Antes de escribirlos valida el resultado: bits de animacion
   y de alfa en VP8X, bloque `ANIM`, seis `ANMF`, duraciones una a una contra el
   maestro, alfa byte a byte y los topes de 200 y 80 KB.
3. `npm run build:logo -- --estatico` conserva la ruta anterior (vector
   `BLOKICRUSH-LOGO.svg` 1620 x 810 -> maestro `BlokiCrush Logo.png` -> WebP
   estatico de 900 x 450) para volver al wordmark sin rastrear commits.
4. El HTML reserva la caja con la proporcion del arte:

```html
<picture>
  <source srcset="/src/assets/BLOKICRUSH-LOGO-quieto.webp" type="image/webp"
          media="(prefers-reduced-motion: reduce)" />
  <img class="machine__logo" src="/src/assets/BLOKICRUSH-LOGO.webp"
       alt="BlokiCrush" width="320" height="320" fetchpriority="high" />
</picture>
```

   El `<source>` sirve el fotograma quieto cuando el sistema pide movimiento
   reducido (`style.css` neutraliza ademas el balanceo de la pegatina) y el
   `<picture>` se pinta con `display: contents`, asi que no crea caja y el `img`
   sigue siendo el elemento posicionado. El test comprueba que el quieto no
   traiga bloque `ANIM` y que ambos midan 320 x 320.

   El tamano reservado (`width`/`height`) evita saltos de layout y declara la
   proporcion real del arte, **1:1** (320 x 320 en el WebP servido). Si se cambia
   el arte por otro de distinta relacion hay que actualizar el HTML, la caja del
   CSS y `test/frontendAssets.test.js`, o el `object-fit: contain` devolvera aire
   dentro de la caja.

En movil (320-899 px) la caja se ata al **alto del marco** (`--logo-w:
calc(var(--frame-h) * 0.394)`, con `--logo-h: var(--logo-w)` para el 1:1) y se
coloca en el **hueco de la guirnalda** que dibuja el propio marco nuevo: el
hueco mide 6,39-37,36 % del ancho y 7,39-29,21 % del alto del recorte, o sea
431 x 245 px del dibujo. El lado de la pegatina mide 0,394 del alto del marco
—442 px del dibujo, 124 px a 390 x 844—, que es 31,79 % del ancho contra los
30,97 % del hueco: **llena el hueco de lado a lado** y solo se apoya en los
caramelos de la guirnalda por la derecha, sin llegar nunca a la primera placa
del HUD (41,16 %, ~12 px de aire a 390).

Hacia arriba y hacia abajo el hueco es más corto que un lockup cuadrado, así que
la caja se centra en el pasillo que va del filo del marco a la **ventana del
tablero** (37,90 % del alto = 426 px del dibujo): sobran 0,015 del alto, 0,0075
por arriba y 0,0075 por abajo. Como el alfa del WebP empieza en 0,94 % y acaba
en 98,75 % de la caja, lo pintado sobresale ~1 px sobre el filo del marco y baja
~0,8 px dentro de la banda de cristal del tablero, todavía 1,3-1,5 px por encima
de la primera fila (el `padding` de la ventana absorbe ese pelo). Medido en
Chrome a 320, 360, 375, 390, 414, 760, 844 y 899 px de ancho; el balanceo solo
sube la chapa (nunca la baja de su sitio), así que no gana desbordamiento.

Como el hueco vive DENTRO del dibujo, el CSS ya no mide el aire que el escenario
deja arriba (`--slack` y `--logo-peak` desaparecieron con la piel anterior).

En escritorio (>=900 px) el logo vive sobre la nube de `d5.webp` y ahora manda el
alto (`height: 75%` de `--hero-h`, centro en 34,5 %): a 1440 x 900 mide 250 px,
1,5 veces el wordmark 2:1 anterior, llena la ventana de la nube y desborda sobre
el caramelo, y aun deja 13 px de aire sobre las placas del HUD. En ventanas de
menos de 660 px de alto baja a un 62 % con el centro en 34 %.

La barra del navegador movil usa la meta `theme-color`, ya en azul de marca:
`<meta name="theme-color" content="#3a4fd8" />`.

## Controles flotantes (sin barra)

La barra azul alargada que agrupaba marca y controles se retiro, y con ella el
bloque superior de informacion (insignia de la cuadricula, chapa «6×5» y leyenda
comercial). Hoy el encabezado solo aloja un dock `position: fixed` que **no gasta
alto** ni entra en la maqueta, asi que el tablero se queda con la pantalla entera
(`--board-chrome` y `--d-chrome` bajaron en consecuencia):

| Capa | Archivo | Que pinta |
| --- | --- | --- |
| `.masthead` | `style.css` | Envoltorio sin caja (`display: contents`): no participa del layout |
| `.dock` > `.dock__btn` | `style.css` (relieve) + `theme.css` (paleta) | Tres placas independientes: `--wallet`, `--sound`, `--help` |

- **Fichas de Prueba** (`#btn-demo`, `.dock__btn--wallet`): cara azul de gominola
  (celeste → azul → azul profundo, la gama de `--gbtn-blue-*`) con marco dorado,
  ficha y texto en dos lineas (titulo + saldo). El estado de modo
  activo se sigue leyendo de `aria-pressed`, que enciende un anillo de oro.
- **Sonido** (`#btn-sound`, `.dock__btn--sound`): placa cuadrada celeste, sin
  texto, con el mismo marco dorado. Silenciado lo pinta `aria-pressed="false"`:
  la cruz sustituye a las ondas y el cristal baja de contraste sin desaparecer.
- **Ayuda** (`#btn-help`, `.dock__btn--help`): misma placa celeste con el
  interrogante **y el rotulo «Ayuda»** visible, para que no haya que adivinar
  para que sirve.

Las tres comparten el idioma de la botonera del juego: borde de 3 px con
degradado (cara en `padding-box`, marco en `border-box`), brillo de cristal
recortado con `mask-image`, sombras interiores, relieve inferior solido y
hundimiento de 3 px en `:active`. Las variables `--dock-rim-gold`,
`--dock-rim-glass`, `--dock-wallet-face`, `--dock-glass-face` y `--dock-lift`
viven en `.dock`.

El dock va en la esquina superior derecha (`--wallet` · `--sound` · `--help`) en
todos los anchos: al no quedar una segunda capa no hay nada que ocultar en
movil. En escritorio (`min-width: 900px`) se separa del borde del viewport
(`--dock-inset-top: 14px` y `--dock-inset-right: 22px`, ambos con
`env(safe-area-inset-*)`) y reserva una franja superior (`--dock-clear: 72px`)
que el marco del tablero descuenta dentro de `--frame-h`: como el marco se centra
en el alto disponible, el toldo arranca por debajo de las placas aunque el ancho
permitiese un tablero mas alto. Medido con `--dump-dom` a 2560 x 1440,
1920 x 1080, 1440 x 900, 1366 x 768, 1280 x 720, 1600 x 700, 1180 x 820,
1024 x 768 y 900 x 700: el aire entre la placa y el toldo nunca baja de 12 px
(el peor caso es 1366 x 768, que antes se solapaba 14 px). Por debajo de 900 px
el dock conserva sus 6 px de siempre y nada de esto interviene.

Piel movil vigente: la **guirnalda** (`design/marco_movil.png` 1392 x 1123 —el
recorte al alfa del maestro, que mide 1392 x 1130— y `design/consola_movil.png`
1783 x 693), publicados por `npm run build:art` como `marco_movil.webp` (247 KB,
q=90) y `consola_movil.webp` (274 KB), con la avenida de caramelo como fondo. El
marco nuevo cambia la placa rosa de la nube por una **guirnalda de piruletas y
caramelos con un hueco transparente** donde se apoya el logo, y es mas alto que
el anterior (1,240:1 contra 1,408:1), asi que la maqueta movil entera se movio
con el: `--frame-h` pasa a 0,8068 del ancho, el divisor de `--m-w` a 1,1955, la
ventana del tablero a 6,05-94,15 % x · 37,90-95,75 % y la franja del HUD a
41,16-92,96 % x · 23,60-29,48 % y (el relleno morado de las tres placas, que es
lo unico que queda dentro del aro dorado y de su bisel: por eso la tipografia del
HUD baja a 0,0148 / 0,0262 del ancho del marco). El precio de la franja superior
mas alta es un tablero ~8 % mas bajo a igual ancho de maquina.
El panel de control es el «caramelo brillante»: una sola barra dorada con los
cinco discos (FEVER · AUTO · GIRAR · − · +), la corona y los caramelos de palo
sobre el GIRAR y cuatro placas de pie. Al no traer las dos pantallas de la fila
superior que tenia la piel rosa, la lectura de APUESTA baja a la mitad izquierda
de la cuarta placa y el MAX se queda en su extremo derecho (geometria medida en
la seccion 4 de `style.css`). Los maestros de las pieles que se publicaron antes
siguen en `design/marco_movil_nube.png` (la placa rosa de la nube),
`design/marco_movil_estadio.png`, `design/consola_movil_estadio.png`,
`design/avenida_estadio.png` y `design/consola_movil_rosa.png` (candy con dos
pantallas): no se publican, pero dejan rastro de los recortes que midio el CSS
movil antes del cambio.
En escritorio el arte de marca (`d1`, `d3`, `d5`) ya es el candy del rebranding.

El cartel de victoria tambien es el «caramelo brillante»: `design/victoria_dulce.png`
(1536 x 1024 con alfa, 2,8 MB) se publica con `npm run build:win` como
`victoria_dulce.webp` (1152 x 768, 406 KB, q=90 con `alphaQuality: 100`). El arte
va a sangre —25 px de aire a la izquierda y 3 px arriba en el maestro actual—,
asi que el script conserva el lienzo 3:2 que declaran `#win-art` y `.win__art`
en vez de recortar un 1,6 %: un maestro con aire de verdad si se recorta, y
entonces el script avisa de que hay que actualizar el HTML y el CSS. El cartel
anterior (la piel dulce del mono) queda archivado en
`design/victoria_dulce_clasica.png`, y el del mismo arte con la gorra «1xBet»
—sustituido por el de la gorra «MeridianoBet»— en
`design/victoria_dulce_1xbet.png`. Los tres comparten medidas, asi que cambiar
de uno a otro es solo `npm run build:win`.

Los simbolos del tablero (20 PNG en `public/src/assets/symbols/`) se mapean en
`ui/lib/format.js` (`SYMBOL_IMAGE_PATH`). Si se sustituyen por iconografia de
marca, hay que conservar los nombres `candy_*.png` o actualizar ese mapeo;
`test/frontendAssets.test.js` valida que las 11 imagenes existan.

## Modal de reglas y tabla de pagos

El modal dejo de ser una tarjeta clara con texto casi blanco encima (ilegible) y
paso a ser una placa de caramelo oscuro con marco dorado:

| Pieza | `style.css` (maqueta y material) | `theme.css` (marca) |
| --- | --- | --- |
| `.modal__card` | Bisel de 3 px: cara en `padding-box` y marco en `border-box` | Cara granate `#57170e → #3a0a10 → #23060e`, marco de oro y brillo interior de 70 px |
| `.modal__head` | Alto, padding y filo inferior; titulo en `--font-display` | Velo y filo de oro; titulo en blanco nitido con sombra calida |
| `.modal__close` | Placa de 36 px (34 en movil) con el bisel y el hundimiento del dock | Cristal sobre granate con el mismo marco de oro del dock |
| `.modal__body` | 13 px / 1.6, subtitulos con filo, scroll fino | Texto `rgba(255, 250, 245, .9)`, subtitulos y `strong` en oro/blanco |
| `.paytable` | Cabecera en mayusculas, celdas de 9 x 10 px, filas alternas, scroll propio | Cabecera en oro y multiplicadores en `#ffdc6e` |

- El cierre es `<button class="modal__close" id="btn-modal-close">` con el aspa en
  **SVG**: conserva el `id` y el `aria-label="Cerrar"` que usa `GameView`, asi que
  el contrato del controlador no cambia.
- Cada tabla va envuelta en `.paytable__scroll` (lo genera
  `ui/renderers/GameView.js`): a 320 px se desplaza sola en vez de ensanchar el
  modal. El simbolo es `<th scope="row">` y las columnas `<th scope="col">`, de
  modo que la tabla se anuncia como una matriz.
- `test/frontendAssets.test.js` calcula el ratio WCAG real de titulo, subtitulos,
  parrafos y multiplicadores contra la parada mas clara de la cara (todas las
  paradas deben tener luminancia < 0,1): el minimo exigido es 4,5:1 y el medido
  en vivo a 1280 x 800, 1440 x 900, 760 x 900, 390 x 844, 320 x 568 y 844 x 390
  queda entre 8,0:1 y 15,2:1, con `scrollX = 0`.

## Textos y componentes

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
   cristal del dock.
5. `npm start` + `/api/health` deben seguir mostrando `operator.mode =
   LOCAL_VIRTUAL_DEMO` y una ronda completa debe pagar igual que antes: el
   rebranding es solo presentacion.
6. Si se reexportan los assets, actualizar tambien la tabla de alcance de este
   documento y quitar de `theme.css` las excepciones que dejen de aplicar.
