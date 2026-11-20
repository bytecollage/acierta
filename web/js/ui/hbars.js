/* hbars.js — barras horizontales con el texto encima (resultado por área, Mi progreso).
   En HTML y no en SVG: se leen igual en el celular que en escritorio. */

import { esc } from "./dom.js?v=__BUILD__";

/** items: [{ label, pct, detail }] → <ul class="hbars">. */
export const hbars = (items) => `<ul class="hbars">${items.map((d) => `
  <li class="hbar"><div class="hbar-fill" style="width:${d.pct}%"></div>
    <span class="hbar-label">${esc(d.label)}</span>
    <span class="hbar-value">${d.pct}% · ${d.detail}</span></li>`).join("")}</ul>`;
