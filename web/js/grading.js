/* grading.js — validación de datos, corrección y construcción de resultados.
   Sin efectos secundarios ni DOM: entra JSON, sale resultado.
   Ver docs/datos.md §5 y docs/funcionamiento.md §4 */

(function () {
  "use strict";

  class DataError extends Error {
    constructor(message, detail) {
      super(message);
      this.name = "DataError";
      this.detail = detail || "";
    }
  }

  /* ---------------------------------------------------- validar catálogo */

  function validateCatalog(catalog) {
    const e = [];
    if (!Array.isArray(catalog) || catalog.length === 0) {
      throw new DataError("exams.json debe ser un array con al menos un examen.");
    }
    const ids = catalog.map((x) => x && x.id);
    if (new Set(ids).size !== ids.length) e.push("Hay ids de examen duplicados.");
    catalog.forEach((x, i) => {
      ["id", "title", "version", "questionCount", "questions", "answers"].forEach((k) => {
        if (x[k] === undefined || x[k] === null || x[k] === "") {
          e.push(`Entrada ${i}: falta el campo "${k}".`);
        }
      });
      // El id es el código del examen (N1E02): va en las URL y encabeza la cadena de
      // respuestas, así que solo mayúsculas y dígitos, sin «|».
      if (x.id && !/^[A-Z0-9]{1,20}$/.test(x.id)) e.push(`Entrada ${i}: id "${x.id}" no es válido (A–Z, 0–9).`);
    });
    if (e.length) throw new DataError("exams.json no es válido.", e.join("\n"));
    return catalog;
  }

  /* ----------------------------------------------------- validar examen */

  function validateExam(data, catalogEntry) {
    const e = [];
    if (!data || !data.exam || !Array.isArray(data.questions)) {
      throw new DataError("questions.json no tiene la estructura esperada.");
    }
    const E = data.exam;
    const Q = data.questions;
    const S = Array.isArray(data.stimuli) ? data.stimuli : [];

    if (E.id !== catalogEntry.id) e.push(`exam.id "${E.id}" no coincide con el catálogo "${catalogEntry.id}".`);
    if (E.version !== catalogEntry.version) e.push(`exam.version "${E.version}" no coincide con el catálogo "${catalogEntry.version}".`);
    if (E.questionCount !== Q.length) e.push(`exam.questionCount es ${E.questionCount} pero hay ${Q.length} preguntas.`);
    if (E.questionCount !== catalogEntry.questionCount) e.push(`questionCount no coincide con el catálogo (${catalogEntry.questionCount}).`);
    if (!Array.isArray(E.areas) || E.areas.length === 0) e.push("exam.areas está vacío.");

    const ids = Q.map((q) => q.id);
    if (ids.some((n) => !Number.isInteger(n))) e.push("Hay ids que no son enteros.");
    if (new Set(ids).size !== ids.length) e.push("Hay ids de pregunta duplicados.");
    const expected = Array.from({ length: Q.length }, (_, i) => i + 1);
    if (JSON.stringify([...ids].sort((a, b) => a - b)) !== JSON.stringify(expected)) {
      e.push("Los ids no son consecutivos desde 1.");
    }

    const areaNames = new Set((E.areas || []).map((a) => a.name));
    Q.forEach((q) => {
      if (!q.area || !areaNames.has(q.area)) e.push(`Pregunta ${q.id}: área "${q.area}" no está declarada en exam.areas.`);
      if (!q.topic || !String(q.topic).trim()) e.push(`Pregunta ${q.id}: falta "topic".`);
      if (!q.text || !String(q.text).trim()) e.push(`Pregunta ${q.id}: enunciado vacío.`);
      const keys = Object.keys(q.options || {}).sort().join("");
      if (keys !== "ABC") e.push(`Pregunta ${q.id}: las opciones deben ser exactamente A, B y C (son "${keys}").`);
      Object.entries(q.options || {}).forEach(([k, v]) => {
        if (!String(v).trim()) e.push(`Pregunta ${q.id}: la opción ${k} está vacía.`);
      });
    });

    let prev = 0;
    (E.areas || []).forEach((a) => {
      if (a.start !== prev + 1) e.push(`Área "${a.name}": empieza en ${a.start} y debería empezar en ${prev + 1}.`);
      prev = a.end;
      const inArea = Q.filter((q) => q.area === a.name).map((q) => q.id);
      const n = a.end - a.start + 1;
      if (inArea.length !== n || Math.min(...inArea) !== a.start || Math.max(...inArea) !== a.end) {
        e.push(`Área "${a.name}": declara ${a.start}-${a.end} pero contiene ${inArea.length} preguntas.`);
      }
    });
    if (prev !== E.questionCount) e.push(`Las áreas cubren hasta la ${prev} pero el examen tiene ${E.questionCount}.`);

    const sids = S.map((s) => s.id);
    if (new Set(sids).size !== sids.length) e.push("Hay ids de estímulo duplicados.");
    S.forEach((s) => {
      if (!s.text || !String(s.text).trim()) e.push(`Estímulo "${s.id}": texto vacío.`);
      if (!areaNames.has(s.area)) e.push(`Estímulo "${s.id}": área "${s.area}" no declarada.`);
    });
    const used = new Set();
    Q.forEach((q) => {
      if (q.stimulusId === undefined) return;
      if (!sids.includes(q.stimulusId)) {
        e.push(`Pregunta ${q.id}: stimulusId "${q.stimulusId}" no existe.`);
      } else {
        used.add(q.stimulusId);
        const s = S.find((x) => x.id === q.stimulusId);
        if (s && s.area !== q.area) e.push(`Pregunta ${q.id}: su área no coincide con la del estímulo "${s.id}".`);
      }
    });
    sids.forEach((id) => { if (!used.has(id)) e.push(`Estímulo "${id}" no lo usa ninguna pregunta.`); });
    S.forEach((s) => {
      const d = Q.filter((q) => q.stimulusId === s.id).map((q) => q.id).sort((a, b) => a - b);
      if (d.length && d[d.length - 1] - d[0] + 1 !== d.length) {
        e.push(`Estímulo "${s.id}": sus preguntas (${d.join(", ")}) no son contiguas.`);
      }
    });

    if (e.length) throw new DataError(`El examen "${catalogEntry.id}" tiene datos inconsistentes.`, e.join("\n"));
    return { exam: E, stimuli: S, questions: Q };
  }

  /* ------------------------------------------------------ validar clave */

  function validateAnswerKey(key, exam, questions) {
    const e = [];
    if (!key || !Array.isArray(key.answers)) throw new DataError("answers.json no tiene la estructura esperada.");
    if (key.examId !== exam.id) e.push(`answers.examId "${key.examId}" no coincide con "${exam.id}".`);
    if (key.version !== exam.version) e.push(`answers.version "${key.version}" no coincide con "${exam.version}".`);

    const qById = new Map(questions.map((q) => [q.id, q]));
    const seen = new Set();
    key.answers.forEach((a) => {
      if (seen.has(a.id)) e.push(`Clave duplicada para la pregunta ${a.id}.`);
      seen.add(a.id);
      const q = qById.get(a.id);
      if (!q) { e.push(`La clave tiene la pregunta ${a.id}, que no existe en el examen.`); return; }
      if (!Object.prototype.hasOwnProperty.call(q.options, a.correctAnswer)) {
        e.push(`Pregunta ${a.id}: la respuesta correcta "${a.correctAnswer}" no es una de sus opciones.`);
      }
    });
    questions.forEach((q) => { if (!seen.has(q.id)) e.push(`Falta la clave de la pregunta ${q.id}.`); });

    if (e.length) throw new DataError("La clave de respuestas no es válida.", e.join("\n"));
    return new Map(key.answers.map((a) => [a.id, a.correctAnswer]));
  }

  /* ---------------------------------------------------------- corregir */

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

  function keyDistribution(keyMap) {
    const d = { A: 0, B: 0, C: 0 };
    keyMap.forEach((v) => { if (d[v] !== undefined) d[v] += 1; });
    return d;
  }

  /** Porcentaje que obtendría quien marcase siempre la misma letra. */
  function chanceBaseline(dist, total) {
    const best = Math.max(dist.A, dist.B, dist.C);
    const letter = ["A", "B", "C"].find((k) => dist[k] === best);
    return { letter, percentage: Math.round((best / total) * 100) };
  }

  function grade(exam, questions, selected, keyMap, timing, code) {
    const perQuestion = [...questions].sort((a, b) => a.id - b.id).map((q) => {
      const correct = keyMap.get(q.id);
      const sel = selected[q.id];
      return { id: q.id, area: q.area, topic: q.topic, selected: sel, correct, isCorrect: sel === correct };
    });

    const areaResults = {};
    const topicResults = {};
    const topicAreas = {};
    (exam.areas || []).forEach((a) => { areaResults[a.name] = { correct: 0, total: 0 }; });

    perQuestion.forEach((r) => {
      if (!areaResults[r.area]) areaResults[r.area] = { correct: 0, total: 0 };
      areaResults[r.area].total += 1;
      if (r.isCorrect) areaResults[r.area].correct += 1;

      if (!topicResults[r.topic]) topicResults[r.topic] = { correct: 0, total: 0 };
      topicResults[r.topic].total += 1;
      if (r.isCorrect) topicResults[r.topic].correct += 1;
      topicAreas[r.topic] = r.area;
    });

    const correctCount = perQuestion.filter((r) => r.isCorrect).length;
    const total = perQuestion.length;
    const minutes = Math.max(1, Math.round(timing.activeMs / 60000));
    const dist = keyDistribution(keyMap);

    return {
      score: correctCount,
      total,
      percentage: Math.round((correctCount / total) * 100),
      correctCount,
      incorrectCount: total - correctCount,
      minutes,
      activeMs: timing.activeMs,
      elapsedWallMs: timing.elapsedWallMs,
      answerString: buildAnswerString(code, questions, selected, minutes),
      keyDistribution: dist,
      chance: chanceBaseline(dist, total),
      areaResults,
      topicResults,
      topicAreas,
      perQuestion,
    };
  }

  window.Grading = {
    DataError, validateCatalog, validateExam, validateAnswerKey,
    grade, buildAnswerString, parseAnswerString, chanceBaseline,
  };
})();
