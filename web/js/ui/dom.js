/* dom.js — utilidades de DOM y formato compartidas por las pantallas. */

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/** Escapa texto para insertarlo en HTML. */
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const fmtDate = (iso) => new Date(iso).toLocaleDateString("es-MX",
  { day: "numeric", month: "short", year: "numeric" });

/** Fecha corta: el año solo si no es el actual (ahorra una línea en el celular). */
export const fmtShortDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", d.getFullYear() === new Date().getFullYear()
    ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
};
