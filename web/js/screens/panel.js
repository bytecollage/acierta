/* panel.js — el panel con sus tres pestañas (#examenes, #completados, #progreso), el aviso de
   la cuenta y el de sincronización. Toda la fila de un examen es el botón. Ver docs/funcionamiento.md §1–2 */

import { $, esc } from "../ui/dom.js?v=__BUILD__";
import { showScreen, currentScreen } from "../ui/appbar.js?v=__BUILD__";
import { CHEVRON } from "../ui/icons.js?v=__BUILD__";
import { resultSummary, miniBar } from "../ui/rows.js?v=__BUILD__";
import { go, TABS } from "../router.js?v=__BUILD__";
import { classifyExams } from "../domain/attempt.js?v=__BUILD__";
import { getCatalog, titledHistory } from "../data/catalog.js?v=__BUILD__";
import * as Storage from "../data/storage.js?v=__BUILD__";
import * as Progress from "./progress.js?v=__BUILD__";

let currentTab = "examenes";

export function showTab(tab) {
  currentTab = tab;
  TABS.forEach((t) => {
    const on = t === tab;
    $(`#tab-${t}`).setAttribute("aria-selected", String(on));
    $(`#tab-${t}`).classList.toggle("active", on);
    $(`#panel-${t}`).classList.toggle("hidden", !on);
  });
  // Primero se muestra el panel: las gráficas miden el ancho disponible al dibujarse.
  showScreen("panel");
  render();
}

/** Repinta listas, avisos y, si está a la vista, Mi progreso. */
export function render() {
  paintAccountNote();
  const { pending, done } = classifyExams(getCatalog(), Storage.getAllHistory(), Storage.loadAttempt);
  renderExamList(pending);
  renderDoneList(done);
  if (currentTab === "progreso" && currentScreen() === "panel") Progress.show(titledHistory());
}

/** Aviso discreto mientras el historial se actualiza en segundo plano. */
export function paintSync() {
  const el = $("#sync");
  if (el) el.classList.toggle("hidden", !Storage.isRefreshing());
}

function paintAccountNote() {
  const note = $("#account-note");
  if (!note) return;
  const mode = Storage.getMode();
  const err = Storage.getLastError();
  const text =
    mode === "guest" ? "Inicia sesión para guardar tus resultados en tu cuenta y verlos desde cualquier dispositivo." :
    mode === "remote" && err ? `No se pudo conectar con el servidor (${err.message}). Tus resultados nuevos se guardan en este navegador y se subirán después.` :
    "";
  $("#account-note-text").textContent = text;
  note.className = mode === "remote" && err ? "alert warn" : "alert info";
  note.classList.toggle("hidden", !text);
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
    // Toda la fila es el botón: comenzar, continuar o ver un resultado sin subir.
    let meta, action, active = false;
    if (attempt && attempt.completed) {
      // Un intento corregido sin historial es un resultado que aún no se ha subido.
      active = true;
      action = "view";
      meta = `<div class="exam-meta">Resuelto · pendiente de guardar</div>`;
    } else if (attempt) {
      active = true;
      action = "continue";
      const n = Object.keys(attempt.selectedAnswers || {}).length;
      meta = `<div class="exam-meta">${n}/${e.questionCount} preguntas</div>${miniBar(n, e.questionCount)}`;
    } else {
      action = "start";
      const mins = e.estimatedMinutes ? ` · ~${e.estimatedMinutes} min` : "";
      meta = `<div class="exam-meta">${e.questionCount} preguntas${mins}</div>`;
    }
    return `<a class="exam-row${active ? " is-active" : ""}" href="#examen/${esc(e.id)}"
               data-action="${action}" data-id="${esc(e.id)}">
      <div class="exam-info">
        <h3>${esc(e.title)}</h3>
        ${meta}
      </div>
      ${CHEVRON}
    </a>`;
  }).join("");
  host.onclick = onRowClick;
}

function renderDoneList(items) {
  const host = $("#done-list");
  host.classList.toggle("list", items.length > 0);
  if (!items.length) {
    host.innerHTML = `<div class="card empty-state">
        <h2>Aún no has completado ningún examen</h2>
        <p>Elige uno en <a href="#examenes">Exámenes</a>. Al terminarlo aparecerá aquí con
           su resultado.</p>
        ${Storage.getMode() === "guest"
          ? `<p class="small muted">Si ya hiciste exámenes, inicia sesión para verlos.</p>` : ""}
      </div>`;
    return;
  }
  // El más reciente primero: es el que normalmente se quiere revisar.
  items.sort((a, b) => String(b.hist[b.hist.length - 1].completedAt)
    .localeCompare(String(a.hist[a.hist.length - 1].completedAt)));

  host.innerHTML = items.map(({ entry: e, hist, attempt }) => {
    // Toda la fila es el botón: ver el resultado, o continuar un intento nuevo a medias.
    const retrying = attempt && !attempt.completed;
    const n = retrying ? Object.keys(attempt.selectedAnswers || {}).length : 0;
    return `<a class="exam-row${retrying ? " is-active" : ""}"
               href="#${retrying ? "examen" : "resultados"}/${esc(e.id)}"
               data-action="${retrying ? "continue" : "view"}" data-id="${esc(e.id)}">
      <div class="exam-info">
        ${resultSummary(e, hist[hist.length - 1], hist)}
        ${retrying ? `<div class="exam-meta">Nuevo intento: ${n}/${e.questionCount} preguntas</div>${miniBar(n, e.questionCount)}` : ""}
      </div>
      ${CHEVRON}
    </a>`;
  }).join("");
  host.onclick = onRowClick;
}

/** La acción de la fila decide la ruta: ver resultado, continuar o empezar de cero. */
function onRowClick(ev) {
  const row = ev.target.closest("[data-action]");
  if (!row) return;
  ev.preventDefault();
  const id = row.dataset.id;
  const hash = { view: `resultados/${id}`, continue: `examen/${id}`, start: `examen/${id}/nuevo` }[row.dataset.action];
  go(hash);
}
