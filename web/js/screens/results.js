/* results.js — pantalla de resultados (#resultados/<id>): los mismos datos que la fila de
   Completados con ↻ y «Ver detalles», el resultado por área y la cadena de respuestas.
   Ver docs/funcionamiento.md §4 */

import { $, esc } from "../ui/dom.js?v=__BUILD__";
import { setTitle } from "../ui/appbar.js?v=__BUILD__";
import { iconBtn } from "../ui/icons.js?v=__BUILD__";
import { resultSummary } from "../ui/rows.js?v=__BUILD__";
import { hbars } from "../ui/hbars.js?v=__BUILD__";
import { confirmDialog, copyText } from "../ui/feedback.js?v=__BUILD__";
import { go } from "../router.js?v=__BUILD__";
import { parseAnswerString } from "../domain/answer-string.js?v=__BUILD__";
import { pct } from "../domain/stats.js?v=__BUILD__";
import { session } from "../services/exam-session.js?v=__BUILD__";
import * as Storage from "../data/storage.js?v=__BUILD__";

/** Pinta el resultado del intento corregido que tiene abierto la sesión. */
export function render() {
  const r = session.result;
  setTitle(session.exam.title);

  // Mismos datos que la fila de Completados, con ↻ y «Ver detalles» a la derecha.
  const hist = Storage.getHistory(session.entry.id);
  const rec = hist.find((h) => h.completedAt === session.completedAt) ||
    { score: r.score, total: r.total, percentage: r.percentage, minutes: r.minutes, completedAt: session.completedAt };
  $("#result-head").innerHTML = `
    <div class="exam-info">${resultSummary(session.entry, rec, hist)}</div>
    <div class="exam-actions">
      ${iconBtn("replay", session.entry, "restart", "Volver a intentarlo")}
      ${iconBtn("review", session.entry, "eye", "Ver detalles", true)}
    </div>`;
  $("#result-head").onclick = onAction;

  $("#area-results").innerHTML = hbars(session.exam.areas.map((a) => {
    const v = r.areaResults[a.name] || { correct: 0, total: 0 };
    return { label: a.name, pct: pct(v.correct, v.total), detail: `${v.correct}/${v.total}` };
  }));

  const a = parseAnswerString(r.answerString);
  $("#answer-string").innerHTML =
    `<span class="mins">${esc(a.code)}|${a.minutes}|</span>${a.letters}`;

  $("#btn-copy-answers").onclick = () => copyText(r.answerString, "Cadena copiada");
}

async function onAction(ev) {
  const btn = ev.target.closest("button[data-action]");
  if (!btn) return;
  const entry = session.entry;
  if (btn.dataset.action === "review") { go(`correccion/${entry.id}`); return; }
  // Un intento nuevo a medias se perdería: solo entonces se pide confirmación.
  const attempt = Storage.loadAttempt(entry.id, entry.version);
  if (attempt && !attempt.completed && !(await confirmDialog({
    title: "¿Volver a intentarlo?",
    text: "Tienes un intento sin terminar de este examen; se borrarán sus respuestas. Los resultados anteriores se conservan.",
    ok: "Comenzar de nuevo",
  }))) return;
  go(`examen/${entry.id}/nuevo`);
}
