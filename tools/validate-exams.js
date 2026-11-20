// Valida todo el catálogo con la misma lógica que la aplicación (web/js/domain/grading.js).
const fs = require("fs"), path = require("path");
const { pathToFileURL } = require("url");
const WEB = path.join(__dirname, "..", "web");
const read = (p) => JSON.parse(fs.readFileSync(path.join(WEB, "data", p), "utf8"));

(async () => {
  const G = await import(pathToFileURL(path.join(WEB, "js/domain/grading.js")).href);
  let bad = 0;
  const cat = G.validateCatalog(read("exams.json"));
  for (const entry of cat) {
    try {
      const { exam, questions } = G.validateExam(read(entry.questions), entry);
      const key = G.validateAnswerKey(read(entry.answers), exam, questions);
      console.log(`OK  ${entry.id}  ${questions.length} preguntas, clave ${key.size}`);
    } catch (e) {
      bad++;
      console.log(`ERR ${entry.id}: ${e.message}\n${e.detail || ""}`);
    }
  }
  process.exit(bad ? 1 : 0);
})();
