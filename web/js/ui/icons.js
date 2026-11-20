/* icons.js — íconos SVG en línea y botón de solo ícono. */

import { esc } from "./dom.js?v=__BUILD__";

const ICONS = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  restart: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};

export const icon = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

/** Botón de solo ícono; la etiqueta va en aria-label y en el title. */
export function iconBtn(action, entry, name, label, primary) {
  const full = `${label} ${entry.title}`;
  return `<button type="button" class="icon-btn${primary ? " primary" : ""}" data-action="${action}"
            data-id="${esc(entry.id)}" aria-label="${esc(full)}" title="${esc(label)}">${icon(name)}</button>`;
}

export const CHEVRON = '<svg class="ic row-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
