'use strict';

/**
 * Invariantes del despliegue estatico en Vercel.
 *
 * El proyecto se publica como sitio autonomo: `public/` es la raiz del sitio y
 * no hay funciones serverless, ni Supabase, ni API. El motor matematico viaja
 * empaquetado (`public/ui/engine/blokicrushEngine.js`) y el saldo virtual vive
 * en `localStorage`. Estas comprobaciones existen porque un cambio descuidado
 * (framework, `functions`, `builds`, cabeceras) rompe el sitio o deja de
 * generar algun artefacto necesario.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(ROOT_DIR, relativePath));

function readVercelConfig() {
  return JSON.parse(read('vercel.json'));
}

function readPackageScripts() {
  return JSON.parse(read('package.json')).scripts;
}

/** Cabeceras declaradas para una ruta concreta de `vercel.json`. */
function headersFor(source) {
  const entry = readVercelConfig().headers.find((item) => item.source === source);
  assert.ok(entry, `Faltan cabeceras para "${source}" en vercel.json`);
  return Object.fromEntries(entry.headers.map((header) => [header.key, header.value]));
}

test('vercel.json publica un sitio estatico desde public/ (sin funciones)', () => {
  const config = readVercelConfig();

  assert.equal(config.framework, null, 'Sin preset: el sitio es estatico y no debe detectarse Express');
  assert.equal(config.outputDirectory, 'public', 'La raiz del sitio es public/');
  assert.equal(config.buildCommand, 'npm run vercel-build', 'El artefacto se genera en el build');
  assert.equal(config.functions, undefined, 'No hay funciones serverless: sin backend ni Supabase');
  assert.equal(config.builds, undefined, 'Usa buildCommand + outputDirectory, no "builds" manuales');
  assert.equal(config.rewrites, undefined, 'Sin rewrites: index.html se sirve como documento raiz');
});

test('vercel-build genera configuracion, motor, espejo de la UI y HTML', () => {
  const scripts = readPackageScripts();
  const steps = scripts['vercel-build'].split('&&').map((step) => step.trim());

  assert.deepEqual(steps, [
    'node scripts/build-game-config.js',
    'node scripts/build-engine.js',
    'node scripts/build-ui.js',
    'node scripts/build-index-html.js'
  ], 'El orden importa: el motor se publica antes del espejo de ui/');

  assert.equal(scripts['build:engine'], 'node scripts/build-engine.js');
  assert.match(scripts.prestart, /build-engine\.js/, '`npm start` tambien debe regenerar el motor');
  assert.match(scripts.predev, /build-engine\.js/);
});

test('public/ contiene la entrada y el motor que ejecuta el navegador', () => {
  assert.ok(exists('public/index.html'), 'Falta public/index.html');
  assert.ok(exists('ui/engine/blokicrushEngine.js'), 'Falta el bundle generado: npm run build:engine');
  assert.ok(
    exists('public/ui/engine/blokicrushEngine.js'),
    'Falta el espejo publicado del motor: npm run build:ui'
  );
  assert.equal(
    exists('index.html'),
    false,
    'index.html debe estar solo en public/ para que Vercel lo sirva como raiz'
  );

  const html = read('public/index.html');
  assert.match(html, /<script type="module" src="\/ui\/main\.js"><\/script>/);
  assert.match(
    html,
    /<meta name="game-api-mode" content="local" \/>/,
    'El HTML publicado debe arrancar en modo fichas de prueba local'
  );
});

test('las cabeceras del sitio aplican CSP y cache seguro al HTML y a la UI', () => {
  const html = headersFor('/');
  const indexFile = headersFor('/index.html');
  const ui = headersFor('/ui/(.*)');
  const assets = headersFor('/src/(.*)');

  for (const headers of [html, indexFile]) {
    assert.match(headers['Content-Security-Policy'], /default-src 'self'/);
    assert.match(headers['Content-Security-Policy'], /script-src 'self'/, 'Solo scripts del propio origen');
    assert.doesNotMatch(headers['Content-Security-Policy'], /script-src[^;]*unsafe-inline/);
    assert.match(headers['Content-Security-Policy'], /connect-src 'self' https:\/\/engine\.latingames\.net;/);
    assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
    assert.match(headers['Content-Security-Policy'], /media-src 'self'/, 'El MP3 de victoria sale del propio origen');
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['X-Frame-Options'], 'DENY');
    assert.equal(headers['Referrer-Policy'], 'no-referrer');
    assert.match(headers['Cache-Control'], /no-cache/, 'Un deploy debe verse de inmediato');
  }

  for (const headers of [ui, assets]) {
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.match(headers['Cache-Control'], /must-revalidate/, 'JS/CSS sin hash no se cachean a un ano');
    assert.doesNotMatch(headers['Cache-Control'], /immutable/);
  }
});

test('server/generated/indexHtml.js sigue reflejando public/index.html', () => {
  const { INDEX_HTML } = require('../server/generated/indexHtml');

  assert.equal(
    INDEX_HTML,
    read('public/index.html'),
    'Ejecuta `npm run build:index` despues de editar public/index.html'
  );
});

test('el backend Express queda como modo opcional (no lo despliega vercel.json)', () => {
  const config = readVercelConfig();

  assert.doesNotMatch(
    read('vercel.json'),
    /server\.js/,
    'El despliegue estatico no debe referenciar server.js'
  );
  assert.equal(config.builds, undefined);

  /* El servidor sigue disponible en local y para despliegues propios. */
  assert.ok(exists('server/index.js'));
  assert.match(
    read('server/index.js'),
    /createApp\(\s*\{\s*staticDir:\s*PUBLIC_DIR\s*\}\s*\)/,
    'En local `npm start` si debe servir public/'
  );
  assert.match(
    read('server/app.js'),
    /express\.static\(\s*staticDir,\s*\{[\s\S]*?index:\s*['"]index\.html['"]/,
    'express.static debe declarar index: "index.html" en local'
  );
});

