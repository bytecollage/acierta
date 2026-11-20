/* catalog.js — carga del catálogo, de los exámenes y de sus claves (web/data/*.json).
   Todo lo que llega se valida antes de usarse. Ver docs/datos.md */

import { DataError } from "../domain/errors.js?v=__BUILD__";
import { validateCatalog, validateExam, validateAnswerKey, grade } from "../domain/grading.js?v=__BUILD__";
import { withCatalogTitles } from "../domain/attempt.js?v=__BUILD__";
import * as Storage from "./storage.js?v=__BUILD__";

let catalog = [];

export async function loadJSON(path) {
  let res;
  try {
    // no-cache revalida con el servidor (respuesta 304 si no cambió) y aprovecha la
    // precarga que hace la bienvenida.
    res = await fetch(path, { cache: "no-cache" });
  } catch (e) {
    throw new DataError(
      `No se pudo cargar "${path}".`,
      "Si abriste el archivo con doble clic, fetch() está bloqueado.\n" +
      "Sirve la carpeta por HTTP:  python3 -m http.server 8000"
    );
  }
  if (!res.ok) throw new DataError(`No se pudo cargar "${path}" (HTTP ${res.status}).`);
  try {
    return await res.json();
  } catch (e) {
    throw new DataError(`"${path}" no es JSON válido.`, String(e.message || e));
  }
}

/** Carga y valida el catálogo; queda disponible en getCatalog() y findEntry(). */
export async function loadCatalog() {
  catalog = validateCatalog(await loadJSON("data/exams.json"));
  return catalog;
}

export const getCatalog = () => catalog;
export const findEntry = (id) => catalog.find((e) => e.id === id) || null;

/** El historial con el título actual del catálogo: los registros guardan el que tenía el
 *  examen al hacerse (domain/attempt.js). */
export const titledHistory = () => withCatalogTitles(catalog, Storage.getAllHistory());

/** { exam, stimuli, questions } de un examen del catálogo. */
export async function loadExam(entry) {
  return validateExam(await loadJSON(`data/${entry.questions}`), entry);
}

/** Carga y valida la clave del examen y corrige las respuestas. */
export async function gradeAttempt(entry, exam, questions, selected, timing) {
  const keyMap = validateAnswerKey(await loadJSON(`data/${entry.answers}`), exam, questions);
  return grade(exam, questions, selected, keyMap, timing, entry.id);
}
