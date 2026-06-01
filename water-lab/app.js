const templates = {
  cod: {
    reportTitle: "COD ????????",
    unit: "mg/L",
    responseName: "???",
    r2Target: 0.995,
    standards: [
      ["??", 0, 0.002],
      ["S1", 20, 0.041],
      ["S2", 40, 0.081],
      ["S3", 80, 0.161],
      ["S4", 120, 0.241],
      ["S5", 160, 0.321],
    ],
    samples: [
      ["??-1", "0.188, 0.191, 0.190", 1],
      ["??-1", "0.071, 0.073, 0.072", 1],
    ],
  },
  nh3n: {
    reportTitle: "??????????",
    unit: "mg/L",
    responseName: "???",
    r2Target: 0.995,
    standards: [
      ["??", 0, 0.004],
      ["S1", 0.1, 0.035],
      ["S2", 0.3, 0.095],
      ["S3", 0.5, 0.156],
      ["S4", 0.8, 0.248],
      ["S5", 1.0, 0.309],
    ],
    samples: [
      ["??-A", "0.122, 0.126, 0.124", 1],
      ["??-B", "0.058, 0.060, 0.059", 1],
    ],
  },
  tp: {
    reportTitle: "??????????",
    unit: "mg/L",
    responseName: "???",
    r2Target: 0.995,
    standards: [
      ["??", 0, 0.003],
      ["S1", 0.02, 0.026],
      ["S2", 0.05, 0.061],
      ["S3", 0.1, 0.119],
      ["S4", 0.2, 0.235],
      ["S5", 0.4, 0.468],
    ],
    samples: [
      ["??-1", "0.082, 0.084, 0.083", 1],
      ["??-1", "0.221, 0.225, 0.223", 2],
    ],
  },
};

const defaultNoiseRows = [
  ["???", "??", "58.4, 59.1, 57.8, 58.9, 59.4"],
  ["???", "??", "61.0, 60.4, 60.8, 61.3, 60.7"],
  ["???", "??", "49.1, 48.7, 50.0, 49.4, 48.9"],
];

const els = {
  analyte: document.querySelector("#analyte"),
  reportTitle: document.querySelector("#reportTitle"),
  unit: document.querySelector("#unit"),
  responseName: document.querySelector("#responseName"),
  r2Target: document.querySelector("#r2Target"),
  standardRows: document.querySelector("#standardRows"),
  sampleRows: document.querySelector("#sampleRows"),
  noiseRows: document.querySelector("#noiseRows"),
  waterResultRows: document.querySelector("#waterResultRows"),
  noiseResultRows: document.querySelector("#noiseResultRows"),
  waterMetrics: document.querySelector("#waterMetrics"),
  noiseMetrics: document.querySelector("#noiseMetrics"),
  curveEquation: document.querySelector("#curveEquation"),
  curveCanvas: document.querySelector("#curveCanvas"),
  noiseCanvas: document.querySelector("#noiseCanvas"),
  conclusionText: document.querySelector("#conclusionText"),
  statusText: document.querySelector("#statusText"),
};

let lastWater = null;
let lastNoise = null;

function parseNumbers(value) {
  return String(value || "")
    .split(/[\s,?;??]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function average(values) {
  if (!values.length) return NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function regression(points) {
  const valid = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const n = valid.length;
  if (n < 2) throw new Error("???????? 2 ?????");

  const sumX = valid.reduce((sum, point) => sum + point.x, 0);
  const sumY = valid.reduce((sum, point) => sum + point.y, 0);
  const sumXY = valid.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumX2 = valid.reduce((sum, point) => sum + point.x * point.x, 0);
  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-12) throw new Error("???????????");

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  if (Math.abs(slope) < 1e-12) throw new Error("???????? 0????????");

  const meanY = sumY / n;
  const ssTotal = valid.reduce((sum, point) => sum + Math.pow(point.y - meanY, 2), 0);
  const ssResidual = valid.reduce((sum, point) => {
    const fitted = slope * point.x + intercept;
    return sum + Math.pow(point.y - fitted, 2);
  }, 0);
  const r2 = ssTotal < 1e-12 ? 1 : 1 - ssResidual / ssTotal;
  return { n, points: valid, slope, intercept, r2 };
}

function leq(values) {
  if (!values.length) return NaN;
  const energy = values.reduce((sum, value) => sum + Math.pow(10, value / 10), 0) / values.length;
  return 10 * Math.log10(energy);
}

function fmt(value, digits = 3) {
  if (!Number.isFinite(value)) return "-";
  const fixed = value.toFixed(digits);
  return fixed.replace(/\.?0+$/, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function setStatus(text) {
  els.statusText.textContent = text;
}

function activePanelName() {
  return document.querySelector(".tab.is-active")?.dataset.tab || "water";
}

function makeRow(cells, className) {
  const row = document.createElement("tr");
  row.className = className;
  row.innerHTML = cells.join("");
  return row;
}

function standardRow(name = "", concentration = "", response = "") {
  return makeRow([
    `<td><input data-field="name" type="text" value="${escapeHtml(name)}" /></td>`,
    `<td><input data-field="x" type="number" step="any" value="${escapeHtml(concentration)}" /></td>`,
    `<td><input data-field="y" type="number" step="any" value="${escapeHtml(response)}" /></td>`,
    `<td><button class="row-delete" type="button" aria-label="????">x</button></td>`,
  ], "standard-row");
}

function sampleRow(name = "", readings = "", dilution = 1) {
  return makeRow([
    `<td><input data-field="name" type="text" value="${escapeHtml(name)}" /></td>`,
    `<td><input data-field="readings" type="text" value="${escapeHtml(readings)}" /></td>`,
    `<td><input data-field="dilution" type="number" min="0" step="any" value="${escapeHtml(dilution)}" /></td>`,
    `<td><button class="row-delete" type="button" aria-label="????">x</button></td>`,
  ], "sample-row");
}

function noiseRow(point = "", period = "", readings = "") {
  return makeRow([
    `<td><input data-field="point" type="text" value="${escapeHtml(point)}" /></td>`,
    `<td><input data-field="period" type="text" value="${escapeHtml(period)}" /></td>`,
    `<td><input data-field="readings" type="text" value="${escapeHtml(readings)}" /></td>`,
    `<td><button class="row-delete" type="button" aria-label="????">x</button></td>`,
  ], "noise-row");
}

function loadTemplate(key = els.analyte.value) {
  const data = templates[key];
  els.reportTitle.value = data.reportTitle;
  els.unit.value = data.unit;
  els.responseName.value = data.responseName;
  els.r2Target.value = data.r2Target;
  els.standardRows.replaceChildren(...data.standards.map((row) => standardRow(...row)));
  els.sampleRows.replaceChildren(...data.samples.map((row) => sampleRow(...row)));
  els.noiseRows.replaceChildren(...defaultNoiseRows.map((row) => noiseRow(...row)));
  calculateAll();
  setStatus("???????");
}

function collectStandards() {
  return [...els.standardRows.querySelectorAll("tr")].map((row, index) => {
    const name = row.querySelector('[data-field="name"]').value.trim() || `S${index + 1}`;
    const x = Number(row.querySelector('[data-field="x"]').value);
    const y = Number(row.querySelector('[data-field="y"]').value);
    return { name, x, y };
  }).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function collectSamples() {
  return [...els.sampleRows.querySelectorAll("tr")].map((row, index) => {
    const name = row.querySelector('[data-field="name"]').value.trim() || `??${index + 1}`;
    const readings = parseNumbers(row.querySelector('[data-field="readings"]').value);
    const dilution = Number(row.querySelector('[data-field="dilution"]').value) || 1;
    return { name, readings, dilution };
  }).filter((sample) => sample.readings.length);
}

function collectNoiseRows() {
  return [...els.noiseRows.querySelectorAll("tr")].map((row, index) => {
    const point = row.querySelector('[data-field="point"]').value.trim() || `??${index + 1}`;
    const period = row.querySelector('[data-field="period"]').value.trim() || "???";
    const readings = parseNumbers(row.querySelector('[data-field="readings"]').value);
    return { point, period, readings };
  }).filter((item) => item.readings.length);
}

function calculateWater() {
  const standards = collectStandards();
  const fit = regression(standards);
  const target = Number(els.r2Target.value) || 0.995;
  const minX = Math.min(...standards.map((point) => point.x));
  const maxX = Math.max(...standards.map((point) => point.x));
  const unit = els.unit.value.trim() || "mg/L";
  const responseName = els.responseName.value.trim() || "???";

  const samples = collectSamples().map((sample) => {
    const avgResponse = average(sample.readings);
    const curveConcentration = (avgResponse - fit.intercept) / fit.slope;
    const concentration = curveConcentration * sample.dilution;
    const inRange = curveConcentration >= minX && curveConcentration <= maxX;
    return { ...sample, avgResponse, curveConcentration, concentration, inRange };
  });

  lastWater = { standards, fit, samples, target, minX, maxX, unit, responseName };
  renderWater(lastWater);
  return lastWater;
}

function calculateNoise() {
  const rows = collectNoiseRows().map((item) => {
    const avg = average(item.readings);
    const equivalent = leq(item.readings);
    return { ...item, avg, equivalent };
  });
  lastNoise = { rows };
  renderNoise(lastNoise);
  return lastNoise;
}

function metric(label, value) {
  const node = document.createElement("div");
  node.className = "metric";
  node.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
  return node;
}

function renderWater(result) {
  const { fit, samples, target, unit, responseName } = result;
  const equation = `${responseName} = ${fmt(fit.slope, 6)} x C + ${fmt(fit.intercept, 6)}`;
  els.curveEquation.textContent = `${equation}?R? = ${fmt(fit.r2, 5)}`;

  els.waterMetrics.replaceChildren(
    metric("??", fmt(fit.slope, 6)),
    metric("??", fmt(fit.intercept, 6)),
    metric("R?", fmt(fit.r2, 5)),
    metric("???", String(fit.n)),
  );

  els.waterResultRows.replaceChildren(...samples.map((sample) => {
    const judgement = sample.inRange ? "?????" : "??????";
    const row = document.createElement("tr");
    row.innerHTML = [
      `<td>${escapeHtml(sample.name)}</td>`,
      `<td>${fmt(sample.avgResponse, 4)}</td>`,
      `<td>${fmt(sample.concentration, 3)} ${escapeHtml(unit)}</td>`,
      `<td>${judgement}</td>`,
    ].join("");
    return row;
  }));

  drawCurve(result);
  updateConclusion();
  setStatus(fit.r2 >= target ? "?????????????" : "???????R? ????");
}

function renderNoise(result) {
  const rows = result.rows;
  const maxLeq = rows.length ? Math.max(...rows.map((row) => row.equivalent)) : NaN;
  const minLeq = rows.length ? Math.min(...rows.map((row) => row.equivalent)) : NaN;
  els.noiseMetrics.replaceChildren(
    metric("???", String(rows.length)),
    metric("?? Leq", Number.isFinite(maxLeq) ? `${fmt(maxLeq, 1)} dB(A)` : "-"),
    metric("?? Leq", Number.isFinite(minLeq) ? `${fmt(minLeq, 1)} dB(A)` : "-"),
    metric("??", "????"),
  );

  els.noiseResultRows.replaceChildren(...rows.map((item) => {
    const row = document.createElement("tr");
    const diff = item.equivalent - item.avg;
    row.innerHTML = [
      `<td>${escapeHtml(item.point)} / ${escapeHtml(item.period)}</td>`,
      `<td>${fmt(item.avg, 1)} dB(A)</td>`,
      `<td>${fmt(item.equivalent, 1)} dB(A)</td>`,
      `<td>${diff >= .3 ? "?????" : "????"}</td>`,
    ].join("");
    return row;
  }));

  drawNoise(result);
  updateConclusion();
  setStatus("?? Leq ????");
}

function drawCurve(result) {
  const canvas = els.curveCanvas;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(760, Math.floor(rect.width * dpr));
  canvas.height = Math.floor(430 * dpr);
  ctx.scale(dpr, dpr);

  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  ctx.clearRect(0, 0, width, height);
  paintBackground(ctx, width, height);

  const pad = { left: 62, right: 28, top: 28, bottom: 54 };
  const allX = result.standards.map((point) => point.x).concat(result.samples.map((sample) => sample.curveConcentration));
  const allY = result.standards.map((point) => point.y).concat(result.samples.map((sample) => sample.avgResponse));
  const xMin = Math.min(0, ...allX);
  const xMax = Math.max(...allX) * 1.08 || 1;
  const yMin = Math.min(0, ...allY);
  const yMax = Math.max(...allY) * 1.12 || 1;
  const xScale = (x) => pad.left + ((x - xMin) / (xMax - xMin || 1)) * (width - pad.left - pad.right);
  const yScale = (y) => height - pad.bottom - ((y - yMin) / (yMax - yMin || 1)) * (height - pad.top - pad.bottom);

  drawGrid(ctx, width, height, pad);
  drawAxisLabels(ctx, width, height, "??", result.responseName);

  ctx.strokeStyle = "#d94379";
  ctx.lineWidth = 3;
  ctx.beginPath();
  const lineStart = { x: xMin, y: result.fit.slope * xMin + result.fit.intercept };
  const lineEnd = { x: xMax, y: result.fit.slope * xMax + result.fit.intercept };
  ctx.moveTo(xScale(lineStart.x), yScale(lineStart.y));
  ctx.lineTo(xScale(lineEnd.x), yScale(lineEnd.y));
  ctx.stroke();

  result.standards.forEach((point) => {
    drawPoint(ctx, xScale(point.x), yScale(point.y), "#1bb7ca", 6);
  });
  result.samples.forEach((sample) => {
    drawPoint(ctx, xScale(sample.curveConcentration), yScale(sample.avgResponse), "#f1b640", 7);
  });
}

function drawNoise(result) {
  const canvas = els.noiseCanvas;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(760, Math.floor(rect.width * dpr));
  canvas.height = Math.floor(430 * dpr);
  ctx.scale(dpr, dpr);

  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  ctx.clearRect(0, 0, width, height);
  paintBackground(ctx, width, height);

  const pad = { left: 62, right: 28, top: 28, bottom: 72 };
  drawGrid(ctx, width, height, pad);
  drawAxisLabels(ctx, width, height, "??", "dB(A)");

  const rows = result.rows;
  if (!rows.length) return;
  const max = Math.max(...rows.map((row) => row.equivalent), 70);
  const min = Math.min(...rows.map((row) => row.equivalent), 35);
  const span = max - min || 1;
  const chartW = width - pad.left - pad.right;
  const barW = Math.max(24, chartW / rows.length * .46);

  rows.forEach((row, index) => {
    const x = pad.left + chartW * (index + .5) / rows.length;
    const y = pad.top + (1 - (row.equivalent - min) / span) * (height - pad.top - pad.bottom);
    const h = height - pad.bottom - y;
    const grad = ctx.createLinearGradient(0, y, 0, height - pad.bottom);
    grad.addColorStop(0, "#ff6f9f");
    grad.addColorStop(1, "#1bb7ca");
    ctx.fillStyle = grad;
    roundRect(ctx, x - barW / 2, y, barW, h, 8);
    ctx.fill();
    ctx.fillStyle = "#171a22";
    ctx.font = "700 12px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(fmt(row.equivalent, 1), x, y - 8);
    ctx.fillStyle = "#53606b";
    ctx.save();
    ctx.translate(x, height - pad.bottom + 18);
    ctx.rotate(-Math.PI / 7);
    ctx.fillText(row.point.slice(0, 8), 0, 0);
    ctx.restore();
  });
}

function paintBackground(ctx, width, height) {
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(27, 183, 202, .08)";
  ctx.fillRect(0, 0, width, height);
}

function drawGrid(ctx, width, height, pad) {
  ctx.strokeStyle = "#e7edf1";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const x = pad.left + (width - pad.left - pad.right) * i / 5;
    const y = pad.top + (height - pad.top - pad.bottom) * i / 5;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, height - pad.bottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#171a22";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, height - pad.bottom);
  ctx.lineTo(width - pad.right, height - pad.bottom);
  ctx.stroke();
}

function drawAxisLabels(ctx, width, height, xLabel, yLabel) {
  ctx.fillStyle = "#53606b";
  ctx.font = "700 12px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(xLabel, width / 2, height - 16);
  ctx.save();
  ctx.translate(18, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function drawPoint(ctx, x, y, color, radius) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function updateConclusion() {
  const lines = [];
  if (lastWater) {
    const { fit, samples, target, unit, responseName } = lastWater;
    const analyteLabel = els.analyte.options[els.analyte.selectedIndex].textContent;
    const linearText = fit.r2 >= target ? "??????????" : "????????????????????????????";
    lines.push(`${els.reportTitle.value || analyteLabel}??? ${analyteLabel} ?????? ${fit.n} ???????${responseName} = ${fmt(fit.slope, 6)} x C + ${fmt(fit.intercept, 6)}?R? = ${fmt(fit.r2, 5)}?${linearText}?`);
    if (samples.length) {
      const sampleText = samples.map((sample) => `${sample.name} ${fmt(sample.concentration, 3)} ${unit}`).join("?");
      const rangeWarn = samples.some((sample) => !sample.inRange) ? "??????????????????????????????????" : "????????????????";
      lines.push(`?????${sampleText}?${rangeWarn}`);
    }
  }

  if (lastNoise) {
    const rows = lastNoise.rows;
    if (rows.length) {
      const top = rows.reduce((best, item) => item.equivalent > best.equivalent ? item : best, rows[0]);
      const text = rows.map((row) => `${row.point}${row.period ? `(${row.period})` : ""} Leq ${fmt(row.equivalent, 1)} dB(A)`).join("?");
      lines.push(`?????${text}?????? ${top.point}?Leq = ${fmt(top.equivalent, 1)} dB(A)?`);
    }
  }

  els.conclusionText.value = lines.join("\n\n");
}

function calculateAll() {
  try {
    calculateWater();
    calculateNoise();
  } catch (error) {
    setStatus(error.message);
  }
}

function ensureLatest() {
  calculateAll();
  return { water: lastWater, noise: lastNoise };
}

function exportCsv() {
  const { water, noise } = ensureLatest();
  const rows = [];
  rows.push(["????", els.reportTitle.value]);
  rows.push([]);
  if (water) {
    rows.push(["??????"]);
    rows.push(["??", "??", water.responseName]);
    water.standards.forEach((point) => rows.push([point.name, point.x, point.y]));
    rows.push(["??", `${water.responseName} = ${fmt(water.fit.slope, 6)} x C + ${fmt(water.fit.intercept, 6)}`, "R2", fmt(water.fit.r2, 5)]);
    rows.push([]);
    rows.push(["??????"]);
    rows.push(["??", "????", "????", "????", "????", "??", "??"]);
    water.samples.forEach((sample) => rows.push([
      sample.name,
      fmt(sample.avgResponse, 4),
      fmt(sample.curveConcentration, 4),
      sample.dilution,
      fmt(sample.concentration, 3),
      water.unit,
      sample.inRange ? "?????" : "??????",
    ]));
    rows.push([]);
  }
  if (noise) {
    rows.push(["?? Leq ??"]);
    rows.push(["??", "??/??", "???? dB(A)", "Leq dB(A)", "????"]);
    noise.rows.forEach((item) => rows.push([
      item.point,
      item.period,
      fmt(item.avg, 1),
      fmt(item.equivalent, 1),
      item.readings.join(" "),
    ]));
    rows.push([]);
  }
  rows.push(["??"]);
  rows.push([els.conclusionText.value]);

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  download(`lab-results-${dateStamp()}.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
  setStatus("CSV ???");
}

function exportMarkdown() {
  const { water, noise } = ensureLatest();
  const parts = [`# ${els.reportTitle.value || "????????"}`];
  if (water) {
    parts.push(
      "",
      "## ??????",
      "",
      `- ???${water.responseName} = ${fmt(water.fit.slope, 6)} x C + ${fmt(water.fit.intercept, 6)}`,
      `- R??${fmt(water.fit.r2, 5)}`,
      "",
      "| ?? | ?? | ??? |",
      "| --- | ---: | ---: |",
      ...water.standards.map((point) => `| ${point.name} | ${fmt(point.x, 4)} | ${fmt(point.y, 4)} |`),
      "",
      "## ??????",
      "",
      "| ?? | ???? | ???? | ?? |",
      "| --- | ---: | ---: | --- |",
      ...water.samples.map((sample) => `| ${sample.name} | ${fmt(sample.avgResponse, 4)} | ${fmt(sample.concentration, 3)} ${water.unit} | ${sample.inRange ? "?????" : "??????"} |`),
    );
  }
  if (noise) {
    parts.push(
      "",
      "## ?? Leq ??",
      "",
      "| ?? | ??/?? | ???? | Leq |",
      "| --- | --- | ---: | ---: |",
      ...noise.rows.map((item) => `| ${item.point} | ${item.period} | ${fmt(item.avg, 1)} dB(A) | ${fmt(item.equivalent, 1)} dB(A) |`),
    );
  }
  parts.push("", "## ??", "", els.conclusionText.value);
  download(`lab-results-${dateStamp()}.md`, parts.join("\n"), "text/markdown;charset=utf-8");
  setStatus("Markdown ???");
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function dateStamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${y}${m}${d}-${h}${min}`;
}

async function copyConclusion() {
  ensureLatest();
  try {
    await navigator.clipboard.writeText(els.conclusionText.value);
    setStatus("?????");
  } catch {
    els.conclusionText.select();
    document.execCommand("copy");
    setStatus("?????");
  }
}

function clearActive() {
  if (activePanelName() === "water") {
    els.standardRows.replaceChildren();
    els.sampleRows.replaceChildren();
    lastWater = null;
    els.waterResultRows.replaceChildren();
    els.waterMetrics.replaceChildren();
    els.curveEquation.textContent = "????";
    els.curveCanvas.getContext("2d").clearRect(0, 0, els.curveCanvas.width, els.curveCanvas.height);
  } else {
    els.noiseRows.replaceChildren();
    lastNoise = null;
    els.noiseResultRows.replaceChildren();
    els.noiseMetrics.replaceChildren();
    els.noiseCanvas.getContext("2d").clearRect(0, 0, els.noiseCanvas.width, els.noiseCanvas.height);
  }
  updateConclusion();
  setStatus("????????");
}

document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === "load-example") loadTemplate();
    if (action === "calculate") calculateAll();
    if (action === "export-csv") exportCsv();
    if (action === "export-md") exportMarkdown();
    if (action === "copy-conclusion") copyConclusion();
    if (action === "clear") clearActive();
    if (action === "add-standard") els.standardRows.appendChild(standardRow());
    if (action === "add-sample") els.sampleRows.appendChild(sampleRow("", "", 1));
    if (action === "add-noise") els.noiseRows.appendChild(noiseRow());
  }

  const tab = event.target.closest(".tab");
  if (tab) {
    document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("is-active", item === tab));
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === tab.dataset.tab));
    setStatus(tab.dataset.tab === "water" ? "????????" : "?????? Leq");
    setTimeout(() => {
      if (lastWater) drawCurve(lastWater);
      if (lastNoise) drawNoise(lastNoise);
    }, 0);
  }

  const deleteButton = event.target.closest(".row-delete");
  if (deleteButton) {
    deleteButton.closest("tr").remove();
  }
});

els.analyte.addEventListener("change", () => loadTemplate(els.analyte.value));
window.addEventListener("resize", () => {
  if (lastWater) drawCurve(lastWater);
  if (lastNoise) drawNoise(lastNoise);
});

loadTemplate("cod");
