/* ids.js — ids de examen anteriores (diagnostico-N) a los actuales (N<nivel>E<examen>).
   La misma regla está en apps-script/Code.gs (canonExamId); tests/ids.test.js comprueba que
   coinciden. Ver docs/decisiones.md D-14 */

/** Hasta el 2026-11-19 los exámenes se identificaban como diagnostico-N; ahora el id es el
 *  código N<nivel>E<examen> (diagnostico-7 → N1E02). Ver docs/decisiones.md D-14. */
function canonId(id) {
  const m = /^diagnostico-(\d+)$/.exec(String(id));
  if (!m) return id;
  const n = Number(m[1]) - 1;
  return `N${Math.floor(n / 5)}E${String((n % 5) + 1).padStart(2, "0")}`;
}
const canonTitle = (t) => String(t || "").replace(/\s*Diagn[oó]stico\b/i, "");
const canon = (r) => (r && typeof r === "object"
  ? { ...r, examId: canonId(r.examId), examTitle: canonTitle(r.examTitle) } : r);

export { canonId, canonTitle, canon };
