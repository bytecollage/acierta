// Carga los módulos de la app para las pruebas (node --test tests/*.test.js).
// Es el único archivo que sabe cómo se cargan: si cambia la forma de los módulos, solo cambia este.
const fs = require("fs"), path = require("path"), vm = require("vm");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..");
const WEB = path.join(ROOT, "web");

/** localStorage en memoria. Las claves se exponen como propiedades para que
 *  Object.keys(localStorage) funcione como en el navegador (storage.js lo usa). */
function memoryStorage(seed = {}) {
  const ls = {};
  Object.defineProperties(ls, {
    getItem: { value: (k) => (Object.prototype.hasOwnProperty.call(ls, k) ? ls[k] : null) },
    setItem: { value: (k, v) => { ls[k] = String(v); } },
    removeItem: { value: (k) => { delete ls[k]; } },
  });
  Object.entries(seed).forEach(([k, v]) => ls.setItem(k, typeof v === "string" ? v : JSON.stringify(v)));
  return ls;
}

/** Sustituye el localStorage global (los módulos lo leen al llamarse, no al importarse). */
function setStorage(seed) {
  globalThis.localStorage = memoryStorage(seed);
  return globalThis.localStorage;
}

/** Importa web/js/<file> con la misma URL que usan los módulos entre sí (?v=__BUILD__),
 *  para compartir una sola instancia de cada uno. auth.js lee localStorage al cargarse. */
function loadModule(file) {
  if (!globalThis.localStorage) setStorage();
  return import(`${pathToFileURL(path.join(WEB, "js", file)).href}?v=__BUILD__`);
}

/** Code.gs sin servicios de Google: sirve para sus funciones puras (canonExamId, canonTitle…). */
function loadCodeGs() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "apps-script/Code.gs"), "utf8"), ctx, { filename: "Code.gs" });
  return ctx;
}

const readData = (p) => JSON.parse(fs.readFileSync(path.join(WEB, "data", p), "utf8"));

/** Convierte a objetos simples (Code.gs corre en otro contexto de vm). */
const plain = (x) => JSON.parse(JSON.stringify(x));

module.exports = { WEB, loadModule, loadCodeGs, readData, memoryStorage, setStorage, plain };
