/* feedback.js — avisos al estudiante: espera bloqueante, aviso breve, confirmación,
   copiar al portapapeles y error que impide continuar. */

import { $, esc } from "./dom.js?v=__BUILD__";
import { showScreen } from "./appbar.js?v=__BUILD__";
import { DataError } from "../domain/errors.js?v=__BUILD__";

/** Indicador bloqueante para esperas que el estudiante provocó (abrir, guardar). null lo quita. */
export function busy(text) {
  const el = $("#busy");
  if (!el) return;
  if (text) $("#busy-text").textContent = text;
  el.classList.toggle("hidden", !text);
  el.setAttribute("aria-busy", text ? "true" : "false");
}

export function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

/** Copia `text` y avisa con `msg`. Sin API de portapapeles, usa un textarea temporal. */
export async function copyText(text, msg) {
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

/** Diálogo de confirmación con el estilo de la app. Devuelve true si se aceptó. */
export function confirmDialog({ title, text, ok }) {
  const dlg = $("#confirm-dialog");
  $("#confirm-title").textContent = title;
  $("#confirm-text").textContent = text;
  $("#confirm-ok").textContent = ok;
  dlg.returnValue = "";
  return new Promise((resolve) => {
    dlg.addEventListener("close", () => resolve(dlg.returnValue === "ok"), { once: true });
    dlg.showModal();
  });
}

/** Datos inconsistentes: la app se detiene con el mensaje en lugar del panel. */
export function fatal(err) {
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
