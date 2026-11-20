/* rows.js — piezas de las filas de examen y de la tarjeta de resultado. */

import { esc, fmtShortDate } from "./dom.js?v=__BUILD__";

/** Título y línea de datos de un resultado, iguales en Completados y en Resultados. */
export function resultSummary(entry, rec, hist) {
  const best = hist.length ? hist.reduce((a, b) => (b.percentage > a.percentage ? b : a)) : rec;
  const meta = [
    `${rec.score}/${rec.total}`,
    rec.minutes ? `${rec.minutes} min` : "",
    rec.completedAt ? fmtShortDate(rec.completedAt) : "",
    hist.length > 1 ? `${hist.length} intentos · mejor ${best.percentage}%` : "",
  ].filter(Boolean).join(" · ");
  return `<h3>${esc(entry.title)} <span class="row-sep">·</span> <span class="row-pct">${rec.percentage}%</span></h3>
    <div class="exam-meta">${meta}${rec.pending ? ` <span class="chip low">pendiente de subir</span>` : ""}</div>`;
}

/** Barra fina de avance de un intento a medias. */
export const miniBar = (n, total) =>
  `<div class="mini-bar" aria-hidden="true"><div style="width:${total ? (n / total) * 100 : 0}%"></div></div>`;
