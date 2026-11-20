/* main.js — entrada de panel.html: carga el catálogo y el historial, conecta la sesión de
   Google y decide qué pantalla mostrar para cada ruta (router.js).
   Ver docs/arquitectura.md §1 y docs/funcionamiento.md §1 */

import { $ } from "./ui/dom.js?v=__BUILD__";
import { showScreen, currentScreen, paintTopbarHeight } from "./ui/appbar.js?v=__BUILD__";
import { busy, fatal } from "./ui/feedback.js?v=__BUILD__";
import { onRoute, start, go, redirect } from "./router.js?v=__BUILD__";
import { loadCatalog, findEntry, titledHistory } from "./data/catalog.js?v=__BUILD__";
import * as Storage from "./data/storage.js?v=__BUILD__";
import * as Auth from "./data/auth.js?v=__BUILD__";
import * as Session from "./services/exam-session.js?v=__BUILD__";
import * as Panel from "./screens/panel.js?v=__BUILD__";
import * as Exam from "./screens/exam.js?v=__BUILD__";
import * as Report from "./screens/report.js?v=__BUILD__";

const { session } = Session;

/* -------------------------------------------------------------- rutas */

/** Sale del examen guardando el intento, si se estaba respondiendo uno. */
function leaveExam() {
  if (currentScreen() === "examen") Session.leave();
}

function showReport() {
  // Primero se muestra la pantalla: las gráficas miden el ancho disponible al dibujarse.
  if (currentScreen() !== "reporte") showScreen("reporte");
  Report.show(titledHistory());
}

function onExamRoute({ name, id, fresh }) {
  const entry = findEntry(id);
  if (!entry) { leaveExam(); Panel.showTab("examenes"); return; }

  const screen = currentScreen();
  const same = session.entry && session.entry.id === entry.id;
  // El mismo examen ya abierto: nada que recargar.
  if (same && name === "examen" && !fresh && screen === "examen") return;
  // Entre resultado y corrección del mismo examen solo cambia la pantalla.
  if (same && session.completed && name !== "examen" &&
      (screen === "resultados" || screen === "correccion")) {
    if (screen !== name) showScreen(name, entry.id);
    return;
  }
  // Recargar #examen/<id> sin intento guardado no inventa uno nuevo.
  if (name === "examen" && !fresh && !Storage.loadAttempt(entry.id, entry.version)) {
    redirect("examenes");
    return;
  }
  leaveExam();
  const mode = name !== "examen" ? "view" : fresh ? "new" : "continue";
  Exam.open(entry, mode, name === "correccion" ? "correccion" : "resultados");
}

onRoute((r) => {
  if (r.name === "tab") { leaveExam(); Panel.showTab(r.tab); return; }
  if (r.name === "reporte") { leaveExam(); showReport(); return; }
  onExamRoute(r);
});

/* -------------------------------------------------------------- inicio */

async function init() {
  Storage.onStorageWarning(() => {
    const box = $("#storage-warning");
    if (box) box.classList.remove("hidden");
  });

  // El panel se ve desde el primer instante, con un indicador mientras llegan los datos.
  showScreen("panel");

  try {
    await loadCatalog();
  } catch (e) { fatal(e); return; }

  // Con caché de esta cuenta (la deja la bienvenida) se pinta al instante y se
  // actualiza en segundo plano; sin caché, se espera al servidor con el indicador.
  await Storage.init({ stale: true });
  document.body.classList.remove("is-loading");
  Panel.paintSync();
  Storage.onUpdate(() => {
    Panel.paintSync();
    if (currentScreen() !== "examen") Panel.render();
    if (currentScreen() === "reporte") showReport();
  });
  // Sesión vencida: Google puede renovarla sin interacción si el navegador lo permite.
  if (Auth.getSession() && !Auth.getToken()) Auth.refresh();

  Auth.mount($("#account"), "account");
  Auth.mount($("#signin"), "signin");
  Auth.onChange(async () => {
    // Al entrar o salir cambia de quién es el historial. Durante un examen no se
    // repinta nada: el intento en curso es local y no depende de la sesión.
    if (currentScreen() === "examen") return;
    busy("Cargando tu historial…");
    try { await Storage.init(); } finally { busy(null); }
    Panel.paintSync();
    Panel.render();
    if (currentScreen() === "reporte") showReport();
  });

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-goto]");
    if (!el) return;
    ev.preventDefault();
    go(el.dataset.goto);
  });
  Exam.init();
  window.addEventListener("resize", paintTopbarHeight, { passive: true });
  start();

  // El cronómetro se pausa sin actividad y al ocultar la pestaña; el intento se guarda al salir.
  const inExam = () => currentScreen() === "examen" && session.entry && !session.completed;
  ["pointerdown", "keydown", "scroll", "pointermove"].forEach((ev) =>
    window.addEventListener(ev, () => { if (currentScreen() === "examen") Session.noteActivity(); }, { passive: true }));
  document.addEventListener("visibilitychange", () => {
    if (!inExam()) return;
    if (document.visibilityState === "hidden") { Session.pause(); Session.save(); }
    else { Session.noteActivity(); }
  });
  window.addEventListener("beforeunload", () => { if (inExam()) Session.save(); });
}

document.addEventListener("DOMContentLoaded", init);
