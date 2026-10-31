'use strict';

/**
 * Cargador ESM para los modulos de `ui/**` sin bundler.
 *
 * Node no puede importar `ui/*.js` como ESM directamente (el `package.json` del
 * repo no es `type: module`), asi que cada modulo se convierte en una data URL
 * con sus imports relativos ya resueltos de forma recursiva. Asi los tests
 * ejercitan el MISMO codigo que descarga el navegador.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.join(__dirname, '..', '..');
const UI_DIR = path.join(ROOT_DIR, 'ui');

const urlCache = new Map();
const moduleCache = new Map();

function buildModuleUrl(modulePath) {
  const file = path.resolve(UI_DIR, modulePath);
  if (urlCache.has(file)) return urlCache.get(file);

  const source = fs.readFileSync(file, 'utf8').replace(
    /(\bfrom\s+['"])(\.[^'"]+)(['"])/g,
    (_match, head, specifier, tail) =>
      `${head}${buildModuleUrl(path.resolve(path.dirname(file), specifier))}${tail}`
  );

  const url = `data:text/javascript;base64,${Buffer.from(source, 'utf8').toString('base64')}`;
  urlCache.set(file, url);
  return url;
}

/** Importa (y cachea) un modulo de `ui/`, p. ej. `'services/ApiClient.js'`. */
function loadUiModule(modulePath) {
  const file = path.resolve(UI_DIR, modulePath);
  if (!moduleCache.has(file)) moduleCache.set(file, import(buildModuleUrl(modulePath)));
  return moduleCache.get(file);
}

module.exports = { ROOT_DIR, UI_DIR, buildModuleUrl, loadUiModule };
