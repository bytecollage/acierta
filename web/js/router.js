/* router.js — navegación por hash, para que el botón «atrás» del móvil funcione.
   La acción va siempre en la URL (D-16):
     #examenes · #completados · #progreso      pestañas del panel
     #reporte                                  reporte detallado
     #examen/<id>                              continuar el intento guardado
     #examen/<id>/nuevo                        empezar de cero (se reemplaza por #examen/<id>)
     #resultados/<id> · #correccion/<id>       último resultado y examen corregido
   Los enlaces con el id anterior (#resultados/diagnostico-6) llevan al nuevo (D-14).
   Este módulo no conoce las pantallas: main.js registra qué hacer con cada ruta. */

import { canonId } from "./domain/ids.js?v=__BUILD__";

export const TABS = ["examenes", "completados", "progreso"];
const EXAM_ROUTES = ["examen", "resultados", "correccion"];

/**
 * Interpreta un hash. Devuelve una de:
 *   { name: "examen" | "resultados" | "correccion", id, fresh, redirect }
 *   { name: "reporte" }
 *   { name: "tab", tab }
 * `redirect` es el hash canónico cuando el id venía en el formato anterior.
 */
export function parseRoute(hash) {
  const [name = "", rawId, sub] = String(hash || "").replace(/^#/, "").split("/");
  if (EXAM_ROUTES.includes(name) && rawId) {
    const id = canonId(rawId);
    const fresh = name === "examen" && sub === "nuevo";
    const redirect = id !== rawId ? `#${name}/${id}${fresh ? "/nuevo" : ""}` : null;
    return { name, id, fresh, redirect };
  }
  if (name === "reporte") return { name };
  return { name: "tab", tab: TABS.includes(name) ? name : "examenes" };
}

let handler = () => {};

/** `fn(route)` se llama con cada cambio de hash y al arrancar con start(). */
export function onRoute(fn) { handler = fn; }

export function route() {
  const r = parseRoute(location.hash);
  if (r.redirect) history.replaceState(null, "", r.redirect);
  handler(r);
}

export function start() {
  window.addEventListener("hashchange", route);
  route();
}

/** Navega a `hash` (sin «#»). Si ya es el actual, vuelve a procesarlo. */
export function go(hash) {
  const h = "#" + hash;
  if (location.hash === h) route();
  else location.hash = h;
}

/** Sustituye la URL sin añadir una entrada al historial ni procesarla. */
export const replace = (hash) => history.replaceState(null, "", "#" + hash);

/** Sustituye la URL y la procesa, sin dejar la anterior en el historial. */
export function redirect(hash) {
  replace(hash);
  route();
}
