/* exam.js — pantalla del examen y de la corrección (#examen/<id>, #correccion/<id>).
   Pinta las preguntas, el avance y el cronómetro; «Terminar examen» corrige y lleva al
   resultado. La corrección es esta misma pantalla con las respuestas marcadas.
   Ver docs/funcionamiento.md §3–4 */

import { $, $$, esc } from "../ui/dom.js?v=__BUILD__";
import { showScreen, setTitle } from "../ui/appbar.js?v=__BUILD__";
import { busy, confirmDialog, fatal } from "../ui/feedback.js?v=__BUILD__";
import { replace, redirect } from "../router.js?v=__BUILD__";
import * as Session from "../services/exam-session.js?v=__BUILD__";
import * as Results from "./results.js?v=__BUILD__";
import * as Storage from "../data/storage.js?v=__BUILD__";
import * as Auth from "../data/auth.js?v=__BUILD__";

const { session } = Session;

/* ------------------------------------------------------------ utilidades */

function fmtClock(ms) {
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

function listNumbers(nums) {
  if (nums.length === 1) return String(nums[0]);
  return `${nums.slice(0, -1).join(", ")} y ${nums[nums.length - 1]}`;
}

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");

/* -------------------------------------------------------------- abrir */

/**
 * Abre un examen. mode: "continue" | "new" | "view" (ver services/exam-session.js).
 * Si queda corregido, muestra `target`: «resultados» o «correccion».
 */
export async function open(entry, mode, target = "resultados") {
  busy("Cargando examen…");
  try {
    const status = await Session.open(entry, mode);
    if (status === "missing") { redirect("completados"); return; }

    $("#exam-alert").classList.add("hidden");
    renderExam();

    if (status === "completed") {
      paintCorrection();
      Results.render();
      replace(`${target}/${entry.id}`);
      showScreen(target, entry.id);
      return;
    }

    replace(`examen/${entry.id}`);
    showScreen("examen");
    Session.start();
    renderProgress();
    renderTimer();
    Session.save();
  } catch (e) { Session.stop(); fatal(e); }
  finally { busy(null); }
}

/* ------------------------------------------------------------- pintar */

function renderExam() {
  setTitle(session.exam.title);
  const byStimulus = new Map(session.stimuli.map((s) => [s.id, s]));

  $("#questions").innerHTML = session.exam.areas.map((area) => {
    const qs = session.questions.filter((q) => q.area === area.name).sort((a, b) => a.id - b.id);
    const chunks = [];
    let i = 0;
    while (i < qs.length) {
      const sid = qs[i].stimulusId;
      if (sid) {
        const block = [];
        while (i < qs.length && qs[i].stimulusId === sid) block.push(qs[i++]);
        chunks.push(renderStimulusBlock(byStimulus.get(sid), block));
      } else {
        chunks.push(renderQuestion(qs[i++]));
      }
    }
    return `<section class="area-block" id="area-${esc(slug(area.name))}">
        <div class="area-head">
          <h2>${esc(area.name)} <span class="count">· ${qs.length}</span></h2>
        </div>
        ${chunks.join("")}
      </section>`;
  }).join("");

  // Un examen recién abierto siempre se puede terminar, aunque antes se viera una corrección.
  $("#finish-card").classList.remove("hidden");
}

function renderStimulusBlock(stim, questions) {
  const sid = `stim-${esc(stim.id)}`;
  return `<div class="stimulus-block">
    <button type="button" class="stimulus-toggle" aria-expanded="true" aria-controls="${sid}"
            data-toggle="${sid}">Ocultar texto</button>
    <div class="stimulus" id="${sid}">
      ${stim.instruction ? `<div class="instr">${esc(stim.instruction)}</div>` : ""}
      <div class="text">${esc(stim.text)}</div>
    </div>
    ${questions.map((q) => renderQuestion(q, sid)).join("")}
  </div>`;
}

function renderQuestion(q, describedBy) {
  const opts = ["A", "B", "C"].map((k) => `
    <div class="opt" data-key="${k}">
      <label for="q${q.id}${k}">
        <input type="radio" id="q${q.id}${k}" name="q${q.id}" value="${k}"
               ${session.selectedAnswers[q.id] === k ? "checked" : ""}>
        <span class="key">${k}.</span>
        <span class="txt">${esc(q.options[k])}</span>
        <span class="tag"></span>
      </label>
    </div>`).join("");
  // El tema NO se incluye durante el examen: delataría de qué trata la pregunta.
  // Se inyecta al corregir, en paintCorrection(), donde sí es útil para estudiar.
  return `<fieldset class="q" id="q-${q.id}" data-id="${q.id}"
                   ${describedBy ? `aria-describedby="${describedBy}"` : ""}>
      <legend><span class="num">${q.id}.</span>${esc(q.text)}</legend>
      ${opts}
    </fieldset>`;
}

function renderProgress() {
  const { done, total } = Session.progress();
  $("#progress-text").textContent = `${done}/${total}`;
  $("#progress-fill").style.width = `${(done / total) * 100}%`;
  const bar = $("#progress-bar");
  bar.setAttribute("aria-valuenow", String(done));
  bar.setAttribute("aria-valuemax", String(total));
}

function renderTimer() {
  const el = $("#timer");
  if (!el) return;
  el.classList.toggle("paused", session.paused);
  el.innerHTML = `<span class="dot" aria-hidden="true">●</span> ${fmtClock(Session.currentMs())}` +
    (session.paused ? ' <span class="small">(en pausa)</span>' : "");
}

/* ----------------------------------------------------------- responder */

function onAnswerChange(ev) {
  const input = ev.target;
  if (!input.matches('input[type="radio"]')) return;
  const id = Number(input.name.slice(1));
  Session.answer(id, input.value);
  $(`#q-${id}`).classList.remove("pending");
  renderProgress();
}

/** ↻ de la barra del examen: empieza de cero tras confirmar, porque se pierde el avance. */
async function restart() {
  const ok = await confirmDialog({
    title: "¿Comenzar de nuevo?",
    text: "Se borrarán las respuestas y el tiempo de este intento. Los resultados anteriores se conservan.",
    ok: "Comenzar de nuevo",
  });
  // Sustituye la URL: «atrás» sigue llevando a la lista, no al intento anterior.
  if (ok) redirect(`examen/${session.entry.id}/nuevo`);
}

/* ------------------------------------------------------------ terminar */

async function finish() {
  const pending = Session.unanswered();
  const box = $("#exam-alert");

  if (pending.length) {
    $$(".q").forEach((el) => el.classList.remove("pending"));
    pending.forEach((id) => $(`#q-${id}`).classList.add("pending"));
    const word = pending.length === 1 ? "Falta 1 pregunta" : `Faltan ${pending.length} preguntas`;
    box.className = "alert warn";
    box.textContent = `${word}: ${listNumbers(pending)}`;
    box.classList.remove("hidden");
    const first = $(`#q-${pending[0]}`);
    first.scrollIntoView({ block: "center" });
    const radio = first.querySelector('input[type="radio"]');
    if (radio) radio.focus();
    return;
  }

  box.classList.add("hidden");
  busy("Corrigiendo y guardando tu resultado…");
  try {
    await Session.finish();
    paintCorrection();
    Results.render();
    replace(`resultados/${session.entry.id}`);
    showScreen("resultados");
    if (Storage.getMode() === "guest" || Storage.pendingCount()) Auth.refresh();
  } catch (e) {
    // No se corrige nada y el intento queda intacto.
    box.className = "alert error";
    box.innerHTML = `<strong>${esc(e.message)}</strong>` +
      (e.detail ? `<pre>${esc(e.detail)}</pre>` : "");
    box.classList.remove("hidden");
    box.scrollIntoView({ block: "center" });
    console.error(e);
  } finally {
    busy(null);
  }
}

/* ---------------------------------------------------------- corrección */

function paintCorrection() {
  session.result.perQuestion.forEach((r) => {
    const fs = $(`#q-${r.id}`);
    fs.classList.add("corrected", r.isCorrect ? "is-right" : "is-wrong");
    fs.classList.remove("pending");
    if (!$(".topic", fs)) {
      const t = document.createElement("div");
      t.className = "topic";
      t.textContent = `Tema: ${r.topic}`;
      fs.querySelector("legend").insertAdjacentElement("afterend", t);
    }
    $$(".opt", fs).forEach((opt) => {
      const k = opt.dataset.key;
      const tag = $(".tag", opt);
      const input = $("input", opt);
      input.disabled = true;
      if (k === r.selected && r.isCorrect) { opt.classList.add("is-ok"); tag.textContent = "Correcta"; }
      else if (k === r.selected) { opt.classList.add("is-bad"); tag.textContent = "Tu respuesta"; }
      else if (k === r.correct) { opt.classList.add("is-ok"); tag.textContent = "Respuesta correcta"; }
    });
  });
  $("#finish-card").classList.add("hidden");
}

/* -------------------------------------------------------------- inicio */

/** Escuchas fijas de la pantalla. Se llama una vez al arrancar. */
export function init() {
  $("#questions").onchange = onAnswerChange;
  $("#btn-terminar").onclick = finish;
  $("#topbar-restart").onclick = restart;
  Session.onTick(renderTimer);

  // Textos de lectura colapsables (útil en el celular).
  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-toggle]");
    if (!btn) return;
    const box = document.getElementById(btn.dataset.toggle);
    const open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!open));
    box.classList.toggle("hidden", open);
    btn.textContent = open ? "Ver texto" : "Ocultar texto";
  });
}
