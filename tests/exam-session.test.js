// Sesión de examen: abrir, responder, cronómetro y guardado (services/exam-session.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const { WEB, loadModule, setStorage, readData, plain } = require("./load");

let S, ls;
let now = Date.parse("2026-11-20T10:00:00Z");
const timers = [];
const entry = readData("exams.json").find((e) => e.id === "N0E01");
const KEY = "exani.attempt.N0E01.v2.0";
const saved = () => JSON.parse(ls.getItem(KEY));

test.before(async () => {
  // fetch de los JSON de web/data y reloj simulado.
  globalThis.fetch = async (p) => {
    const file = path.join(WEB, p);
    return fs.existsSync(file)
      ? { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(file, "utf8")) }
      : { ok: false, status: 404 };
  };
  ls = setStorage();
  S = await loadModule("services/exam-session.js");
  S.setClock({ now: () => now, setInterval: (fn) => { timers.push(fn); return timers.length; }, clearInterval: () => {} });
});
const tick = (ms) => { now += ms; timers.forEach((fn) => fn()); };

test("open «new» empieza de cero y guarda el intento con la forma de siempre", async () => {
  assert.equal(await S.open(entry, "new"), "exam");
  S.start();
  S.save();
  const a = saved();
  assert.deepEqual(Object.keys(a).sort(),
    ["activeMs", "completed", "completedAt", "examId", "result", "selectedAnswers", "startedAt", "version"]);
  assert.equal(a.examId, "N0E01");
  assert.equal(a.completed, false);
  assert.equal(S.progress().total, 80);
});

test("responder guarda y cuenta el avance", () => {
  S.answer(1, "A");
  S.answer(3, "C");
  assert.deepEqual(plain(S.progress()), { done: 2, total: 80 });
  assert.deepEqual(plain(saved().selectedAnswers), { 1: "A", 3: "C" });
  assert.deepEqual(S.unanswered().slice(0, 3), [2, 4, 5]);
});

test("el cronómetro suma tiempo activo y se pausa tras 5 min sin actividad", () => {
  const t0 = S.currentMs();
  tick(60000);
  assert.equal(S.currentMs() - t0, 60000);
  assert.equal(S.session.paused, false);
  tick(S.IDLE_MS);                       // 6 min sin actividad desde la última respuesta
  assert.equal(S.session.paused, true);
  const frozen = S.currentMs();
  tick(120000);
  assert.equal(S.currentMs(), frozen);   // en pausa no suma
  S.noteActivity();
  assert.equal(S.session.paused, false);
  tick(1000);
  assert.equal(S.currentMs(), frozen + 1000);
});

test("leave guarda y «continue» restaura respuestas y tiempo", async () => {
  S.leave();
  const ms = saved().activeMs;
  assert.ok(ms > 0);
  assert.equal(await S.open(entry, "continue"), "exam");
  assert.equal(S.session.selectedAnswers[3], "C");
  assert.equal(S.session.activeMs, ms);
});

test("«new» borra el intento anterior", async () => {
  assert.equal(await S.open(entry, "new"), "exam");
  assert.equal(ls.getItem(KEY), null);
  assert.deepEqual(plain(S.session.selectedAnswers), {});
});

test("«view» sin intento corregido ni historial devuelve «missing»", async () => {
  assert.equal(await S.open(entry, "view"), "missing");
});
