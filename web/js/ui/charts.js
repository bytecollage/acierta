/* charts.js — gráficas en SVG puro, sin dependencias.
   Toda gráfica tiene una tabla equivalente al lado (docs/funcionamiento.md §5). */

const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
  return n;
}

function svgRoot(w, h) {
  const s = el("svg", { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "xMidYMid meet", role: "img" });
  s.style.height = "auto";
  return s;
}

const PALETTE = ["#1d4ed8", "#c2410c", "#047857", "#7e22ce", "#b91c1c"];

/**
 * Evolución del porcentaje por examen.
 * series: [{ label, color, points: [{x: Date, y: %, filled: bool, title}] }]
 * refLines: [{ y, label }]
 * opts: { height, yMin (piso del eje Y, 0 por defecto), labelLast (rotula el último punto) }
 * Se dibuja al ancho real del contenedor para que el texto conserve su tamaño en el celular.
 */
function lineChart(host, series, refLines, opts = {}) {
  const W = Math.round(host.getBoundingClientRect().width) || 760, H = opts.height || 260;
  const L = 40, R = 14, T = opts.labelLast ? 24 : 14, B = 30;
  const yMin = opts.yMin || 0;
  const s = svgRoot(W, H);

  const all = series.flatMap((se) => se.points);
  if (!all.length) return;
  const xs = all.map((p) => +p.x);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const spanX = maxX - minX || 1;

  const x = (d) => L + ((+d - minX) / spanX) * (W - L - R);
  const y = (v) => (H - B) - ((v - yMin) / (100 - yMin)) * (H - B - T);

  const step = 100 - yMin <= 50 ? 10 : 25;
  const ticks = [];
  for (let v = 100; v >= yMin; v -= step) ticks.push(v);
  ticks.forEach((v) => {
    s.appendChild(el("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "grid-line" }));
    const t = el("text", { x: L - 8, y: y(v) + 4, class: "axis-text", "text-anchor": "end" });
    t.textContent = `${v}%`;
    s.appendChild(t);
  });

  (refLines || []).filter((r) => r.y >= yMin).forEach((r) => {
    s.appendChild(el("line", { x1: L, x2: W - R, y1: y(r.y), y2: y(r.y), class: "ref-line" }));
    const t = el("text", { x: W - R, y: y(r.y) - 6, class: "axis-text", "text-anchor": "end" });
    t.textContent = r.label;
    s.appendChild(t);
  });

  // eje X: primera y última fecha
  [[minX, "start"], [maxX, "end"]].forEach(([v, anchor]) => {
    const t = el("text", { x: x(new Date(v)), y: H - 8, class: "axis-text", "text-anchor": anchor });
    t.textContent = new Date(v).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    s.appendChild(t);
  });

  series.forEach((se, i) => {
    const color = se.color || PALETTE[i % PALETTE.length];
    const pts = [...se.points].sort((a, b) => a.x - b.x);
    if (pts.length > 1) {
      s.appendChild(el("path", {
        d: "M" + pts.map((p) => `${x(p.x)},${y(p.y)}`).join(" L"),
        fill: "none", stroke: color, "stroke-width": 2,
        "stroke-linejoin": "round", "stroke-linecap": "round",
      }));
    }
    pts.forEach((p) => {
      const c = el("circle", {
        cx: x(p.x), cy: y(p.y), r: 5,
        fill: p.filled ? color : "#fff",
        stroke: color, "stroke-width": 2,
      });
      const title = el("title");
      title.textContent = p.title || `${p.y}%`;
      c.appendChild(title);
      s.appendChild(c);
    });
    if (opts.labelLast && pts.length) {
      // Arriba del punto, salvo que la línea llegue bajando: entonces debajo, para no taparla.
      const p = pts[pts.length - 1], prev = pts[pts.length - 2];
      const below = prev && prev.y > p.y;
      const t = el("text", { x: x(p.x), y: y(p.y) + (below ? 22 : -11), class: "point-label", "text-anchor": "end" });
      t.textContent = `${p.y}%`;
      s.appendChild(t);
    }
  });

  host.appendChild(s);
}

/** Tabla equivalente a una gráfica, dentro de un <details>. */
function dataTable(host, headers, rows, summaryLabel) {
  const d = document.createElement("details");
  d.innerHTML =
    `<summary>${summaryLabel || "Ver datos"}</summary>
     <div class="tbl-scroll"><table>
       <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
       <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
     </table></div>`;
  host.appendChild(d);
}

export { lineChart, dataTable, PALETTE };
