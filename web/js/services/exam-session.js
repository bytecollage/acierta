/* exam-session.js — el intento abierto: respuestas, cronómetro, guardado y corrección.
   Sin DOM: la pantalla del examen lee `session` y se entera del reloj con onTick().
   Ver docs/funcionamiento.md §3 */

import { attemptFromRecord, wallMsOf, historyRecord } from "../domain/attempt.js?v=__BUILD__";
import { loadExam, gradeAttempt } from "../data/catalog.js?v=__BUILD__";
import * as Storage from "../data/storage.js?v=__BUILD__";

export const IDLE_MS = 5 * 60 * 1000;   // sin actividad, el cronómetro se pausa

/** Estado del intento abierto. Solo este módulo lo modifica. */
export const session = {
  entry: null,
  exam: null,
  stimuli: [],
  questions: [],
  selectedAnswers: {},
  startedAt: null,
  activeMs: 0,
  paused: false,
  completed: false,
  completedAt: null,
  result: null,
};

let lastTickAt = null;
let lastActivityAt = 0;
let tickHandle = null;
const tickListeners = [];

let clock = {
  now: () => Date.now(),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h),
};
/** Para las pruebas: reloj y temporizador simulados. */
export function setClock(c) { clock = { ...clock, ...c }; }

/** `fn()` se llama cada segundo y al pausar o reanudar, para pintar el cronómetro. */
export function onTick(fn) { tickListeners.push(fn); }
const notify = () => tickListeners.forEach((fn) => fn());

/* ---------------------------------------------------------- cronómetro */

export function start() {
  lastTickAt = clock.now();
  lastActivityAt = clock.now();
  session.paused = false;
  if (!tickHandle) tickHandle = clock.setInterval(tick, 1000);
}

function accumulate() {
  if (lastTickAt !== null) {
    session.activeMs += clock.now() - lastTickAt;
    lastTickAt = null;
  }
}

export function pause() {
  if (session.paused) return;
  accumulate();
  session.paused = true;
  notify();
}

export function resume() {
  if (!session.paused || session.completed) return;
  lastTickAt = clock.now();
  session.paused = false;
  notify();
}

export function stop() {
  accumulate();
  session.paused = true;
  if (tickHandle) { clock.clearInterval(tickHandle); tickHandle = null; }
}

export function currentMs() {
  return session.activeMs + (lastTickAt !== null ? clock.now() - lastTickAt : 0);
}

function tick() {
  if (!session.paused && clock.now() - lastActivityAt > IDLE_MS) pause();
  notify();
}

/** El estudiante hizo algo: reanuda el cronómetro si estaba en pausa. */
export function noteActivity() {
  lastActivityAt = clock.now();
  if (session.paused && !session.completed) resume();
}

/* --------------------------------------------------------- persistencia */

function snapshot() {
  accumulate();
  const snap = {
    examId: session.entry.id,
    version: session.entry.version,
    startedAt: session.startedAt,
    selectedAnswers: session.selectedAnswers,
    activeMs: session.activeMs,
    completed: session.completed,
    completedAt: session.completedAt,
    result: session.result
      ? (({ perQuestion, ...rest }) => rest)(session.result)
      : null,
  };
  if (!session.completed && !session.paused) lastTickAt = clock.now();
  return snap;
}

export function save() {
  if (!session.entry) return;
  Storage.saveAttempt(snapshot());
}

/** Sale del examen guardando todo: el intento queda para «Continuar». */
export function leave() {
  if (session.entry && !session.completed) {
    save();
    stop();
  }
}

/* -------------------------------------------------------------- abrir */

/**
 * Abre un examen del catálogo.
 *   mode "continue" → el intento guardado (o uno nuevo si no hay)
 *   mode "new"      → borra el intento guardado y empieza de cero
 *   mode "view"     → el intento corregido de este navegador o, si no, el último del historial
 * Devuelve "exam" (en curso; falta llamar a start()), "completed" (corregido, con `result`)
 * o "missing" (mode "view" sin nada que mostrar).
 */
export async function open(entry, mode) {
  const { exam, stimuli, questions } = await loadExam(entry);
  session.entry = entry;
  session.exam = exam;
  session.stimuli = stimuli;
  session.questions = questions;

  if (mode === "new") Storage.clearAttempt(entry.id, entry.version);
  let saved = mode === "new" ? null : Storage.loadAttempt(entry.id, entry.version);
  // Ver resultados muestra el último intento terminado, no uno a medias.
  if (saved && mode === "view" && !saved.completed) saved = null;
  if (!saved && mode === "view") {
    const hist = Storage.getHistory(entry.id);
    saved = attemptFromRecord(entry, questions, hist[hist.length - 1]);
    if (!saved) return "missing";
  }

  session.result = null;
  if (saved) {
    session.selectedAnswers = saved.selectedAnswers || {};
    session.startedAt = saved.startedAt;
    session.activeMs = saved.activeMs || 0;
    session.completed = !!saved.completed;
    session.completedAt = saved.completedAt || null;
  } else {
    session.selectedAnswers = {};
    session.startedAt = new Date(clock.now()).toISOString();
    session.activeMs = 0;
    session.completed = false;
    session.completedAt = null;
  }

  if (!session.completed) return "exam";
  // Rehacer la corrección para poder pintar el examen resuelto.
  session.result = await gradeAttempt(entry, exam, questions, session.selectedAnswers, {
    activeMs: session.activeMs,
    elapsedWallMs: wallMsOf(saved, session.activeMs),
  });
  return "completed";
}

/* ----------------------------------------------------------- responder */

export function answer(id, letter) {
  session.selectedAnswers[id] = letter;
  noteActivity();
  save();
}

export function progress() {
  const done = session.questions.filter((q) => session.selectedAnswers[q.id]).length;
  return { done, total: session.questions.length };
}

/** Ids de las preguntas sin responder, en orden. */
export function unanswered() {
  return session.questions.filter((q) => !session.selectedAnswers[q.id])
    .map((q) => q.id).sort((a, b) => a - b);
}

/* ------------------------------------------------------------ terminar */

/** Corrige y guarda el intento (lo sube o lo deja en la cola). Si la corrección falla,
 *  lanza el error y el intento queda intacto. */
export async function finish() {
  stop();
  const elapsedWallMs = clock.now() - new Date(session.startedAt).getTime();
  session.result = await gradeAttempt(session.entry, session.exam, session.questions,
    session.selectedAnswers, { activeMs: session.activeMs, elapsedWallMs });
  session.completed = true;
  session.completedAt = new Date(clock.now()).toISOString();

  await Storage.addHistory(historyRecord({
    entry: session.entry,
    exam: session.exam,
    result: session.result,
    completedAt: session.completedAt,
    attemptNumber: Storage.nextAttemptNumber(session.entry.id),
  }));
  save();
  return session.result;
}
