/* app.js — panel de exámenes (pestañas), examen, corrección y resultados.
   Vive en panel.html. La navegación va por hash para que el botón «atrás» del móvil
   funcione: #examenes, #completados, #progreso, #reporte, #examen/<id>, #resultados/<id>.
   Ver docs/funcionamiento.md §1–4 */

(function () {
  "use strict";

  const { DataError, validateCatalog, validateExam, validateAnswerKey, grade, parseAnswerString } = window.Grading;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const IDLE_MS = 5 * 60 * 1000;

  const state = {
    catalog: [],
    entry: null,
    exam: null,
    stimuli: [],
    questions: [],
    selectedAnswers: {},
    startedAt: null,
    activeMs: 0,
    lastTickAt: null,
    lastActivityAt: 0,
    paused: false,
    completed: false,
    completedAt: null,
    result: null,
  };

  let tickHandle = null;

  /* ------------------------------------------------------------ utilidades */

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function fmtClock(ms) {
    const t = Math.floor(ms / 1000);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    const p = (n) => String(n).padStart(2, "0");
    return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  }

  function listNumbers(nums) {
    if (nums.length === 1) return String(nums[0]);
    return `${nums.slice(0, -1).join(", ")} y ${nums[nums.length - 1]}`;
  }

  /** Título sin la palabra «Diagnóstico»: «Examen Diagnóstico N1E02» → «Examen N1E02». */
  const shortTitle = (t) => String(t).replace(/\s*Diagn[oó]stico\b/i, "");

  const ICONS = {
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
    restart: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  };
  const icon = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

  /** Botón de solo ícono; la etiqueta va en aria-label y en el title. */
  function iconBtn(action, entry, name, label, primary) {
    const full = `${label} ${shortTitle(entry.title)}`;
    return `<button type="button" class="icon-btn${primary ? " primary" : ""}" data-action="${action}"
              data-id="${esc(entry.id)}" aria-label="${esc(full)}" title="${esc(label)}">${icon(name)}</button>`;
  }

  const miniBar = (n, total) =>
    `<div class="mini-bar" aria-hidden="true"><div style="width:${total ? (n / total) * 100 : 0}%"></div></div>`;

  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  let currentScreen = "panel";
  let currentTab = "examenes";
  let nextAction = null;   // acción pedida desde una tarjeta antes de cambiar el hash
  const TABS = ["examenes", "completados", "progreso"];

  function showScreen(name) {
    currentScreen = name;
    ["panel", "examen", "resultados", "reporte"].forEach((s) => {
      $(`#screen-${s}`).classList.toggle("hidden", s !== name);
    });
    document.body.dataset.screen = name;
    $("#tabbar").classList.toggle("hidden", name !== "panel");
    $("#appfooter").classList.toggle("hidden", name !== "panel");
    $("#topbar").classList.toggle("hidden", name === "panel");
    ["#progress-bar", "#progress-text", "#timer"].forEach((sel) =>
      $(sel).classList.toggle("hidden", name !== "examen"));
    // A dónde lleva la flecha ← de la barra fija en cada pantalla.
    const [goto, label] = {
      examen: ["examenes", "Volver a mis exámenes"],
      resultados: ["completados", "Volver a completados"],
      reporte: ["progreso", "Volver a mi progreso"],
    }[name] || ["examenes", "Volver a mis exámenes"];
    $("#topbar-back").dataset.goto = goto;
    $("#topbar-back").setAttribute("aria-label", label);
    $("#topbar-back").title = label;
    if (name === "reporte") $("#topbar-title").textContent = "Reporte detallado";
    paintTopbarHeight();
    window.scrollTo(0, 0);
  }

  /** Los textos de lectura se pegan justo debajo de la barra fija, que cambia de alto. */
  function paintTopbarHeight() {
    const bar = $("#topbar");
    document.documentElement.style.setProperty("--topbar-h",
      bar.classList.contains("hidden") ? "0px" : `${bar.offsetHeight}px`);
  }

  function fatal(err) {
    stopTimer();
    const detail = err instanceof DataError && err.detail ? `<pre>${esc(err.detail)}</pre>` : "";
    $("#screen-panel").innerHTML =
      `<div class="card"><div class="alert error" role="alert">
         <strong>No se puede continuar.</strong>
         <p>${esc(err.message)}</p>${detail}
       </div>
       <p class="small muted">Corrige los archivos de datos y recarga la página.</p></div>`;
    showScreen("panel");
    console.error(err);
  }

  /* ---------------------------------------------------------- cronómetro */

  function startTimer() {
    state.lastTickAt = Date.now();
    state.lastActivityAt = Date.now();
    state.paused = false;
    if (!tickHandle) tickHandle = setInterval(tick, 1000);
  }

  function accumulate() {
    if (state.lastTickAt !== null) {
      state.activeMs += Date.now() - state.lastTickAt;
      state.lastTickAt = null;
    }
  }

  function pauseTimer() {
    if (state.paused) return;
    accumulate();
    state.paused = true;
    renderTimer();
  }

  function resumeTimer() {
    if (!state.paused || state.completed) return;
    state.lastTickAt = Date.now();
    state.paused = false;
    renderTimer();
  }

  function stopTimer() {
    accumulate();
    state.paused = true;
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  }

  function currentMs() {
    return state.activeMs + (state.lastTickAt !== null ? Date.now() - state.lastTickAt : 0);
  }

  function tick() {
    if (!state.paused && Date.now() - state.lastActivityAt > IDLE_MS) pauseTimer();
    renderTimer();
  }

  function renderTimer() {
    const el = $("#timer");
    if (!el) return;
    el.classList.toggle("paused", state.paused);
    el.innerHTML = `<span class="dot" aria-hidden="true">●</span> ${fmtClock(currentMs())}` +
      (state.paused ? ' <span class="small">(en pausa)</span>' : "");
  }

  function noteActivity() {
    if (currentScreen !== "examen") return;
    state.lastActivityAt = Date.now();
    if (state.paused && !state.completed) resumeTimer();
  }

  /* --------------------------------------------------------- persistencia */

  function snapshot() {
    accumulate();
    const snap = {
      examId: state.entry.id,
      version: state.entry.version,
      startedAt: state.startedAt,
      selectedAnswers: state.selectedAnswers,
      activeMs: state.activeMs,
      completed: state.completed,
      completedAt: state.completedAt,
      result: state.result
        ? (({ perQuestion, ...rest }) => rest)(state.result)
        : null,
    };
    if (!state.completed && !state.paused) state.lastTickAt = Date.now();
    return snap;
  }

  function save() {
    if (!state.entry) return;
    window.Storage.saveAttempt(snapshot());
  }

  /* -------------------------------------------------------------- inicio */

  async function loadJSON(path) {
    let res;
    try {
      // no-cache revalida con el servidor (respuesta 304 si no cambió) y aprovecha la
      // precarga que hace la bienvenida.
      res = await fetch(path, { cache: "no-cache" });
    } catch (e) {
      throw new DataError(
        `No se pudo cargar "${path}".`,
        "Si abriste el archivo con doble clic, fetch() está bloqueado.\n" +
        "Sirve la carpeta por HTTP:  python3 -m http.server 8000"
      );
    }
    if (!res.ok) throw new DataError(`No se pudo cargar "${path}" (HTTP ${res.status}).`);
    try {
      return await res.json();
    } catch (e) {
      throw new DataError(`"${path}" no es JSON válido.`, String(e.message || e));
    }
  }

  async function init() {
    window.Storage.onStorageWarning(() => {
      const box = $("#storage-warning");
      if (box) box.classList.remove("hidden");
    });

    // El panel se ve desde el primer instante, con un indicador mientras llegan los datos.
    showScreen("panel");

    try {
      state.catalog = validateCatalog(await loadJSON("data/exams.json"));
    } catch (e) { fatal(e); return; }

    // Con caché de esta cuenta (la deja la bienvenida) se pinta al instante y se
    // actualiza en segundo plano; sin caché, se espera al servidor con el indicador.
    await window.Storage.init({ stale: true });
    document.body.classList.remove("is-loading");
    paintSync();
    window.Storage.onUpdate(() => {
      paintSync();
      if (currentScreen !== "examen") renderPanel();
      if (currentScreen === "reporte") showReport();
    });
    // Sesión vencida: Google puede renovarla sin interacción si el navegador lo permite.
    if (window.Auth.getSession() && !window.Auth.getToken()) window.Auth.refresh();

    window.Auth.mount($("#account"));
    window.Auth.onChange(async () => {
      // Al entrar o salir cambia de quién es el historial. Durante un examen no se
      // repinta nada: el intento en curso es local y no depende de la sesión.
      if (currentScreen === "examen") return;
      busy("Cargando tu historial…");
      try { await window.Storage.init(); } finally { busy(null); }
      paintSync();
      renderPanel();
      if (currentScreen === "reporte") showReport();
    });

    document.addEventListener("click", (ev) => {
      const el = ev.target.closest("[data-goto]");
      if (!el) return;
      ev.preventDefault();
      go(el.dataset.goto);
    });
    window.addEventListener("hashchange", route);
    window.addEventListener("resize", paintTopbarHeight, { passive: true });
    route();

    ["pointerdown", "keydown", "scroll", "pointermove"].forEach((ev) =>
      window.addEventListener(ev, noteActivity, { passive: true }));
    document.addEventListener("visibilitychange", () => {
      if (currentScreen !== "examen" || state.completed || !state.entry) return;
      if (document.visibilityState === "hidden") { pauseTimer(); save(); }
      else { noteActivity(); }
    });
    window.addEventListener("beforeunload", () => {
      if (currentScreen === "examen" && state.entry && !state.completed) save();
    });
  }

  /* ------------------------------------------------------------- carga */

  /** Indicador bloqueante para esperas que el estudiante provocó (abrir, guardar). */
  function busy(text) {
    const el = $("#busy");
    if (!el) return;
    if (text) $("#busy-text").textContent = text;
    el.classList.toggle("hidden", !text);
    el.setAttribute("aria-busy", text ? "true" : "false");
  }

  /** Aviso discreto mientras el historial se actualiza en segundo plano. */
  function paintSync() {
    const el = $("#sync");
    if (el) el.classList.toggle("hidden", !window.Storage.isRefreshing());
  }

  /* ---------------------------------------------------------- navegación */

  function go(hash) {
    const h = "#" + hash;
    if (location.hash === h) route();
    else location.hash = h;
  }

  /** Lleva a un examen desde una tarjeta: la acción viaja aparte del hash. */
  function openFromList(entry, action) {
    nextAction = action;
    go(`examen/${entry.id}`);
  }

  /** Sale del examen guardando todo: el intento queda para «Continuar». */
  function leaveExam() {
    if (currentScreen === "examen" && state.entry && !state.completed) {
      save();
      stopTimer();
    }
  }

  function route() {
    const [name, id] = location.hash.replace(/^#/, "").split("/");
    const entry = id ? state.catalog.find((e) => e.id === id) : null;

    if ((name === "examen" || name === "resultados") && entry) {
      const action = nextAction || (name === "resultados" ? "view" : "continue");
      nextAction = null;
      const same = state.entry && state.entry.id === entry.id;
      if (same && name === "examen" && currentScreen === "examen" && action === "continue") return;
      if (same && name === "resultados" && currentScreen === "resultados") return;
      if (action === "continue" && name === "examen") {
        const saved = window.Storage.loadAttempt(entry.id, entry.version);
        // Recargar #examen/<id> sin intento guardado no inventa uno nuevo.
        if (!saved) { history.replaceState(null, "", "#examenes"); showTab("examenes"); return; }
      }
      leaveExam();
      openExam(entry, action);
      return;
    }

    leaveExam();
    if (name === "reporte") { showReport(); return; }
    showTab(TABS.includes(name) ? name : "examenes");
  }

  /** El historial con el título actual del catálogo: los registros guardan el que tenía el
   *  examen al hacerse, y un cambio de nombre no debe dejar el historial con dos nombres. */
  function historyWithTitles() {
    const titles = new Map(state.catalog.map((e) => [e.id, e.title]));
    return window.Storage.getAllHistory().map((r) => ({ ...r, examTitle: titles.get(r.examId) || r.examTitle }));
  }

  function showReport() {
    // Primero se muestra la pantalla: las gráficas miden el ancho disponible al dibujarse.
    if (currentScreen !== "reporte") showScreen("reporte");
    window.Dashboard.showReport(historyWithTitles());
  }

  function showTab(tab) {
    currentTab = tab;
    TABS.forEach((t) => {
      const on = t === tab;
      $(`#tab-${t}`).setAttribute("aria-selected", String(on));
      $(`#tab-${t}`).classList.toggle("active", on);
      $(`#panel-${t}`).classList.toggle("hidden", !on);
    });
    // Primero se muestra el panel: las gráficas miden el ancho disponible al dibujarse.
    showScreen("panel");
    renderPanel();
  }

  function paintAccountNote() {
    const note = $("#account-note");
    if (!note) return;
    const mode = window.Storage.getMode();
    const err = window.Storage.getLastError();
    note.textContent =
      mode === "guest" ? "Inicia sesión para guardar tus resultados en tu cuenta y verlos desde cualquier dispositivo." :
      mode === "remote" && err ? `No se pudo conectar con el servidor (${err.message}). Tus resultados nuevos se guardan en este navegador y se subirán después.` :
      "";
    note.className = mode === "remote" && err ? "alert warn" : "alert info";
    note.classList.toggle("hidden", !note.textContent);
  }

  /* --------------------------------------------------------------- panel */

  function renderPanel() {
    paintAccountNote();
    const hist = window.Storage.getAllHistory();
    const pending = [], done = [];
    state.catalog.forEach((e) => {
      const h = hist.filter((r) => r.examId === e.id);
      (h.length ? done : pending).push({ entry: e, hist: h, attempt: window.Storage.loadAttempt(e.id, e.version) });
    });

    renderExamList(pending);
    renderDoneList(done);
    if (currentTab === "progreso" && currentScreen === "panel") window.Dashboard.show(historyWithTitles());
  }

  function renderExamList(items) {
    const host = $("#exam-list");
    host.classList.toggle("list", items.length > 0);
    if (!items.length) {
      host.innerHTML = `<div class="card empty-state">
          <h2>¡Completaste todos los exámenes!</h2>
          <p>Revisa tus resultados o vuelve a intentar alguno en
             <a href="#completados">Completados</a>.</p>
        </div>`;
      return;
    }
    host.innerHTML = items.map(({ entry: e, attempt }) => {
      let meta, buttons, active = false;
      // Un intento corregido sin historial es un resultado que aún no se ha subido.
      if (attempt && attempt.completed) {
        active = true;
        meta = `<div class="exam-meta">Resuelto · pendiente de guardar</div>`;
        buttons = iconBtn("view", e, "eye", "Ver resultados", true);
      } else if (attempt) {
        active = true;
        const n = Object.keys(attempt.selectedAnswers || {}).length;
        meta = `<div class="exam-meta">${n}/${e.questionCount} preguntas</div>${miniBar(n, e.questionCount)}`;
        buttons = iconBtn("continue", e, "play", "Continuar", true) +
                  iconBtn("restart", e, "restart", "Comenzar de nuevo");
      } else {
        const mins = e.estimatedMinutes ? ` · ~${e.estimatedMinutes} min` : "";
        meta = `<div class="exam-meta">${e.questionCount} preguntas${mins}</div>`;
        buttons = iconBtn("start", e, "play", "Comenzar", true);
      }
      return `<article class="exam-row${active ? " is-active" : ""}">
        <div class="exam-info">
          <h3>${esc(shortTitle(e.title))}</h3>
          ${meta}
        </div>
        <div class="exam-actions">${buttons}</div>
      </article>`;
    }).join("");
    host.onclick = onCardAction;
  }

  function renderDoneList(items) {
    const host = $("#done-list");
    host.classList.toggle("list", items.length > 0);
    if (!items.length) {
      host.innerHTML = `<div class="card empty-state">
          <h2>Aún no has completado ningún examen</h2>
          <p>Elige uno en <a href="#examenes">Exámenes</a>. Al terminarlo aparecerá aquí con
             su resultado.</p>
          ${window.Storage.getMode() === "guest"
            ? `<p class="small muted">Si ya hiciste exámenes, inicia sesión para verlos.</p>` : ""}
        </div>`;
      return;
    }
    // El más reciente primero: es el que normalmente se quiere revisar.
    items.sort((a, b) => String(b.hist[b.hist.length - 1].completedAt)
      .localeCompare(String(a.hist[a.hist.length - 1].completedAt)));

    host.innerHTML = items.map(({ entry: e, hist, attempt }) => {
      const last = hist[hist.length - 1];
      const best = hist.reduce((a, b) => (b.percentage > a.percentage ? b : a));
      const retrying = attempt && !attempt.completed;
      const n = retrying ? Object.keys(attempt.selectedAnswers || {}).length : 0;
      // El año solo si no es el actual: ahorra una línea en el celular.
      const when = new Date(last.completedAt);
      const date = when.toLocaleDateString("es-MX", when.getFullYear() === new Date().getFullYear()
        ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
      const meta = [
        `${last.score}/${last.total}`,
        last.minutes ? `${last.minutes} min` : "",
        date,
        hist.length > 1 ? `${hist.length} intentos · mejor ${best.percentage}%` : "",
      ].filter(Boolean).join(" · ");
      return `<article class="exam-row${retrying ? " is-active" : ""}">
        <div class="exam-info">
          <h3>${esc(shortTitle(e.title))} <span class="row-sep">·</span> <span class="row-pct">${last.percentage}%</span></h3>
          <div class="exam-meta">${meta}${last.pending ? ` <span class="chip low">pendiente de subir</span>` : ""}</div>
          ${retrying ? `<div class="exam-meta">Nuevo intento: ${n}/${e.questionCount} preguntas</div>${miniBar(n, e.questionCount)}` : ""}
        </div>
        <div class="exam-actions">
          ${iconBtn("view", e, "eye", "Ver resultados")}
          ${retrying
            ? iconBtn("continue", e, "play", "Continuar intento", true) + iconBtn("restart", e, "restart", "Comenzar de nuevo")
            : iconBtn("restart", e, "restart", "Volver a intentarlo")}
        </div>
      </article>`;
    }).join("");
    host.onclick = onCardAction;
  }

  function onCardAction(ev) {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;
    const entry = state.catalog.find((x) => x.id === btn.dataset.id);
    const action = btn.dataset.action;
    if (action === "restart") {
      const attempt = window.Storage.loadAttempt(entry.id, entry.version);
      if (attempt && !attempt.completed &&
          !confirm("Empezarás este examen desde cero y se perderán las respuestas del intento sin terminar. Los resultados anteriores se conservan.\n\n¿Continuar?")) return;
      window.Storage.clearAttempt(entry.id, entry.version);
      openFromList(entry, "start");
      return;
    }
    if (action === "view") {
      // Ver resultados muestra el último intento del historial, no un intento a medias.
      const attempt = window.Storage.loadAttempt(entry.id, entry.version);
      nextAction = "view";
      if (attempt && !attempt.completed) nextAction = "view-history";
      go(`resultados/${entry.id}`);
      return;
    }
    openFromList(entry, action);
  }

  /* -------------------------------------------------------------- examen */

  /** Reconstruye un intento corregido a partir de la cadena del historial.
   *  La cadena lleva los minutos y una letra por pregunta ordenada por id, así que
   *  contiene todo lo necesario para repintar la corrección: no hace falta que el
   *  intento se hubiera hecho en este navegador. */
  function attemptFromHistory(entry, questions) {
    const hist = window.Storage.getHistory(entry.id);
    if (!hist.length) return null;
    const rec = hist[hist.length - 1];
    const parsed = parseAnswerString(rec.answers);
    if (!parsed) return null;

    const letters = parsed.letters;
    const orden = [...questions].sort((a, b) => a.id - b.id);
    if (letters.length !== orden.length) {
      console.warn(`[app] la cadena del historial trae ${letters.length} respuestas ` +
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

  async function openExam(entry, action) {
    busy("Cargando examen…");
    try {
      const data = await loadJSON(`data/${entry.questions}`);
      const { exam, stimuli, questions } = validateExam(data, entry);
      state.entry = entry;
      state.exam = exam;
      state.stimuli = stimuli;
      state.questions = questions;

      let saved = action === "view-history" ? null : window.Storage.loadAttempt(entry.id, entry.version);
      if (saved && action === "view" && !saved.completed) saved = null;
      if (!saved && (action === "view" || action === "view-history")) {
        saved = attemptFromHistory(entry, questions);
        if (!saved) { history.replaceState(null, "", "#completados"); showTab("completados"); return; }
      }
      if (saved && (action === "continue" || action === "view" || action === "view-history")) {
        state.selectedAnswers = saved.selectedAnswers || {};
        state.startedAt = saved.startedAt;
        state.activeMs = saved.activeMs || 0;
        state.completed = !!saved.completed;
        state.completedAt = saved.completedAt || null;
      } else {
        state.selectedAnswers = {};
        state.startedAt = new Date().toISOString();
        state.activeMs = 0;
        state.completed = false;
        state.completedAt = null;
        state.result = null;
      }

      renderExam();

      if (state.completed) {
        // Rehacer la corrección para poder pintar el examen resuelto.
        const key = await loadJSON(`data/${entry.answers}`);
        const keyMap = validateAnswerKey(key, exam, questions);
        const wallMs = saved.elapsedWallMs != null ? saved.elapsedWallMs
          : (saved.completedAt && saved.startedAt
              ? Date.parse(saved.completedAt) - Date.parse(saved.startedAt)
              : state.activeMs);
        state.result = grade(exam, questions, state.selectedAnswers, keyMap, {
          activeMs: state.activeMs,
          elapsedWallMs: wallMs,
        }, entry.code);
        paintCorrection();
        renderResults();
        history.replaceState(null, "", `#resultados/${entry.id}`);
        showScreen("resultados");
        return;
      }

      history.replaceState(null, "", `#examen/${entry.id}`);
      showScreen("examen");
      startTimer();
      renderProgress();
      renderTimer();
      save();
    } catch (e) { fatal(e); }
    finally { busy(null); }
  }

  function renderExam() {
    $("#topbar-title").textContent = shortTitle(state.exam.title);
    const byStimulus = new Map(state.stimuli.map((s) => [s.id, s]));

    $("#questions").innerHTML = state.exam.areas.map((area) => {
      const qs = state.questions.filter((q) => q.area === area.name).sort((a, b) => a.id - b.id);
      const chunks = [];
      let i = 0;
      while (i < qs.length) {
        const sid = qs[i].stimulusId;
        if (sid) {
          const block = [];
          while (i < qs.length && qs[i].stimulusId === sid) block.push(qs[i++]);
          chunks.push(renderStimulusBlock(byStimulus.get(sid), block));
        } else {
          chunks.push(renderQuestion(qs[i++]));
        }
      }
      return `<section class="area-block" id="area-${esc(slug(area.name))}">
          <div class="area-head">
            <h2>${esc(area.name)} <span class="count">· ${qs.length}</span></h2>
          </div>
          ${chunks.join("")}
        </section>`;
    }).join("");

    $("#questions").addEventListener("change", onAnswerChange);
    $("#btn-terminar").onclick = finishExam;
  }

  const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");

  function renderStimulusBlock(stim, questions) {
    const sid = `stim-${esc(stim.id)}`;
    return `<div class="stimulus-block">
      <button type="button" class="stimulus-toggle" aria-expanded="true" aria-controls="${sid}"
              data-toggle="${sid}">Ocultar texto</button>
      <div class="stimulus" id="${sid}">
        ${stim.instruction ? `<div class="instr">${esc(stim.instruction)}</div>` : ""}
        <div class="text">${esc(stim.text)}</div>
      </div>
      ${questions.map((q) => renderQuestion(q, sid)).join("")}
    </div>`;
  }

  function renderQuestion(q, describedBy) {
    const opts = ["A", "B", "C"].map((k) => `
      <div class="opt" data-key="${k}">
        <label for="q${q.id}${k}">
          <input type="radio" id="q${q.id}${k}" name="q${q.id}" value="${k}"
                 ${state.selectedAnswers[q.id] === k ? "checked" : ""}>
          <span class="key">${k}.</span>
          <span class="txt">${esc(q.options[k])}</span>
          <span class="tag"></span>
        </label>
      </div>`).join("");
    // El tema NO se incluye durante el examen: delataría de qué trata la pregunta.
    // Se inyecta al corregir, en paintCorrection(), donde sí es útil para estudiar.
    return `<fieldset class="q" id="q-${q.id}" data-id="${q.id}"
                     ${describedBy ? `aria-describedby="${describedBy}"` : ""}>
        <legend><span class="num">${q.id}.</span>${esc(q.text)}</legend>
        ${opts}
      </fieldset>`;
  }

  function onAnswerChange(ev) {
    const input = ev.target;
    if (!input.matches('input[type="radio"]')) return;
    const id = Number(input.name.slice(1));
    state.selectedAnswers[id] = input.value;
    $(`#q-${id}`).classList.remove("pending");
    noteActivity();
    renderProgress();
    save();
  }

  function renderProgress() {
    const done = state.questions.filter((q) => state.selectedAnswers[q.id]).length;
    const total = state.questions.length;
    $("#progress-text").textContent = `${done}/${total}`;
    $("#progress-fill").style.width = `${(done / total) * 100}%`;
    const bar = $("#progress-bar");
    bar.setAttribute("aria-valuenow", String(done));
    bar.setAttribute("aria-valuemax", String(total));
  }

  /* ----------------------------------------------------------- terminar */

  function findUnanswered() {
    return state.questions.filter((q) => !state.selectedAnswers[q.id])
      .map((q) => q.id).sort((a, b) => a - b);
  }

  async function finishExam() {
    const pending = findUnanswered();
    const box = $("#exam-alert");

    if (pending.length) {
      $$(".q").forEach((el) => el.classList.remove("pending"));
      pending.forEach((id) => $(`#q-${id}`).classList.add("pending"));
      const word = pending.length === 1 ? "Falta 1 pregunta" : `Faltan ${pending.length} preguntas`;
      box.className = "alert warn";
      box.textContent = `${word}: ${listNumbers(pending)}`;
      box.classList.remove("hidden");
      const first = $(`#q-${pending[0]}`);
      first.scrollIntoView({ block: "center" });
      const radio = first.querySelector('input[type="radio"]');
      if (radio) radio.focus();
      return;
    }

    box.classList.add("hidden");
    stopTimer();
    busy("Corrigiendo y guardando tu resultado…");

    try {
      const key = await loadJSON(`data/${state.entry.answers}`);
      const keyMap = validateAnswerKey(key, state.exam, state.questions);
      const elapsedWallMs = Date.now() - new Date(state.startedAt).getTime();
      state.result = grade(state.exam, state.questions, state.selectedAnswers, keyMap,
        { activeMs: state.activeMs, elapsedWallMs }, state.entry.code);
      state.completed = true;
      state.completedAt = new Date().toISOString();

      const attemptNumber = window.Storage.nextAttemptNumber(state.entry.id);
      const { perQuestion, chance, ...rest } = state.result;
      await window.Storage.addHistory({
        examId: state.entry.id,
        examTitle: state.exam.title,
        version: state.exam.version,
        completedAt: state.completedAt,
        attemptNumber,
        isFirstAttempt: attemptNumber === 1,
        ...rest,
        answers: state.result.answerString,
      });
      save();

      paintCorrection();
      renderResults();
      history.replaceState(null, "", `#resultados/${state.entry.id}`);
      showScreen("resultados");
      if (window.Storage.getMode() === "guest" || window.Storage.pendingCount()) window.Auth.refresh();
    } catch (e) {
      // No se corrige nada y el intento queda intacto.
      box.className = "alert error";
      box.innerHTML = `<strong>${esc(e.message)}</strong>` +
        (e.detail ? `<pre>${esc(e.detail)}</pre>` : "");
      box.classList.remove("hidden");
      box.scrollIntoView({ block: "center" });
      console.error(e);
    } finally {
      busy(null);
    }
  }

  /* ---------------------------------------------------------- corrección */

  function paintCorrection() {
    state.result.perQuestion.forEach((r) => {
      const fs = $(`#q-${r.id}`);
      fs.classList.add("corrected");
      fs.classList.remove("pending");
      if (!$(".topic", fs)) {
        const t = document.createElement("div");
        t.className = "topic";
        t.textContent = `Tema: ${r.topic}`;
        fs.querySelector("legend").insertAdjacentElement("afterend", t);
      }
      $$(".opt", fs).forEach((opt) => {
        const k = opt.dataset.key;
        const tag = $(".tag", opt);
        const input = $("input", opt);
        input.disabled = true;
        if (k === r.selected && r.isCorrect) { opt.classList.add("is-ok"); tag.textContent = "Correcta"; }
        else if (k === r.selected) { opt.classList.add("is-bad"); tag.textContent = "Tu respuesta"; }
        else if (k === r.correct) { opt.classList.add("is-ok"); tag.textContent = "Respuesta correcta"; }
      });
    });
    $("#btn-terminar").classList.add("hidden");
  }

  /* --------------------------------------------------------- resultados */

  function renderResults() {
    const r = state.result;
    $("#topbar-title").textContent = shortTitle(state.exam.title);

    $("#result-score").innerHTML = `
      <div class="big">${r.score}/${r.total} · ${r.percentage}%</div>
      <div class="time">${r.minutes} min</div>`;

    $("#area-results").innerHTML = `<ul class="hbars">${state.exam.areas.map((a) => {
      const v = r.areaResults[a.name] || { correct: 0, total: 0 };
      const pct = v.total ? Math.round((v.correct / v.total) * 100) : 0;
      return `<li class="hbar"><div class="hbar-fill" style="width:${pct}%"></div>
        <span class="hbar-label">${esc(a.name)}</span>
        <span class="hbar-value">${pct}% · ${v.correct}/${v.total}</span></li>`;
    }).join("")}</ul>`;

    const a = parseAnswerString(r.answerString);
    $("#answer-string").innerHTML =
      `<span class="mins">${esc(a.code)}|${a.minutes}|</span>${a.letters}`;

    $("#btn-copy-answers").onclick = () => copy(r.answerString, "Cadena copiada");
  }

  async function copy(text, msg) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) { /* sin portapapeles */ }
      ta.remove();
    }
    toast(msg);
  }

  /* --------------------------------------------- colapsar texto en móvil */

  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-toggle]");
    if (!btn) return;
    const box = document.getElementById(btn.dataset.toggle);
    const open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!open));
    box.classList.toggle("hidden", open);
    btn.textContent = open ? "Ver texto" : "Ocultar texto";
  });

  document.addEventListener("DOMContentLoaded", init);
})();
