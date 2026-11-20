/* appbar.js — qué pantalla de panel.html se ve y cómo queda la barra fija.
   Misma barra en todas: pestañas en el panel; ← y título en las demás. Ver docs/funcionamiento.md §1 */

import { $ } from "./dom.js?v=__BUILD__";

let current = "panel";

/** Pantalla visible: "panel" | "examen" | "correccion" | "resultados" | "reporte". */
export const currentScreen = () => current;

/** Muestra una pantalla. `examId` es el examen abierto (la ← de la corrección vuelve a su resultado). */
export function showScreen(name, examId = "") {
  current = name;
  // La corrección es la misma pantalla del examen, con las respuestas marcadas.
  const screen = name === "correccion" ? "examen" : name;
  ["panel", "examen", "resultados", "reporte"].forEach((s) => {
    $(`#screen-${s}`).classList.toggle("hidden", s !== screen);
  });
  document.body.dataset.screen = name;
  $("#tabbar").classList.toggle("hidden", name !== "panel");
  $("#appfooter").classList.toggle("hidden", name !== "panel" && name !== "reporte");
  $("#topbar").classList.toggle("hidden", name === "panel");
  ["#progress-bar", "#progress-text", "#timer", "#topbar-restart"].forEach((sel) =>
    $(sel).classList.toggle("hidden", name !== "examen"));
  if (name === "correccion") $("#exam-alert").classList.add("hidden");
  // A dónde lleva la flecha ← de la barra fija en cada pantalla.
  const [goto, label] = {
    examen: ["examenes", "Volver a mis exámenes"],
    resultados: ["completados", "Volver a completados"],
    reporte: ["progreso", "Volver a mi progreso"],
    correccion: [`resultados/${examId}`, "Volver al resultado"],
  }[name] || ["examenes", "Volver a mis exámenes"];
  $("#topbar-back").dataset.goto = goto;
  $("#topbar-back").setAttribute("aria-label", label);
  $("#topbar-back").title = label;
  if (name === "reporte") setTitle("Reporte detallado");
  paintTopbarHeight();
  window.scrollTo(0, 0);
}

export const setTitle = (text) => { $("#topbar-title").textContent = text; };

/** Los textos de lectura se pegan justo debajo de la barra fija, que cambia de alto. */
export function paintTopbarHeight() {
  const bar = $("#topbar");
  document.documentElement.style.setProperty("--topbar-h",
    bar.classList.contains("hidden") ? "0px" : `${bar.offsetHeight}px`);
}
