// Ids de examen: canonización (diagnostico-N → N<nivel>E<examen>) y migración del navegador (D-14).
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadModule, loadCodeGs, setStorage } = require("./load");

/** storage.js con un localStorage nuevo; la migración corre al llamarla (init() lo hace al cargar la app). */
async function loadStorage(seed) {
  const localStorage = setStorage(seed);
  const Storage = await loadModule("data/storage.js");
  Storage.migrateLegacyIds();
  return { Storage, localStorage };
}

test("canonId pasa diagnostico-1…10 a N0E01…N1E05", async () => {
  const { Storage } = await loadStorage();
  const expected = ["N0E01", "N0E02", "N0E03", "N0E04", "N0E05", "N1E01", "N1E02", "N1E03", "N1E04", "N1E05"];
  expected.forEach((id, i) => assert.equal(Storage.canonId(`diagnostico-${i + 1}`), id));
});

test("canonId deja igual los ids que no son del formato anterior", async () => {
  const { Storage } = await loadStorage();
  ["N1E02", "algo", "diagnostico-x"].forEach((id) => assert.equal(Storage.canonId(id), id));
});

test("canonId del navegador y canonExamId de Code.gs coinciden", async () => {
  const { Storage } = await loadStorage();
  const gs = loadCodeGs();
  const ids = [...Array.from({ length: 15 }, (_, i) => `diagnostico-${i + 1}`), "N1E02"];
  ids.forEach((id) => assert.equal(Storage.canonId(id), gs.canonExamId(id), id));
});

test("migrateLegacyIds migra intentos, cola y caché del navegador", async () => {
  const rec = { examId: "diagnostico-7", examTitle: "Examen Diagnóstico N1E02", completedAt: "2026-10-01T00:00:00Z" };
  const { localStorage: ls } = await loadStorage({
    "exani.attempt.diagnostico-7.v2.0": { examId: "diagnostico-7", version: "2.0", selectedAnswers: { 1: "A" } },
    "exani.pending": [{ owner: null, record: rec }],
    "exani.cache": { sub: "1", history: [rec] },
  });
  assert.equal(ls.getItem("exani.attempt.diagnostico-7.v2.0"), null);
  const a = JSON.parse(ls.getItem("exani.attempt.N1E02.v2.0"));
  assert.equal(a.examId, "N1E02");
  assert.equal(a.selectedAnswers[1], "A");
  const p = JSON.parse(ls.getItem("exani.pending"))[0].record;
  assert.equal(p.examId, "N1E02");
  assert.equal(p.examTitle, "Examen N1E02");
  assert.equal(JSON.parse(ls.getItem("exani.cache")).history[0].examId, "N1E02");
});

test("la migración conserva un intento que ya tiene el id nuevo", async () => {
  const { localStorage: ls } = await loadStorage({
    "exani.attempt.diagnostico-7.v2.0": { examId: "diagnostico-7", version: "2.0", selectedAnswers: { 1: "A" } },
    "exani.attempt.N1E02.v2.0": { examId: "N1E02", version: "2.0", selectedAnswers: { 1: "C" } },
  });
  assert.equal(ls.getItem("exani.attempt.diagnostico-7.v2.0"), null);
  assert.equal(JSON.parse(ls.getItem("exani.attempt.N1E02.v2.0")).selectedAnswers[1], "C");
});
