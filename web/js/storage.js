/* storage.js — persistencia.
 *
 * El HISTORIAL vive en Google Sheets, detrás del Apps Script (apps-script/Code.gs),
 * y es por estudiante: cada petición lleva el ID token de Google (auth.js).
 *
 * Todo intento terminado entra primero en una cola local (exani.pending) y se sube
 * desde ahí. Si no hay sesión, la sesión venció o la red falla, se queda en la cola y
 * se reintenta en la siguiente carga o al iniciar sesión. Así nunca se pierde un
 * intento.
 *
 * Sin API configurada (config.js vacío) la app funciona en modo local: el historial
 * solo existe en este navegador.
 *
 * El INTENTO EN CURSO se queda siempre en localStorage: es efímero y por dispositivo.
 *
 * No hay borrado: la API no lo permite. Ver spec/08-persistencia.md
 */

(function () {
  "use strict";

  const ATTEMPT = (examId, version) => `exani.attempt.${examId}.v${version}`;
  const PENDING = "exani.pending";
  const LOCAL_HISTORY = "exani.history.local";
  const cfg = window.ExaniConfig || {};

  let warned = false;
  let onWarn = null;

  let mode = "local";   // "remote" (con sesión) | "guest" (API sin sesión) | "local" (sin API)
  let remote = [];      // historial confirmado por el servidor
  let lastError = null;

  /* ------------------------------------------------------------ localStorage */

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn(`[storage] no se pudo leer ${key}:`, e);
      return null;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn(`[storage] no se pudo guardar ${key}:`, e);
      if (!warned && onWarn) { warned = true; onWarn(); }
      return false;
    }
  }

  function remove(key) {
    try { localStorage.removeItem(key); } catch (_) { /* nada que hacer */ }
  }

  const byDate = (a, b) => String(a.completedAt).localeCompare(String(b.completedAt));
  const identity = (r) => `${r.examId}|${r.completedAt}|${r.answers}`;

  /* ------------------------------------------------------------------- API */

  class ApiError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }

  async function call(action, payload) {
    let res;
    try {
      res = await fetch(cfg.API_URL, {
        method: "POST",
        // text/plain evita el preflight CORS, que Apps Script no atiende.
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, ...payload }),
      });
    } catch (e) {
      throw new ApiError("network", "sin conexión con el servidor");
    }
    if (!res.ok) throw new ApiError("network", `HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.error) throw new ApiError(data.code || "error", data.error);
    return data;
  }

  /* ----------------------------------------------------------------- cola */

  /** Intentos sin confirmar visibles para la sesión actual: los propios y los anónimos. */
  function pendingFor(sub) {
    return (read(PENDING) || []).filter((p) => !p.owner || p.owner === sub);
  }

  /** Sube la cola. Devuelve cuántos quedaron pendientes para esta sesión. */
  async function flush() {
    if (mode === "local") return 0;
    const token = window.Auth.getToken();
    const sub = window.Auth.getSession() && window.Auth.getSession().sub;
    if (!token) return pendingFor(sub).length;

    for (const item of pendingFor(sub)) {
      try {
        const data = await call("create", { idToken: token, record: item.record });
        const queue = (read(PENDING) || []).filter((p) => identity(p.record) !== identity(item.record));
        write(PENDING, queue);
        if (data.saved && !remote.some((r) => identity(r) === identity(data.saved))) {
          remote.push(data.saved);
          remote.sort(byDate);
        }
        lastError = null;
      } catch (e) {
        lastError = e;
        console.warn("[storage] no se pudo subir un intento:", e);
        // Un registro rechazado por validación no se arreglará reintentando, pero
        // tampoco se descarta: se queda en la cola y se ve en el historial local.
        if (e.code === "auth" || e.code === "network" || e.code === "rate_limited") break;
      }
    }
    return pendingFor(sub).length;
  }

  /* ------------------------------------------------------------------ init */

  async function init() {
    if (!cfg.API_URL || !window.Auth || !window.Auth.enabled) {
      mode = "local";
      remote = read(LOCAL_HISTORY) || [];
      return mode;
    }
    const token = window.Auth.getToken();
    if (!token) {
      mode = "guest";
      remote = [];
      return mode;
    }
    mode = "remote";
    try {
      const data = await call("list", { idToken: token });
      remote = Array.isArray(data.history) ? data.history.sort(byDate) : [];
      lastError = null;
    } catch (e) {
      console.warn("[storage] no se pudo leer el historial:", e);
      lastError = e;
      remote = [];
      if (e.code === "auth") mode = "guest";
    }
    await flush();
    return mode;
  }

  /* -------------------------------------------------------------- historial */

  function getAllHistory() {
    const sub = window.Auth && window.Auth.getSession() ? window.Auth.getSession().sub : null;
    const seen = new Set(remote.map(identity));
    const pending = mode === "local" ? [] : pendingFor(sub)
      .map((p) => ({ ...p.record, pending: true }))
      .filter((r) => !seen.has(identity(r)));
    return [...remote, ...pending].sort(byDate);
  }

  const getHistory = (examId) => getAllHistory().filter((r) => r.examId === examId);
  const nextAttemptNumber = (examId) => getHistory(examId).length + 1;

  /** Guarda un intento terminado. Devuelve { record, synced }. */
  async function addHistory(record) {
    if (mode === "local") {
      const rows = (read(LOCAL_HISTORY) || []).concat([record]).sort(byDate);
      write(LOCAL_HISTORY, rows);
      remote = rows;
      return { record, synced: true };
    }
    const sub = window.Auth.getSession() && window.Auth.getSession().sub;
    const queue = read(PENDING) || [];
    if (!queue.some((p) => identity(p.record) === identity(record))) {
      queue.push({ owner: window.Auth.getToken() ? sub : null, record });
      write(PENDING, queue);
    }
    const left = await flush();
    const saved = remote.find((r) => identity(r) === identity(record));
    return { record: saved || record, synced: !!saved && left === 0 };
  }

  /* ----------------------------------------------------- intento en curso */

  function loadAttempt(examId, version) {
    const a = read(ATTEMPT(examId, version));
    if (!a || typeof a !== "object") return null;
    if (a.version !== version || a.examId !== examId) return null;
    if (!a.selectedAnswers || typeof a.selectedAnswers !== "object") return null;
    return a;
  }

  const saveAttempt = (attempt) => write(ATTEMPT(attempt.examId, attempt.version), attempt);
  const clearAttempt = (examId, version) => remove(ATTEMPT(examId, version));

  window.Storage = {
    init,
    flush,
    getMode: () => mode,
    getLastError: () => lastError,
    pendingCount: () => (mode === "local" ? 0
      : pendingFor(window.Auth.getSession() && window.Auth.getSession().sub).length),
    getAllHistory, getHistory, nextAttemptNumber, addHistory,
    loadAttempt, saveAttempt, clearAttempt,
    onStorageWarning(fn) { onWarn = fn; },
  };
})();
