// Historial (data/storage.js): una lectura del servidor que empezó con otra sesión no se aplica.
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadModule, setStorage } = require("./load");

test("cerrar sesión durante la actualización en segundo plano no deja el historial anterior", async () => {
  const sub = "111";
  const rec = { examId: "N0E01", examTitle: "Examen N0E01", completedAt: "2026-10-01T00:00:00.000Z", answers: "N0E01|1|A", score: 1, total: 1, percentage: 100 };
  setStorage({
    "exani.auth": { token: "tok", sub, name: "E", exp: Date.now() + 3600e3 },
    "exani.cache": { sub, history: [rec] },
  });
  globalThis.window = {};                 // auth.js consulta window.google al cerrar sesión
  let respond;
  globalThis.fetch = () => new Promise((r) => { respond = r; });   // «list» queda en espera

  const Auth = await loadModule("data/auth.js");
  const Storage = await loadModule("data/storage.js");

  assert.equal(await Storage.init({ stale: true }), "remote");
  assert.equal(Storage.getAllHistory().length, 1);       // caché al instante
  assert.ok(Storage.isRefreshing());

  Auth.signOut();
  assert.equal(await Storage.init(), "guest");
  assert.equal(Storage.getAllHistory().length, 0);

  // Llega la respuesta de la lectura que empezó con la sesión anterior.
  respond({ ok: true, json: async () => ({ history: [rec, { ...rec, completedAt: "2026-10-02T00:00:00.000Z" }] }) });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(Storage.getMode(), "guest");
  assert.equal(Storage.getAllHistory().length, 0);
  assert.equal(globalThis.localStorage.getItem("exani.cache"), null);
});
