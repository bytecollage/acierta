// Valida todo el catálogo con la misma lógica que la aplicación (web/js/grading.js).
const fs = require("fs"), path = require("path"), vm = require("vm");
const WEB = path.join(__dirname, "..", "..", "web");
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(WEB, "js/grading.js"), "utf8"), ctx);
const G = ctx.window.Grading;
const read = (p) => JSON.parse(fs.readFileSync(path.join(WEB, "data", p), "utf8"));
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
