// Cálculos de «Mi progreso» y del reporte (domain/stats.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadModule, plain } = require("./load");

let S, G;
test.before(async () => {
  S = await loadModule("domain/stats.js");
  G = await loadModule("domain/grading.js");
});

const MIN = 60000;
/** Fila del historial con lo mínimo que usan las estadísticas. */
const row = (examId, day, score, total, extra = {}) => ({
  examId, examTitle: `Examen ${examId}`, completedAt: `2026-10-${String(day).padStart(2, "0")}T10:00:00.000Z`,
  score, total, percentage: Math.round((score / total) * 100), minutes: 30,
  activeMs: 30 * MIN, elapsedWallMs: 31 * MIN, isFirstAttempt: true, attemptNumber: 1,
  keyDistribution: { A: Math.round(total * 0.4), B: Math.round(total * 0.3), C: total - Math.round(total * 0.4) - Math.round(total * 0.3) },
  areaResults: {}, topicResults: {}, topicAreas: {}, ...extra,
});

// E1 (80 %), E2 (60 %), E1 repetido (90 %), E3 partido en varias sentadas (50 %).
const rows = [
  row("E1", 1, 8, 10, {
    areaResults: { Mate: { correct: 3, total: 5 }, Lectura: { correct: 5, total: 5 } },
    topicResults: { Fracciones: { correct: 1, total: 4 }, Lectura: { correct: 5, total: 5 }, Sumas: { correct: 2, total: 2 } },
    topicAreas: { Fracciones: "Mate", Lectura: "Lectura", Sumas: "Mate" },
  }),
  row("E2", 2, 6, 10, {
    areaResults: { Mate: { correct: 2, total: 6 }, Lectura: { correct: 4, total: 4 } },
    topicResults: { Fracciones: { correct: 4, total: 4 }, Lectura: { correct: 0, total: 3 } },
    topicAreas: { Fracciones: "Mate", Lectura: "Lectura" },
  }),
  row("E1", 3, 9, 10, { isFirstAttempt: false, attemptNumber: 2,
    topicResults: { Sumas: { correct: 2, total: 2 } }, topicAreas: { Sumas: "Mate" } }),
  row("E3", 4, 5, 10, { minutes: 90, activeMs: 10 * MIN, elapsedWallMs: 600 * MIN }),
];

test("scores: puntuación sobre 1000 y puntos totales", () => {
  assert.deepEqual(plain(S.scores(rows)), { score1000: 700, points: 28 });
});

test("kpis: repeticiones, mejor, último con delta y tiempo medio sin partidos", () => {
  const k = S.kpis(rows);
  assert.equal(k.count, 4);
  assert.equal(k.repeats, 1);
  assert.equal(k.best.percentage, 90);
  assert.equal(k.last.examId, "E3");
  assert.equal(k.delta, null);                      // primer intento de E3
  assert.equal(k.avgMinutes, 30);                   // el intento partido no cuenta
  assert.equal(k.splitExcluded, 1);
  assert.equal(S.kpis(rows.slice(0, 3)).delta, 10); // E1: 80 → 90
});

test("kpis: con empate, el mejor es el primero", () => {
  const k = S.kpis([row("A", 1, 9, 10), row("B", 2, 9, 10)]);
  assert.equal(k.best.examId, "A");
});

test("isSplit y chanceOf", () => {
  assert.ok(S.isSplit(rows[3]));
  assert.ok(!S.isSplit(rows[0]));
  assert.deepEqual(plain(S.chanceOf(rows[0])), plain(G.chanceBaseline(rows[0].keyDistribution, 10)));
  assert.equal(S.chanceOf({ total: 10 }), null);
});

test("areaTotals suma por área y ordena de menor a mayor", () => {
  assert.deepEqual(plain(S.areaTotals(rows)), [
    { area: "Mate", correct: 5, total: 11, pct: 45 },
    { area: "Lectura", correct: 9, total: 9, pct: 100 },
  ]);
});

test("topicStats: sin repeticiones, confianza, orden y débiles", () => {
  const t = S.topicStats(rows);
  assert.equal(t.usable.length, 3);
  // Fracciones 5/8 (alta), Lectura 5/8 (alta), Sumas 2/2 (baja; sin la repetición).
  assert.deepEqual(t.reliable.map((x) => [x.topic, x.correct, x.total, x.confidence]),
    [["Fracciones", 5, 8, "high"], ["Lectura", 5, 8, "high"]]);
  assert.deepEqual(t.low.map((x) => [x.topic, x.total]), [["Sumas", 2]]);
  assert.deepEqual(t.weak, []);                     // 63 % no es débil (< 60)
});

test("topicStats: tendencia y filtros", () => {
  const t = S.topicStats(rows);
  assert.equal(t.reliable.find((x) => x.topic === "Fracciones").trend, "up");   // 25 % → 100 %
  assert.equal(t.reliable.find((x) => x.topic === "Lectura").trend, "down");    // 100 % → 0 %
  assert.equal(S.topicStats(rows, { includeRepeats: true }).reliable.find((x) => x.topic === "Sumas").total, 4); // con la repetición: 4 obs
  assert.deepEqual(S.topicStats(rows, { area: "Lectura" }).reliable.map((x) => x.topic), ["Lectura"]);
  assert.equal(S.topicStats([rows[0]]).reliable.find((x) => x.topic === "Fracciones").trend, null); // 4 obs: confianza media, sin tendencia
});

test("topicStats: «flat» con poca diferencia y débiles bajo el umbral", () => {
  const t = S.topicStats([
    row("A", 1, 1, 3, { topicResults: { X: { correct: 3, total: 6 } } }),
    row("B", 2, 1, 3, { topicResults: { X: { correct: 3, total: 6 } } }),
  ]);
  assert.equal(t.reliable[0].trend, "flat");
  assert.deepEqual(t.weak.map((x) => x.topic), ["X"]);
  assert.equal(t.reliable[0].area, "—");
});

test("chanceRefs omite líneas a menos de 4 puntos", () => {
  const refs = S.chanceRefs(S.groupByExam([
    row("A", 1, 5, 10, { keyDistribution: { A: 4, B: 3, C: 3 } }),
    row("B", 2, 5, 10, { keyDistribution: { A: 3, B: 4, C: 3 } }),   // 40 %: igual → se omite
    row("C", 3, 5, 10, { keyDistribution: { A: 5, B: 3, C: 2 } }),   // 50 %: se dibuja
  ]));
  assert.deepEqual(plain(refs).map((r) => r.y), [40, 50]);
  assert.equal(refs[0].label, "40% · siempre la misma letra");
});

test("groupByExam y examBreakdown", () => {
  assert.deepEqual([...S.groupByExam(rows).keys()], ["E1", "E2", "E3"]);
  assert.deepEqual(plain(S.examBreakdown(rows)),
    [{ title: "Examen E1", attempts: 2 }, { title: "Examen E2", attempts: 1 }, { title: "Examen E3", attempts: 1 }]);
});
