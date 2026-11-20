/* report.js — pantalla «Reporte detallado» (#reporte): temas a reforzar, evolución por examen
   e intentos, con filtros por examen, área y repeticiones. Los cálculos están en domain/stats.js.
   Ver docs/funcionamiento.md §5 */

import { $, esc, fmtDate } from "../ui/dom.js?v=__BUILD__";
import * as Charts from "../ui/charts.js?v=__BUILD__";
import {
  MIN_OBS_RECOMMEND, WEAK_THRESHOLD,
  topicStats, groupByExam, chanceRefs, examBreakdown,
} from "../domain/stats.js?v=__BUILD__";

let history = [];
const filters = { area: "*", exam: "*", includeRepeats: false };
let wired = false;

export function show(rows) {
  history = rows.slice();
  wire();

  $("#report-empty").classList.toggle("hidden", history.length > 0);
  $("#report").classList.toggle("hidden", !history.length);
  if (!history.length) return;

  // Un filtro que apunta a un examen que ya no está en el historial se reinicia.
  if (filters.exam !== "*" && !history.some((h) => h.examId === filters.exam)) filters.exam = "*";
  buildFilters();
  $("#f-exam").value = filters.exam;
  $("#f-area").value = filters.area;
  if ($("#f-area").value !== filters.area) { filters.area = "*"; $("#f-area").value = "*"; }
  $("#f-repeats").checked = filters.includeRepeats;
  render();
}

function wire() {
  if (wired) return;
  wired = true;
  $("#f-area").onchange = (e) => { filters.area = e.target.value; render(); };
  $("#f-exam").onchange = (e) => { filters.exam = e.target.value; render(); };
  $("#f-repeats").onchange = (e) => { filters.includeRepeats = e.target.checked; render(); };
  // Las gráficas se dibujan al ancho real: al cambiarlo se vuelven a dibujar.
  let t = null;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (history.length && $("#report").offsetParent !== null) render();
    }, 150);
  }, { passive: true });
}

function buildFilters() {
  const exams = [...new Map(history.map((h) => [h.examId, h.examTitle])).entries()];
  // Textos cortos: los dos filtros caben lado a lado en el celular.
  $("#f-exam").innerHTML = `<option value="*">Todos</option>` +
    exams.map(([id, t]) => `<option value="${esc(id)}">${esc(t)}</option>`).join("");

  const areas = new Set();
  history.forEach((h) => Object.keys(h.areaResults || {}).forEach((a) => areas.add(a)));
  $("#f-area").innerHTML = `<option value="*">Todas</option>` +
    [...areas].map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join("");
}

function render() {
  const rows = history.filter((h) => filters.exam === "*" || h.examId === filters.exam);
  renderTopics(rows);
  renderEvolution(rows);
  renderBreakdown(rows);
}

/* ------------------------------------------------------------------ temas */

const TREND = {
  up: '<span title="mejorando">↑</span>',
  down: '<span title="empeorando">↓</span>',
  flat: '<span title="estable">→</span>',
};

function renderTopics(rows) {
  const { usable, reliable, low, weak } = topicStats(rows, filters);
  $("#repeat-warning").classList.toggle("hidden", !filters.includeRepeats);

  if (!usable.length) {
    $("#topics-body").innerHTML = "";
    $("#topics-low").innerHTML = "";
    $("#recommend").innerHTML =
      `<p class="alert info">No hay intentos que cumplan el filtro actual.</p>`;
    return;
  }

  const chip = { high: '<span class="chip high">Alta</span>',
                 mid: '<span class="chip mid">Media</span>',
                 low: '<span class="chip low">Baja</span>' };

  $("#topics-body").innerHTML = reliable.length ? reliable.map((t) => `
    <tr>
      <td>${esc(t.topic)}</td>
      <td style="text-align:left">${esc(t.area)}</td>
      <td>${t.correct} / ${t.total}</td>
      <td>${t.pct}%</td>
      <td class="opt-col">${t.total}</td>
      <td class="opt-col">${TREND[t.trend] || "—"}</td>
      <td>${chip[t.confidence]}</td>
    </tr>`).join("")
    : `<tr><td colspan="7" class="muted">Ningún tema alcanza aún ${MIN_OBS_RECOMMEND} observaciones.</td></tr>`;

  $("#topics-low").innerHTML = low.map((t) => `
    <tr>
      <td>${esc(t.topic)}</td>
      <td style="text-align:left">${esc(t.area)}</td>
      <td>${t.correct} / ${t.total}</td>
      <td>${t.pct}%</td>
    </tr>`).join("");
  $("#topics-low-count").textContent = low.length;

  $("#recommend").innerHTML = weak.length
    ? `<div class="alert warn"><strong>Recomendado estudiar</strong>
         <p class="small">Temas con al menos ${MIN_OBS_RECOMMEND} preguntas vistas y menos del
            ${WEAK_THRESHOLD}% de acierto.</p>
         <ul>${weak.map((t) =>
           `<li><strong>${esc(t.topic)}</strong> — ${t.correct}/${t.total} (${t.pct}%) · ${esc(t.area)}</li>`
         ).join("")}</ul></div>`
    : `<div class="alert info">Aún no hay suficientes datos para recomendar temas concretos.
         Repite los exámenes o añade exámenes nuevos.</div>`;
}

/* ------------------------------------------------------------- evolución */

function renderEvolution(rows) {
  const host = $("#chart-exams");
  host.innerHTML = "";

  if (rows.length < 2) {
    host.innerHTML = `<p class="alert info">Haz al menos dos exámenes para ver tu evolución.</p>`;
    $("#evolution-legend").innerHTML = "";
    return;
  }

  const byExam = groupByExam(rows);
  const series = [];
  let i = 0;
  byExam.forEach((rs) => {
    const color = Charts.PALETTE[i % Charts.PALETTE.length];
    series.push({
      label: rs[0].examTitle,
      color,
      points: rs.map((r) => ({
        x: new Date(r.completedAt),
        y: r.percentage,
        filled: r.isFirstAttempt !== false,
        title: `${r.examTitle}\n${fmtDate(r.completedAt)}\n${r.score}/${r.total} (${r.percentage}%)` +
               `\n${r.minutes} min` + (r.isFirstAttempt === false ? "\n(repetición)" : ""),
      })),
    });
    i += 1;
  });
  const refs = chanceRefs(byExam);

  $("#evolution-legend").innerHTML =
    series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join("") +
    `<span><i style="background:#fff;border:2px solid #6b7280"></i>punto hueco = repetición</span>`;

  Charts.lineChart(host, series, refs);
  Charts.dataTable(
    host,
    ["Fecha", "Examen", "Resultado", "%", "Tiempo", "Intento"],
    rows.map((r) => [
      fmtDate(r.completedAt), esc(r.examTitle), `${r.score}/${r.total}`,
      `${r.percentage}%`, `${r.minutes} min`,
      r.isFirstAttempt === false ? `#${r.attemptNumber} (repetición)` : `#${r.attemptNumber}`,
    ]),
    "Ver datos de la gráfica"
  );
}

function renderBreakdown(rows) {
  $("#exam-breakdown").textContent = examBreakdown(rows)
    .map((e) => `${e.title}: ${e.attempts} intento${e.attempts > 1 ? "s" : ""}`)
    .join(" · ");
}
