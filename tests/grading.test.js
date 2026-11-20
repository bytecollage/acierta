// Validación, cadena de respuestas y corrección (web/js/grading.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadModule, readData, plain } = require("./load");

let G;
test.before(async () => { G = await loadModule("domain/grading.js"); });
const catalog = readData("exams.json");
const entry = catalog.find((e) => e.id === "N0E01");
const data = readData("N0E01/questions.json");
const key = readData("N0E01/answers.json");

const clone = (x) => JSON.parse(JSON.stringify(x));
/** Comprueba que fn lanza DataError y que mensaje + detalle contienen `text`. */
function throwsData(fn, text) {
  assert.throws(fn, (e) => {
    assert.equal(e.name, "DataError");
    if (text) assert.match(`${e.message}\n${e.detail}`, text);
    return true;
  });
}

test("validateCatalog acepta el catálogo real", () => {
  assert.equal(G.validateCatalog(catalog).length, catalog.length);
});

test("validateCatalog rechaza catálogos inválidos", () => {
  throwsData(() => G.validateCatalog([]), /al menos un examen/);
  throwsData(() => G.validateCatalog([catalog[0], catalog[0]]), /duplicados/);
  throwsData(() => G.validateCatalog([{ ...catalog[0], id: "diagnostico-1" }]), /no es válido/);
  const { questions, ...noQuestions } = catalog[0];
  throwsData(() => G.validateCatalog([noQuestions]), /falta el campo "questions"/);
});

test("validateExam y validateAnswerKey aceptan N0E01", () => {
  const { exam, stimuli, questions } = G.validateExam(clone(data), entry);
  assert.equal(questions.length, 80);
  assert.equal(stimuli.length, 4);
  assert.equal(exam.areas.length, 5);
  assert.equal(G.validateAnswerKey(clone(key), exam, questions).size, 80);
});

test("validateExam rechaza exámenes alterados", () => {
  const otherId = clone(data); otherId.exam.id = "N0E02";
  throwsData(() => G.validateExam(otherId, entry), /no coincide con el catálogo/);

  const optionD = clone(data); optionD.questions[0].options.D = "x";
  throwsData(() => G.validateExam(optionD, entry), /exactamente A, B y C/);

  const badArea = clone(data); badArea.questions[0].area = "Química";
  throwsData(() => G.validateExam(badArea, entry), /no está declarada/);
});

test("validateAnswerKey rechaza claves alteradas", () => {
  const { exam, questions } = G.validateExam(clone(data), entry);
  const missing = clone(key); missing.answers.pop();
  throwsData(() => G.validateAnswerKey(missing, exam, questions), /Falta la clave de la pregunta 80/);

  const otherExam = clone(key); otherExam.examId = "N0E02";
  throwsData(() => G.validateAnswerKey(otherExam, exam, questions), /answers.examId/);
});

test("buildAnswerString pone código, minutos y letras en orden de id", () => {
  const qs = [{ id: 3 }, { id: 1 }, { id: 2 }];
  assert.equal(G.buildAnswerString("N1E02", qs, { 1: "A", 2: "B", 3: "C" }, 72), "N1E02|72|ABC");
  throwsData(() => G.buildAnswerString("N1E02", qs, { 1: "A", 2: "B" }, 72), /cadena de respuestas/);
});

test("parseAnswerString lee el formato actual y el anterior", () => {
  assert.deepEqual(plain(G.parseAnswerString("N1E02|72|ABC")), { code: "N1E02", minutes: 72, letters: "ABC" });
  assert.deepEqual(plain(G.parseAnswerString("72ABC")), { code: null, minutes: 72, letters: "ABC" });
  ["", "N1E02|x|ABC", "72ABD", "n1e02|72|ABC", null].forEach((s) =>
    assert.equal(G.parseAnswerString(s), null, `debería rechazar ${JSON.stringify(s)}`));
});

/** Corrige N0E01 con las respuestas que devuelva pick(pregunta). */
function gradeWith(pick, activeMs = 30 * 60000) {
  const { exam, questions } = G.validateExam(clone(data), entry);
  const keyMap = G.validateAnswerKey(clone(key), exam, questions);
  const selected = Object.fromEntries(questions.map((q) => [q.id, pick(q, keyMap)]));
  return { r: G.grade(exam, questions, selected, keyMap, { activeMs, elapsedWallMs: activeMs }, "N0E01"), questions };
}

test("grade con todas las respuestas correctas", () => {
  const { r } = gradeWith((q, k) => k.get(q.id));
  assert.equal(r.score, 80);
  assert.equal(r.percentage, 100);
  assert.equal(r.incorrectCount, 0);
  Object.values(r.areaResults).forEach((a) => assert.equal(a.correct, a.total));
  assert.match(r.answerString, /^N0E01\|30\|[ABC]{80}$/);
});

test("grade con todas «A» coincide con la línea de azar", () => {
  const { r } = gradeWith(() => "A");
  assert.equal(r.score, 39);
  assert.equal(r.percentage, 49);
  assert.deepEqual(plain(r.chance), { letter: "A", percentage: 49 });
  assert.deepEqual(plain(r.keyDistribution), { A: 39, B: 33, C: 8 });
});

test("grade redondea los minutos con mínimo 1", () => {
  assert.equal(gradeWith(() => "A", 0).r.minutes, 1);
  assert.equal(gradeWith(() => "A", 90000).r.minutes, 2);
});

test("grade agrega temas y su área", () => {
  const { r, questions } = gradeWith(() => "B");
  questions.forEach((q) => assert.equal(r.topicAreas[q.topic], q.area));
  assert.equal(Object.values(r.topicResults).reduce((s, t) => s + t.total, 0), 80);
  assert.equal(r.perQuestion.length, 80);
});
