/* stats.js — cálculos de «Mi progreso» y del reporte detallado.
   Funciones puras: entran filas del historial (registros de la hoja) y salen datos, nunca HTML.
   Ver docs/funcionamiento.md §5 */

import { chanceBaseline } from "./grading.js?v=__BUILD__";

export const MIN_OBS_RECOMMEND = 3;   // observaciones mínimas para recomendar un tema
export const WEAK_THRESHOLD = 60;     // % por debajo del cual un tema se considera débil
export const SPLIT_FACTOR = 3;        // elapsedWall > 3 × active ⇒ intento partido

export const pct = (c, t) => (t ? Math.round((c / t) * 100) : 0);

/** Intento hecho en varias sentadas: su tiempo no es comparable. */
export function isSplit(row) {
  return row.elapsedWallMs && row.activeMs && row.elapsedWallMs > SPLIT_FACTOR * row.activeMs;
}

/** Porcentaje que obtendría quien marcase siempre la misma letra. */
export function chanceOf(row) {
  const d = row.keyDistribution;
  if (!d) return null;
  const dist = { A: d.A || 0, B: d.B || 0, C: d.C || 0 };
  const ch = chanceBaseline(dist, row.total || 1);
  return row.total ? ch : { letter: ch.letter, percentage: 0 };
}

/** examId → filas, en el orden del historial. */
export function groupByExam(rows) {
  const byExam = new Map();
  rows.forEach((r) => {
    if (!byExam.has(r.examId)) byExam.set(r.examId, []);
    byExam.get(r.examId).push(r);
  });
  return byExam;
}

/** Puntuación sobre 1000 (promedio de los porcentajes) y puntos totales (aciertos sumados). */
export function scores(rows) {
  const avg = rows.reduce((a, r) => a + (r.total ? r.score / r.total : 0), 0) / rows.length;
  const points = rows.reduce((a, r) => a + (r.score || 0), 0);
  return { score1000: Math.round(avg * 1000), points };
}

/** Indicadores del resumen. `rows` en orden de fecha y no vacío. */
export function kpis(rows) {
  const best = rows.reduce((a, b) => (b.percentage > (a ? a.percentage : -1) ? b : a), null);
  const exams = groupByExam(rows).size;

  const last = rows[rows.length - 1];
  const sameExam = rows.filter((r) => r.examId === last.examId);
  const prev = sameExam.length > 1 ? sameExam[sameExam.length - 2] : null;

  const comparable = rows.filter((r) => !isSplit(r) && r.minutes);
  return {
    count: rows.length,
    repeats: rows.length - exams,
    best,
    last,
    delta: prev ? last.percentage - prev.percentage : null,
    avgMinutes: comparable.length
      ? Math.round(comparable.reduce((a, r) => a + r.minutes, 0) / comparable.length) : null,
    splitExcluded: rows.length - comparable.length,
  };
}

/** Aciertos por área sumando todos los intentos, de menor a mayor porcentaje. */
export function areaTotals(rows) {
  const acc = {};
  rows.forEach((r) => {
    Object.entries(r.areaResults || {}).forEach(([a, v]) => {
      if (!acc[a]) acc[a] = { correct: 0, total: 0 };
      acc[a].correct += v.correct;
      acc[a].total += v.total;
    });
  });
  return Object.entries(acc)
    .map(([area, v]) => ({ area, correct: v.correct, total: v.total, pct: pct(v.correct, v.total) }))
    .sort((a, b) => a.pct - b.pct);
}

/** Tendencia comparando la primera mitad de observaciones con la segunda:
 *  "up" | "down" | "flat", o null si no hay muestra suficiente. */
function trendOf(v) {
  if (v.total < 6 || v.halves.length < 2) return null;
  const ordered = [...v.halves].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const mid = Math.floor(ordered.length / 2);
  const sum = (arr) => arr.reduce((a, x) => ({ c: a.c + x.c, t: a.t + x.t }), { c: 0, t: 0 });
  const a = sum(ordered.slice(0, mid));
  const b = sum(ordered.slice(mid));
  if (!a.t || !b.t) return null;
  const d = pct(b.c, b.t) - pct(a.c, a.t);
  return d >= 10 ? "up" : d <= -10 ? "down" : "flat";
}

/**
 * Temas cruzando exámenes: es lo único que da muestra suficiente.
 * Sin `includeRepeats` solo cuentan los primeros intentos (una repetición mide memoria).
 * Devuelve { usable, reliable, low, weak }: `reliable` ordenado del más débil al más fuerte,
 * `low` con menos de MIN_OBS_RECOMMEND observaciones, `weak` lo recomendado estudiar.
 */
export function topicStats(rows, { area = "*", includeRepeats = false } = {}) {
  const usable = includeRepeats ? rows : rows.filter((r) => r.isFirstAttempt !== false);

  const acc = {};
  usable.forEach((r) => {
    Object.entries(r.topicResults || {}).forEach(([t, v]) => {
      const a = (r.topicAreas && r.topicAreas[t]) || "—";
      if (area !== "*" && a !== area) return;
      if (!acc[t]) acc[t] = { correct: 0, total: 0, area: a, halves: [] };
      acc[t].correct += v.correct;
      acc[t].total += v.total;
      acc[t].halves.push({ at: r.completedAt, c: v.correct, t: v.total });
    });
  });

  const all = Object.entries(acc).map(([topic, v]) => ({
    topic,
    area: v.area,
    correct: v.correct,
    total: v.total,
    pct: pct(v.correct, v.total),
    confidence: v.total >= 6 ? "high" : v.total >= MIN_OBS_RECOMMEND ? "mid" : "low",
    trend: trendOf(v),
  }));

  const reliable = all.filter((t) => t.confidence !== "low")
    .sort((a, b) => (a.pct - b.pct) || (b.total - a.total) || a.topic.localeCompare(b.topic));
  const low = all.filter((t) => t.confidence === "low")
    .sort((a, b) => (a.pct - b.pct) || a.topic.localeCompare(b.topic));

  return { usable, reliable, low, weak: reliable.filter((t) => t.pct < WEAK_THRESHOLD) };
}

/** Líneas de referencia de azar, una por examen; las que quedan a menos de 4 puntos de otra
 *  se encimarían y se omiten. */
export function chanceRefs(byExam) {
  const refs = [];
  byExam.forEach((rs) => {
    const ch = chanceOf(rs[0]);
    if (ch && !refs.some((x) => Math.abs(x.y - ch.percentage) < 4)) {
      refs.push({ y: ch.percentage, label: `${ch.percentage}% · siempre la misma letra` });
    }
  });
  return refs;
}

/** Intentos por examen: [{ title, attempts }]. */
export function examBreakdown(rows) {
  return [...groupByExam(rows).values()].map((rs) => ({ title: rs[0].examTitle, attempts: rs.length }));
}
