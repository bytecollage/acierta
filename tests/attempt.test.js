// Intentos: reconstrucción desde la cadena, registro para la API y clasificación (domain/attempt.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadModule, loadCodeGs, readData, plain } = require("./load");

let A, G;
test.before(async () => {
  A = await loadModule("domain/attempt.js");
  G = await loadModule("domain/grading.js");
});

const entry = { id: "T1", version: "1.0", title: "Examen T1" };
const questions = [{ id: 2 }, { id: 1 }, { id: 3 }];

test("attemptFromRecord rehace las respuestas en orden de id", () => {
  const rec = { answers: "T1|2|CAB", completedAt: "2026-11-01T10:00:00.000Z", activeMs: 90000, elapsedWallMs: 100000 };
  const a = A.attemptFromRecord(entry, questions, rec);
  assert.deepEqual(plain(a.selectedAnswers), { 1: "C", 2: "A", 3: "B" });
  assert.equal(a.startedAt, "2026-11-01T09:58:30.000Z");
  assert.equal(a.completed, true);
  assert.equal(a.elapsedWallMs, 100000);
});

test("attemptFromRecord acepta la cadena anterior y usa sus minutos si falta activeMs", () => {
  const a = A.attemptFromRecord(entry, questions, { answers: "5ABC", completedAt: "2026-11-01T10:00:00.000Z" });
  assert.equal(a.activeMs, 300000);
  assert.equal(a.selectedAnswers[3], "C");
});

test("attemptFromRecord devuelve null si la cadena no sirve", () => {
  assert.equal(A.attemptFromRecord(entry, questions, null), null);
  assert.equal(A.attemptFromRecord(entry, questions, { answers: "basura" }), null);
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(A.attemptFromRecord(entry, questions, { answers: "T1|2|AB" }), null); }
  finally { console.warn = warn; }
});

test("wallMsOf prefiere el tiempo registrado, luego fin − inicio, luego el activo", () => {
  assert.equal(A.wallMsOf({ elapsedWallMs: 7 }, 1), 7);
  assert.equal(A.wallMsOf({ startedAt: "2026-11-01T10:00:00Z", completedAt: "2026-11-01T10:01:00Z" }, 1), 60000);
  assert.equal(A.wallMsOf({}, 5), 5);
});

test("historyRecord arma exactamente el registro que se envía a la API", () => {
  const data = readData("N0E01/questions.json"), key = readData("N0E01/answers.json");
  const cat = readData("exams.json").find((e) => e.id === "N0E01");
  const { exam, questions: qs } = G.validateExam(data, cat);
  const keyMap = G.validateAnswerKey(key, exam, qs);
  const result = G.grade(exam, qs, Object.fromEntries(qs.map((q) => [q.id, "A"])), keyMap,
    { activeMs: 600000, elapsedWallMs: 700000 }, "N0E01");
  const rec = A.historyRecord({ entry: cat, exam, result, completedAt: "2026-11-20T12:00:00.000Z", attemptNumber: 1 });

  assert.deepEqual(Object.keys(rec).sort(), [
    "activeMs", "answerString", "answers", "areaResults", "attemptNumber", "completedAt", "correctCount",
    "elapsedWallMs", "examId", "examTitle", "incorrectCount", "isFirstAttempt", "keyDistribution", "minutes",
    "percentage", "score", "topicAreas", "topicResults", "total", "version",
  ]);
  assert.equal(rec.answers, result.answerString);
  assert.equal(rec.isFirstAttempt, true);
  assert.equal(A.historyRecord({ entry: cat, exam, result, completedAt: rec.completedAt, attemptNumber: 2 }).isFirstAttempt, false);

  // Code.gs lo acepta y conserva lo que importa.
  const saved = plain(loadCodeGs().sanitizeRecord(plain(rec)));
  assert.equal(saved.examId, "N0E01");
  assert.equal(saved.answers, rec.answers);
  assert.equal(saved.score, 39);
});

test("classifyExams separa sin hacer y hechos con su intento guardado", () => {
  const catalog = [{ id: "A", version: "1" }, { id: "B", version: "1" }];
  const history = [{ examId: "B", percentage: 80 }];
  const { pending, done } = A.classifyExams(catalog, history, (id) => (id === "A" ? { selectedAnswers: {} } : null));
  assert.deepEqual(pending.map((x) => x.entry.id), ["A"]);
  assert.deepEqual(plain(pending[0].attempt), { selectedAnswers: {} });
  assert.deepEqual(done.map((x) => [x.entry.id, x.hist.length, x.attempt]), [["B", 1, null]]);
});

test("withCatalogTitles pone el título actual del catálogo", () => {
  const out = A.withCatalogTitles([{ id: "A", title: "Nuevo" }], [{ examId: "A", examTitle: "Viejo" }, { examId: "Z", examTitle: "Z" }]);
  assert.deepEqual(out.map((r) => r.examTitle), ["Nuevo", "Z"]);
});
