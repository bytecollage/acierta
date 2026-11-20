// Rutas por hash (router.js, D-16).
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadModule, plain } = require("./load");

let R;
test.before(async () => { R = await loadModule("router.js"); });

test("#examen/<id> continúa y /nuevo empieza de cero", () => {
  assert.deepEqual(plain(R.parseRoute("#examen/N1E02")), { name: "examen", id: "N1E02", fresh: false, redirect: null });
  assert.deepEqual(plain(R.parseRoute("#examen/N1E02/nuevo")), { name: "examen", id: "N1E02", fresh: true, redirect: null });
});

test("resultados y corrección; /nuevo solo vale para el examen", () => {
  assert.deepEqual(plain(R.parseRoute("#resultados/N0E05")), { name: "resultados", id: "N0E05", fresh: false, redirect: null });
  assert.equal(R.parseRoute("#correccion/N0E05/nuevo").fresh, false);
});

test("los ids anteriores se redirigen al nuevo", () => {
  assert.deepEqual(plain(R.parseRoute("#resultados/diagnostico-6")),
    { name: "resultados", id: "N1E01", fresh: false, redirect: "#resultados/N1E01" });
  assert.equal(R.parseRoute("#examen/diagnostico-7/nuevo").redirect, "#examen/N1E02/nuevo");
});

test("pestañas, reporte y rutas desconocidas", () => {
  assert.deepEqual(plain(R.parseRoute("#completados")), { name: "tab", tab: "completados" });
  assert.deepEqual(plain(R.parseRoute("#progreso")), { name: "tab", tab: "progreso" });
  assert.deepEqual(plain(R.parseRoute("#reporte")), { name: "reporte" });
  ["", "#", "#otra", "#examen", "#examen/"].forEach((h) =>
    assert.deepEqual(plain(R.parseRoute(h)), { name: "tab", tab: "examenes" }, h));
});
