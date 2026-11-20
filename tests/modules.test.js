// Reglas de los módulos ES de web/js (D-15).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const { WEB, loadModule } = require("./load");

/** Archivos .js de web/js, recursivo. */
function jsFiles(dir = path.join(WEB, "js")) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? jsFiles(p) : d.name.endsWith(".js") ? [p] : [];
  });
}
const sources = [
  ...jsFiles().map((p) => [path.relative(WEB, p), fs.readFileSync(p, "utf8")]),
  ...["index.html", "panel.html", "privacidad.html"].map((f) => [f, fs.readFileSync(path.join(WEB, f), "utf8")]),
];

test("todo import relativo lleva ?v=__BUILD__", () => {
  // Con dos URL distintas el navegador cargaría dos instancias del mismo módulo (estado partido).
  const bad = [];
  sources.forEach(([file, src]) => {
    for (const m of src.matchAll(/\bfrom\s+["'](\.[^"']*)["']|\bimport\s*\(\s*["'](\.[^"']*)["']/g)) {
      const spec = m[1] || m[2];
      if (!spec.endsWith(".js?v=__BUILD__")) bad.push(`${file}: ${spec}`);
    }
  });
  assert.deepEqual(bad, []);
});

test("los <script> de módulo llevan ?v=__BUILD__", () => {
  const bad = [];
  sources.filter(([f]) => f.endsWith(".html")).forEach(([file, src]) => {
    for (const m of src.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
      if (!m[1].endsWith("?v=__BUILD__")) bad.push(`${file}: ${m[1]}`);
    }
  });
  assert.deepEqual(bad, []);
});

test("no quedan globales window.* de la app", () => {
  const bad = sources
    .filter(([, src]) => /window\.(ExaniConfig|Auth|Storage|Grading|Charts|Dashboard)\b/.test(src))
    .map(([file]) => file);
  assert.deepEqual(bad, []);
});

test("los módulos sin DOM al cargarse importan en Node", async () => {
  for (const f of ["config.js", "router.js", "data/auth.js", "data/storage.js", "data/catalog.js",
    "services/exam-session.js", "ui/dom.js", "ui/charts.js", "ui/icons.js", "ui/rows.js", "ui/hbars.js",
    ...fs.readdirSync(path.join(WEB, "js/domain")).map((n) => `domain/${n}`)]) {
    await assert.doesNotReject(loadModule(f), f);
  }
});

test("domain/ no usa el navegador ni importa fuera de domain/", () => {
  // La capa de dominio es pura: se prueba en Node y no depende de la página.
  const bad = [];
  sources.filter(([f]) => f.startsWith("js/domain/")).forEach(([file, src]) => {
    if (/\b(document|window|localStorage|fetch)\b/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))) bad.push(`${file}: usa el navegador`);
    for (const m of src.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
      if (!m[1].startsWith("./")) bad.push(`${file}: importa ${m[1]}`);
    }
  });
  assert.deepEqual(bad, []);
});
