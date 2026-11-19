/* dashboard.js — evolución del estudiante y temas a reforzar.
   Se dibuja en la pestaña «Mi progreso» de panel.html con el historial que le pasa app.js. Ver spec/07-dashboard.md */

(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const MIN_OBS_RECOMMEND = 3;   // observaciones mínimas para recomendar un tema
  const WEAK_THRESHOLD = 60;     // % por debajo del cual un tema se considera débil
  const SPLIT_FACTOR = 3;        // elapsedWall > 3 × active ⇒ intento partido

  let history = [];
  const filters = { area: "*", exam: "*", includeRepeats: false };

  /* ------------------------------------------------------------ utilidades */

  const pct = (c, t) => (t ? Math.round((c / t) * 100) : 0);
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("es-MX",
    { day: "numeric", month: "short", year: "numeric" });

  function isSplit(row) {
    return row.elapsedWallMs && row.activeMs && row.elapsedWallMs > SPLIT_FACTOR * row.activeMs;
  }

  /** Porcentaje que obtendría quien marcase siempre la misma letra. */
  function chanceOf(row) {
    const d = row.keyDistribution;
    if (!d) return null;
    const best = Math.max(d.A || 0, d.B || 0, d.C || 0);
    const letter = ["A", "B", "C"].find((k) => (d[k] || 0) === best);
    return { letter, percentage: pct(best, row.total) };
  }

  /* ---------------------------------------------------------------- render */

  let wired = false;

  /** Pinta el dashboard con el historial dado. Lo llama app.js al abrir la pestaña
   *  «Mi progreso» y cada vez que cambia el historial (sesión nueva, intento nuevo). */
  function show(rows) {
    history = rows.slice();
    paintStorageMode();

    if (!history.length) {
      $("#empty").classList.remove("hidden");
      $("#content").classList.add("hidden");
      $("#empty-note").textContent = window.Storage.getMode() === "guest"
        ? "Si ya hiciste exámenes, inicia sesión para ver tu historial." : "";
      return;
    }
    $("#empty").classList.add("hidden");
    $("#content").classList.remove("hidden");

    // Un filtro que apunta a un examen que ya no está en el historial se reinicia.
    if (filters.exam !== "*" && !history.some((h) => h.examId === filters.exam)) filters.exam = "*";
    buildFilters();
    $("#f-exam").value = filters.exam;
    $("#f-area").value = filters.area;
    if ($("#f-area").value !== filters.area) { filters.area = "*"; $("#f-area").value = "*"; }
    $("#f-repeats").checked = filters.includeRepeats;
    render();

    if (!wired) {
      wired = true;
      $("#f-area").onchange = (e) => { filters.area = e.target.value; render(); };
      $("#f-exam").onchange = (e) => { filters.exam = e.target.value; render(); };
      $("#f-repeats").onchange = (e) => { filters.includeRepeats = e.target.checked; render(); };
    }
  }

  function paintStorageMode() {
    const modo = $("#storage-mode");
    if (!modo) return;
    const mode = window.Storage.getMode();
    const pending = window.Storage.pendingCount();
    modo.textContent =
      mode === "local" ? "Historial guardado en este navegador." :
      mode === "guest" ? "Sin sesión: solo ves los intentos guardados en este navegador. Inicia sesión para ver tu historial completo." :
      pending ? `Historial de tu cuenta. ${pending} intento(s) pendiente(s) de subir desde este navegador.` :
      "Historial guardado en tu cuenta.";
  }

  function buildFilters() {
    const exams = [...new Map(history.map((h) => [h.examId, h.examTitle])).entries()];
    $("#f-exam").innerHTML = `<option value="*">Todos los exámenes</option>` +
      exams.map(([id, t]) => `<option value="${esc(id)}">${esc(t)}</option>`).join("");

    const areas = new Set();
    history.forEach((h) => Object.keys(h.areaResults || {}).forEach((a) => areas.add(a)));
    $("#f-area").innerHTML = `<option value="*">Todas las áreas</option>` +
      [...areas].map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join("");
  }

  function selected() {
    return history.filter((h) => filters.exam === "*" || h.examId === filters.exam);
  }

  function render() {
    const rows = selected();
    renderKpis(rows);
    renderEvolution(rows);
    renderAreas(rows);
    renderTopics(rows);
  }

  /* ------------------------------------------------------------------ kpis */

  function renderKpis(rows) {
    const best = rows.reduce((a, b) => (b.percentage > (a ? a.percentage : -1) ? b : a), null);
    const byExam = new Map();
    rows.forEach((r) => {
      if (!byExam.has(r.examId)) byExam.set(r.examId, []);
      byExam.get(r.examId).push(r);
    });

    const last = rows[rows.length - 1];
    const sameExam = rows.filter((r) => r.examId === last.examId);
    const prev = sameExam.length > 1 ? sameExam[sameExam.length - 2] : null;
    const delta = prev ? last.percentage - prev.percentage : null;

    const comparable = rows.filter((r) => !isSplit(r) && r.minutes);
    const avgMin = comparable.length
      ? Math.round(comparable.reduce((a, r) => a + r.minutes, 0) / comparable.length) : null;
    const excluded = rows.length - comparable.length;

    const desglose = [...byExam.entries()]
      .map(([, rs]) => `${rs[0].examTitle.replace(/^Diagnóstico.*—\s*/, "")}: ${rs.length}`)
      .join(" · ");

    $("#kpis").innerHTML = `
      <div class="kpi">
        <div class="l">Exámenes completados</div>
        <div class="v">${rows.length}</div>
        <div class="s">${esc(desglose)}</div>
      </div>
      <div class="kpi">
        <div class="l">Mejor resultado</div>
        <div class="v">${best.percentage}%</div>
        <div class="s">${esc(best.examTitle)} · ${fmtDate(best.completedAt)}</div>
      </div>
      <div class="kpi">
        <div class="l">Último resultado</div>
        <div class="v">${last.percentage}%</div>
        <div class="s">${delta === null ? "Primer intento de este examen"
          : `${delta >= 0 ? "+" : ""}${delta} pts respecto al anterior`}</div>
      </div>
      <div class="kpi">
        <div class="l">Tiempo medio</div>
        <div class="v">${avgMin === null ? "—" : `${avgMin} min`}</div>
        <div class="s">${excluded ? `${excluded} intento(s) partido(s) excluido(s)` : "De intentos comparables"}</div>
      </div>`;
  }

  /* ------------------------------------------------------------- evolución */

  function renderEvolution(rows) {
    const host = $("#chart-evolution");
    host.innerHTML = "";

    if (rows.length < 2) {
      host.innerHTML = `<p class="alert info">Haz al menos dos exámenes para ver tu evolución.</p>`;
      $("#evolution-legend").innerHTML = "";
      return;
    }

    const byExam = new Map();
    rows.forEach((r) => {
      if (!byExam.has(r.examId)) byExam.set(r.examId, []);
      byExam.get(r.examId).push(r);
    });

    const series = [];
    const refs = [];
    let i = 0;
    byExam.forEach((rs, examId) => {
      const color = window.Charts.PALETTE[i % window.Charts.PALETTE.length];
      series.push({
        label: rs[0].examTitle,
        color,
        points: rs.map((r) => ({
          x: new Date(r.completedAt),
          y: r.percentage,
          filled: r.isFirstAttempt !== false,
          title: `${r.examTitle}\n${fmtDate(r.completedAt)}\n${r.score}/${r.total} (${r.percentage}%)` +
                 `\n${r.minutes} min` + (r.isFirstAttempt === false ? "\n(repetición)" : ""),
        })),
      });
      const ch = chanceOf(rs[0]);
      if (ch && !refs.some((x) => x.y === ch.percentage)) {
        refs.push({ y: ch.percentage, label: `${ch.percentage}% · responder siempre la misma letra` });
      }
      i += 1;
    });

    $("#evolution-legend").innerHTML =
      series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join("") +
      `<span><i style="background:#fff;border:2px solid #6b7280"></i>punto hueco = repetición</span>`;

    window.Charts.lineChart(host, series, refs);
    window.Charts.dataTable(
      host,
      ["Fecha", "Examen", "Resultado", "%", "Tiempo", "Intento"],
      rows.map((r) => [
        fmtDate(r.completedAt), esc(r.examTitle), `${r.score}/${r.total}`,
        `${r.percentage}%`, `${r.minutes} min`,
        r.isFirstAttempt === false ? `#${r.attemptNumber} (repetición)` : `#${r.attemptNumber}`,
      ]),
      "Ver datos de la gráfica"
    );
  }

  /* ------------------------------------------------------------------ áreas */

  function renderAreas(rows) {
    const host = $("#chart-areas");
    host.innerHTML = "";

    const acc = {};
    rows.forEach((r) => {
      Object.entries(r.areaResults || {}).forEach(([a, v]) => {
        if (filters.area !== "*" && a !== filters.area) return;
        if (!acc[a]) acc[a] = { correct: 0, total: 0 };
        acc[a].correct += v.correct;
        acc[a].total += v.total;
      });
    });

    const data = Object.entries(acc)
      .map(([label, v]) => ({ label, value: pct(v.correct, v.total), detail: `${v.correct}/${v.total}` }))
      .sort((a, b) => a.value - b.value);

    if (!data.length) { host.innerHTML = `<p class="muted small">Sin datos para este filtro.</p>`; return; }

    window.Charts.barsH(host, data);
    window.Charts.dataTable(host, ["Área", "Aciertos", "%"],
      data.map((d) => [esc(d.label), d.detail, `${d.value}%`]), "Ver datos de la gráfica");
  }

  /* ------------------------------------------------------------------ temas */

  function renderTopics(rows) {
    const usable = filters.includeRepeats ? rows : rows.filter((r) => r.isFirstAttempt !== false);
    $("#repeat-warning").classList.toggle("hidden", !filters.includeRepeats);

    if (!usable.length) {
      $("#topics-body").innerHTML = "";
      $("#topics-low").innerHTML = "";
      $("#recommend").innerHTML =
        `<p class="alert info">No hay intentos que cumplan el filtro actual.</p>`;
      return;
    }

    // Agregación cruzando exámenes: es lo único que da muestra suficiente.
    const acc = {};
    usable.forEach((r) => {
      Object.entries(r.topicResults || {}).forEach(([t, v]) => {
        const area = (r.topicAreas && r.topicAreas[t]) || "—";
        if (filters.area !== "*" && area !== filters.area) return;
        if (!acc[t]) acc[t] = { correct: 0, total: 0, area, halves: [] };
        acc[t].correct += v.correct;
        acc[t].total += v.total;
        acc[t].halves.push({ at: r.completedAt, c: v.correct, t: v.total });
      });
    });

    const all = Object.entries(acc).map(([topic, v]) => {
      const confidence = v.total >= 6 ? "high" : v.total >= MIN_OBS_RECOMMEND ? "mid" : "low";
      return { topic, area: v.area, ...v, pct: pct(v.correct, v.total), confidence, trend: trendOf(v) };
    });

    const reliable = all.filter((t) => t.confidence !== "low")
      .sort((a, b) => (a.pct - b.pct) || (b.total - a.total) || a.topic.localeCompare(b.topic));
    const low = all.filter((t) => t.confidence === "low")
      .sort((a, b) => (a.pct - b.pct) || a.topic.localeCompare(b.topic));

    const chip = { high: '<span class="chip high">Alta</span>',
                   mid: '<span class="chip mid">Media</span>',
                   low: '<span class="chip low">Baja</span>' };

    $("#topics-body").innerHTML = reliable.length ? reliable.map((t) => `
      <tr>
        <td>${esc(t.topic)}</td>
        <td style="text-align:left">${esc(t.area)}</td>
        <td>${t.correct} / ${t.total}</td>
        <td>${t.pct}%</td>
        <td class="opt-col">${t.total}</td>
        <td class="opt-col">${t.trend}</td>
        <td>${chip[t.confidence]}</td>
      </tr>`).join("")
      : `<tr><td colspan="7" class="muted">Ningún tema alcanza aún ${MIN_OBS_RECOMMEND} observaciones.</td></tr>`;

    $("#topics-low").innerHTML = low.map((t) => `
      <tr>
        <td>${esc(t.topic)}</td>
        <td style="text-align:left">${esc(t.area)}</td>
        <td>${t.correct} / ${t.total}</td>
        <td>${t.pct}%</td>
      </tr>`).join("");
    $("#topics-low-count").textContent = low.length;

    const weak = reliable.filter((t) => t.pct < WEAK_THRESHOLD);
    $("#recommend").innerHTML = weak.length
      ? `<div class="alert warn"><strong>Recomendado estudiar</strong>
           <p class="small">Temas con al menos ${MIN_OBS_RECOMMEND} preguntas vistas y menos del
              ${WEAK_THRESHOLD}% de acierto.</p>
           <ul>${weak.map((t) =>
             `<li><strong>${esc(t.topic)}</strong> — ${t.correct}/${t.total} (${t.pct}%) · ${esc(t.area)}</li>`
           ).join("")}</ul></div>`
      : `<div class="alert info">Aún no hay suficientes datos para recomendar temas concretos.
           Repite los exámenes o añade exámenes nuevos.</div>`;
  }

  /** Flecha de tendencia comparando la primera mitad de observaciones con la segunda. */
  function trendOf(v) {
    if (v.total < 6 || v.halves.length < 2) return "—";
    const ordered = [...v.halves].sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const mid = Math.floor(ordered.length / 2);
    const sum = (arr) => arr.reduce((a, x) => ({ c: a.c + x.c, t: a.t + x.t }), { c: 0, t: 0 });
    const a = sum(ordered.slice(0, mid));
    const b = sum(ordered.slice(mid));
    if (!a.t || !b.t) return "—";
    const d = pct(b.c, b.t) - pct(a.c, a.t);
    if (d >= 10) return '<span title="mejorando">↑</span>';
    if (d <= -10) return '<span title="empeorando">↓</span>';
    return '<span title="estable">→</span>';
  }

  window.Dashboard = { show };
})();
