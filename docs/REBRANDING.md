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
| Logotipo | `BLOKICRUSH-LOGO.webp` (GIF animado `BROKI_crush_animacion-logo-LENTO.gif`) | No: reexportar arte |
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

El lockup es **cuadrado** (mascota con gorra + "BLOKI CRUSH" en letras de caramelo
dentro de una silueta redondeada) y esta **animado**: cinco fotogramas de 500 ms
en bucle infinito en los que la mascota lame el chupachus.

1. El maestro vive en `design/` (fuera de `public/`, no viaja al CDN):
   `BROKI_crush_animacion-logo-LENTO.gif`, 493 x 509 px, alfa real, ~568 KB.
2. `npm run build:logo` recorta el GIF a la tinta (489 x 480 desde 1,3), lo
   centra en un lienzo cuadrado transparente y publica
   `public/src/assets/BLOKICRUSH-LOGO.webp` (320 x 320, cinco fotogramas de
   500 ms, bucle infinito, alfa sin perdida, ~138 KB) y
   `public/src/assets/BLOKICRUSH-LOGO-quieto.webp` (el primer fotograma como
   estatico, ~41 KB). Antes de escribirlos valida el resultado: bits de animacion
   y de alfa en VP8X, bloque `ANIM`, cinco `ANMF`, duraciones intactas, alfa byte
   a byte y los topes de 200 y 80 KB.
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
min(calc(var(--frame-h) * 0.32), calc(var(--frame-h) * 0.244 + var(--slack) -
var(--logo-peak)))`, con `--logo-h: var(--logo-w)` para el 1:1) y se pega al
hueco rosa que dibuja el propio marco, corrida a la izquierda (`left` al 0,05 del
ancho) para dejar aire hasta la placa de SALDO. Por dentro del aro dorado quedan
87 x 41 px a 390 x 844. A 390 x 844 el logo mide 86 px -el doble de la chapa
original (0,149)-, desborda el aro por los cuatro lados, se apoya sobre la nube y
el toldo, y sube por encima del aro y del toldo (`bottom` 0,756 + `--logo-lift`,
hasta 0,81 del alto del marco) para quedar como una pegatina que sobresale del
dibujo; deja ~20 px de aire sobre la ventana del tablero y ~19 px hasta la primera
placa del HUD.

Ese sobrante no se da por hecho: el filo superior del marco es el filo del
escenario y `.stage` recorta (`overflow: hidden`), asi que el CSS mide el cielo
libre que la rejilla deja arriba (`--slack`, con el alto del escenario, el del
marco, la separacion de filas y el de la consola) y recorta a la vez el tamano y
la subida, descontando `--logo-peak` (4 px del salto de la animacion mas 1,1 % del
marco, lo que crece la caja en el pico del balanceo). En paisaje de movil o en
ventanas de poco alto la pegatina se encoge sola hasta caber -a 844 x 390 mide
42 px y el filo se queda dentro del marco- en vez de quedar cortada. El balanceo
baja a 2-4 px y 1,4-2 grados para no tocar ni la topbar ni las piezas.

En escritorio (>=900 px) el logo vive sobre la nube de `d5.webp` y ahora manda el
alto (`height: 75%` de `--hero-h`, centro en 34,5 %): a 1440 x 900 mide 250 px,
1,5 veces el wordmark 2:1 anterior, llena la ventana de la nube y desborda sobre
el caramelo, y aun deja 13 px de aire sobre las placas del HUD. En ventanas de
menos de 660 px de alto baja a un 62 % con el centro en 34 %.

La barra del navegador movil usa la meta `theme-color`, ya en azul de marca:
`<meta name="theme-color" content="#3a4fd8" />`.

Piel movil vigente: la dulce (`design/marco_movil.png` 1325 x 941 y
`design/consola_movil.png` 1783 x 693 —el recorte al alfa del maestro, que mide
1914 x 822—), publicados por `npm run build:art` como `marco_movil.webp` (109 KB)
y `consola_movil.webp` (274 KB), con la avenida de caramelo como fondo. El panel
de control es el «caramelo brillante»: una sola barra dorada con los cinco discos
(FEVER · AUTO · GIRAR · − · +), la corona y los caramelos de palo sobre el GIRAR
y cuatro placas de pie. Al no traer las dos pantallas de la fila superior que
tenia la piel rosa, la lectura de APUESTA baja a la mitad izquierda de la cuarta
placa y el MAX se queda en su extremo derecho (geometria medida en la seccion 4
de `style.css`). Los maestros de las pieles que se publicaron antes siguen en
`design/marco_movil_estadio.png`, `design/consola_movil_estadio.png`,
`design/avenida_estadio.png` y `design/consola_movil_rosa.png` (candy con dos
pantallas): no se publican, pero dejan rastro de los recortes que midio el CSS
movil antes del cambio.
En escritorio el arte de marca (`d1`, `d3`, `d5`) ya es el candy del rebranding.

El cartel de victoria tambien es el «caramelo brillante»: `design/victoria_dulce.png`
(1536 x 1024 con alfa, 3,0 MB) se publica con `npm run build:win` como
`victoria_dulce.webp` (1152 x 768, 409 KB, q=90 con `alphaQuality: 100`). El arte
va a sangre —12 px de aire en el lado mas ancho—, asi que el script conserva el
lienzo 3:2 que declaran `#win-art` y `.win__art` en vez de recortar un 1 %: un
maestro con aire de verdad si se recorta, y entonces el script avisa de que hay
que actualizar el HTML y el CSS. El cartel anterior (el mono de la piel dulce)
queda archivado en `design/victoria_dulce_clasica.png`.

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
