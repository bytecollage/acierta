/* progress.js — pestaña «Mi progreso» (#progreso): puntuación, avance, indicadores y áreas
   con todo el historial, sin filtros. Los cálculos están en domain/stats.js.
   Ver docs/funcionamiento.md §5 */

import { $, esc, fmtDate } from "../ui/dom.js?v=__BUILD__";
import { hbars } from "../ui/hbars.js?v=__BUILD__";
import * as Charts from "../ui/charts.js?v=__BUILD__";
import { scores, kpis, areaTotals } from "../domain/stats.js?v=__BUILD__";
import * as Storage from "../data/storage.js?v=__BUILD__";

let history = [];
let wired = false;

/** Lo llama el panel al abrir la pestaña y cada vez que cambia el historial. */
export function show(rows) {
  history = rows.slice();
  wire();

  if (!history.length) {
    $("#empty").classList.remove("hidden");
    $("#content").classList.add("hidden");
    $("#empty-note").textContent = Storage.getMode() === "guest"
      ? "Si ya hiciste exámenes, inicia sesión para ver tu historial." : "";
    return;
  }
  $("#empty").classList.add("hidden");
  $("#content").classList.remove("hidden");
  render();
}

function wire() {
  if (wired) return;
  wired = true;
  // Las gráficas se dibujan al ancho real: al cambiarlo se vuelven a dibujar.
  let t = null;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (history.length && $("#content").offsetParent !== null) render();
    }, 150);
  }, { passive: true });
}

function render() {
  renderScores(history);
  renderProgressLine(history);
  renderKpis(history);
  renderAreas(history);
}

/* ------------------------------------------------------------- puntajes */

/** Puntuación sobre 1000 (promedio de los porcentajes) y puntos totales (aciertos sumados). */
function renderScores(rows) {
  const { score1000, points } = scores(rows);
  $("#scores").innerHTML = `
    <div class="kpi accent">
      <div class="l">Puntuación</div>
      <div class="v">${score1000}<span class="of">/1000</span></div>
      <div class="s">Promedio de tus exámenes</div>
    </div>
    <div class="kpi accent">
      <div class="l">Puntos totales</div>
      <div class="v">${points.toLocaleString("es-MX")}</div>
      <div class="s">Aciertos sumados</div>
    </div>`;
}

/** Una sola línea con todos los intentos en orden de fecha. */
function renderProgressLine(rows) {
  const host = $("#chart-evolution");
  host.innerHTML = "";
  if (rows.length < 2) {
    host.innerHTML = `<p class="small muted">Haz al menos dos exámenes para ver tu avance.</p>`;
    return;
  }
  const min = Math.min(...rows.map((r) => r.percentage));
  Charts.lineChart(host, [{
    label: "Resultado",
    color: Charts.PALETTE[0],
    points: rows.map((r) => ({
      x: new Date(r.completedAt),
      y: r.percentage,
      filled: true,
      title: `${r.examTitle}\n${fmtDate(r.completedAt)}\n${r.score}/${r.total} (${r.percentage}%)`,
    })),
  }], [], { height: 190, yMin: Math.max(0, Math.floor((min - 10) / 10) * 10), labelLast: true });
}

/* ------------------------------------------------------------------ kpis */

function renderKpis(rows) {
  const k = kpis(rows);
  $("#kpis").innerHTML = `
    <div class="kpi">
      <div class="l">Exámenes completados</div>
      <div class="v">${k.count}</div>
      <div class="s">${!k.repeats ? "Sin repeticiones"
        : `${k.repeats} repetición(es)`}</div>
    </div>
    <div class="kpi">
      <div class="l">Mejor resultado</div>
      <div class="v">${k.best.percentage}%</div>
      <div class="s">${esc(k.best.examTitle)} · ${fmtDate(k.best.completedAt)}</div>
    </div>
    <div class="kpi">
      <div class="l">Último resultado</div>
      <div class="v">${k.last.percentage}%</div>
      <div class="s">${k.delta === null ? "Primer intento de este examen"
        : `${k.delta >= 0 ? "+" : ""}${k.delta} pts respecto al anterior`}</div>
    </div>
    <div class="kpi">
      <div class="l">Tiempo medio</div>
      <div class="v">${k.avgMinutes === null ? "—" : `${k.avgMinutes} min`}</div>
      <div class="s">${k.splitExcluded ? `${k.splitExcluded} intento(s) partido(s) excluido(s)` : "De intentos comparables"}</div>
    </div>`;
}

/* ------------------------------------------------------------------ áreas */

/** Barras en HTML con el texto encima: se leen igual en el celular que en escritorio. */
function renderAreas(rows) {
  const data = areaTotals(rows);
  $("#chart-areas").innerHTML = data.length
    ? hbars(data.map((d) => ({ label: d.area, pct: d.pct, detail: `${d.correct}/${d.total}` })))
    : `<p class="muted small">Sin datos.</p>`;
}
