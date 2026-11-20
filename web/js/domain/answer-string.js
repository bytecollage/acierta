/* answer-string.js — la cadena de respuestas `<código>|<minutos>|<LETRAS>`.
   Es la que se copia, se guarda en la hoja (columna `answers`) y permite rehacer la corrección.
   Ver docs/decisiones.md D-13 */

import { DataError } from "./errors.js?v=__BUILD__";

/** Cadena `<código>|<minutos>|<LETRAS>`, por ejemplo `N1E01|72|ABCA…`. */
function buildAnswerString(code, questions, selected, minutes) {
  const letters = [...questions]
    .sort((a, b) => a.id - b.id)
    .map((q) => selected[q.id])
    .join("");
  const str = `${code}|${minutes}|${letters}`;
  if (!parseAnswerString(str) || letters.length !== questions.length) {
    throw new DataError(
      "Error interno al construir la cadena de respuestas.",
      `Longitud ${letters.length}, se esperaban ${questions.length}.`
    );
  }
  return str;
}

/** Lee una cadena de respuestas. Acepta también el formato anterior `<minutos><LETRAS>`
 *  (sin código), que es el de los intentos guardados antes del 2026-11-19.
 *  Devuelve { code, minutes, letters } (code = null en el formato anterior) o null. */
function parseAnswerString(str) {
  const s = String(str || "");
  let m = s.match(/^([A-Z0-9]{1,20})\|(\d+)\|([ABC]+)$/);
  if (m) return { code: m[1], minutes: Number(m[2]), letters: m[3] };
  m = s.match(/^(\d+)([ABC]+)$/);
  if (m) return { code: null, minutes: Number(m[1]), letters: m[2] };
  return null;
}

export { buildAnswerString, parseAnswerString };
