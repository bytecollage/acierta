/* attempt.js — intentos: rehacerlos desde el historial, armar el registro que se guarda y
   clasificar los exámenes del panel. Funciones puras. Ver docs/funcionamiento.md §3–4 */

import { parseAnswerString } from "./answer-string.js?v=__BUILD__";

/** Reconstruye un intento corregido a partir de un registro del historial.
 *  La cadena lleva los minutos y una letra por pregunta ordenada por id, así que contiene todo
 *  lo necesario para repintar la corrección: no hace falta que el intento se hubiera hecho en
 *  este navegador. Devuelve null si la cadena no se lee o no cuadra con el examen. */
export function attemptFromRecord(entry, questions, rec) {
  if (!rec) return null;
  const parsed = parseAnswerString(rec.answers);
  if (!parsed) return null;

  const letters = parsed.letters;
  const orden = [...questions].sort((a, b) => a.id - b.id);
  if (letters.length !== orden.length) {
    console.warn(`[attempt] la cadena del historial trae ${letters.length} respuestas ` +
                 `y el examen tiene ${orden.length}. No se reconstruye.`);
    return null;
  }

  const selectedAnswers = {};
  orden.forEach((q, i) => { selectedAnswers[q.id] = letters[i]; });
  const activeMs = rec.activeMs != null ? rec.activeMs : parsed.minutes * 60000;

  return {
    examId: entry.id,
    version: entry.version,
    startedAt: rec.completedAt
      ? new Date(Date.parse(rec.completedAt) - activeMs).toISOString()
      : null,
    completedAt: rec.completedAt || null,
    selectedAnswers,
    activeMs,
    elapsedWallMs: rec.elapsedWallMs,
    completed: true,
    result: null,
    fromHistory: true,
  };
}

/** Tiempo de reloj de un intento guardado: el registrado, o fin − inicio, o el tiempo activo. */
export function wallMsOf(saved, activeMs) {
  if (saved.elapsedWallMs != null) return saved.elapsedWallMs;
  if (saved.completedAt && saved.startedAt) return Date.parse(saved.completedAt) - Date.parse(saved.startedAt);
  return activeMs;
}

/** Registro de un intento terminado, tal como se envía a la API (Code.gs, sanitizeRecord).
 *  `perQuestion` y `chance` se recalculan al abrirlo, así que no se guardan. */
export function historyRecord({ entry, exam, result, completedAt, attemptNumber }) {
  const { perQuestion, chance, ...rest } = result;
  return {
    examId: entry.id,
    examTitle: exam.title,
    version: exam.version,
    completedAt,
    attemptNumber,
    isFirstAttempt: attemptNumber === 1,
    ...rest,
    answers: result.answerString,
  };
}

/** Separa el catálogo en exámenes sin hacer y hechos. Cada elemento lleva
 *  { entry, hist (sus registros), attempt (intento guardado en el navegador o null) }. */
export function classifyExams(catalog, history, loadAttempt) {
  const pending = [], done = [];
  catalog.forEach((e) => {
    const h = history.filter((r) => r.examId === e.id);
    (h.length ? done : pending).push({ entry: e, hist: h, attempt: loadAttempt(e.id, e.version) });
  });
  return { pending, done };
}

/** El historial con el título actual del catálogo: los registros guardan el que tenía el
 *  examen al hacerse, y un cambio de nombre no debe dejar el historial con dos nombres. */
export function withCatalogTitles(catalog, history) {
  const titles = new Map(catalog.map((e) => [e.id, e.title]));
  return history.map((r) => ({ ...r, examTitle: titles.get(r.examId) || r.examTitle }));
}
