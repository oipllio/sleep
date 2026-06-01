const templates = {
  cod: {
    reportTitle: "COD 实验数据计算记录",
    unit: "mg/L",
    responseName: "吸光度",
    r2Target: 0.995,
    standards: [
      ["空白", 0, 0.002],
      ["S1", 20, 0.041],
      ["S2", 40, 0.081],
      ["S3", 80, 0.161],
      ["S4", 120, 0.241],
      ["S5", 160, 0.321],
    ],
    samples: [
      ["进水-1", "0.188, 0.191, 0.190", 1],
      ["出水-1", "0.071, 0.073, 0.072", 1],
    ],
  },
  nh3n: {
    reportTitle: "氨氮实验数据计算记录",
    unit: "mg/L",
    responseName: "吸光度",
    r2Target: 0.995,
    standards: [
      ["空白", 0, 0.004],
      ["S1", 0.1, 0.035],
      ["S2", 0.3, 0.095],
      ["S3", 0.5, 0.156],
      ["S4", 0.8, 0.248],
      ["S5", 1.0, 0.309],
    ],
    samples: [
      ["河水-A", "0.122, 0.126, 0.124", 1],
      ["出水-B", "0.058, 0.060, 0.059", 1],
    ],
  },
  tp: {
    reportTitle: "总磷实验数据计算记录",
    unit: "mg/L",
    responseName: "吸光度",
    r2Target: 0.995,
    standards: [
      ["空白", 0, 0.003],
      ["S1", 0.02, 0.026],
      ["S2", 0.05, 0.061],
      ["S3", 0.1, 0.119],
      ["S4", 0.2, 0.235],
      ["S5", 0.4, 0.468],
    ],
    samples: [
      ["湖水-1", "0.082, 0.084, 0.083", 1],
      ["排口-1", "0.221, 0.225, 0.223", 2],
    ],
  },
};

const defaultNoiseRows = [
  ["厂界东", "昼间", "58.4, 59.1, 57.8, 58.9, 59.4"],
  ["厂界南", "昼间", "61.0, 60.4, 60.8, 61.3, 60.7"],
  ["厂界西", "夜间", "49.1, 48.7, 50.0, 49.4, 48.9"],
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
    .split(/[\s,，;；、]+/)
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
  if (n < 2) throw new Error("标准曲线至少需要 2 个有效点。");

  const sumX = valid.reduce((sum, point) => sum + point.x, 0);
  const sumY = valid.reduce((sum, point) => sum + point.y, 0);
  const sumXY = valid.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumX2 = valid.reduce((sum, point) => sum + point.x * point.x, 0);
  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-12) throw new Error("标准浓度不能全部相同。");

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  if (Math.abs(slope) < 1e-12) throw new Error("标准曲线斜率接近 0，无法换算浓度。");

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
    `<td><button class="row-delete" type="button" aria-label="删除标样">x</button></td>`,
  ], "standard-row");
}

function sampleRow(name = "", readings = "", dilution = 1) {
  return makeRow([
    `<td><input data-field="name" type="text" value="${escapeHtml(name)}" /></td>`,
    `<td><input data-field="readings" type="text" value="${escapeHtml(readings)}" /></td>`,
    `<td><input data-field="dilution" type="number" min="0" step="any" value="${escapeHtml(dilution)}" /></td>`,
    `<td><button class="row-delete" type="button" aria-label="删除样品">x</button></td>`,
  ], "sample-row");
}

function noiseRow(point = "", period = "", readings = "") {
  return makeRow([
    `<td><input data-field="point" type="text" value="${escapeHtml(point)}" /></td>`,
    `<td><input data-field="period" type="text" value="${escapeHtml(period)}" /></td>`,
    `<td><input data-field="readings" type="text" value="${escapeHtml(readings)}" /></td>`,
    `<td><button class="row-delete" type="button" aria-label="删除点位">x</button></td>`,
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
  setStatus("已载入示例数据");
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
    const name = row.querySelector('[data-field="name"]').value.trim() || `样品${index + 1}`;
    const readings = parseNumbers(row.querySelector('[data-field="readings"]').value);
    const dilution = Number(row.querySelector('[data-field="dilution"]').value) || 1;
    return { name, readings, dilution };
  }).filter((sample) => sample.readings.length);
}

function collectNoiseRows() {
  return [...els.noiseRows.querySelectorAll("tr")].map((row, index) => {
    const point = row.querySelector('[data-field="point"]').value.trim() || `点位${index + 1}`;
    const period = row.querySelector('[data-field="period"]').value.trim() || "未标注";
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
  const responseName = els.responseName.value.trim() || "响应值";

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
  els.curveEquation.textContent = `${equation}，R² = ${fmt(fit.r2, 5)}`;

  els.waterMetrics.replaceChildren(
    metric("斜率", fmt(fit.slope, 6)),
    metric("截距", fmt(fit.intercept, 6)),
    metric("R²", fmt(fit.r2, 5)),
    metric("标样数", String(fit.n)),
  );

  els.waterResultRows.replaceChildren(...samples.map((sample) => {
    const judgement = sample.inRange ? "曲线范围内" : "超出曲线范围";
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
  setStatus(fit.r2 >= target ? "水质计算完成，线性满足阈值" : "水质计算完成，R² 低于阈值");
}

function renderNoise(result) {
  const rows = result.rows;
  const maxLeq = rows.length ? Math.max(...rows.map((row) => row.equivalent)) : NaN;
  const minLeq = rows.length ? Math.min(...rows.map((row) => row.equivalent)) : NaN;
  els.noiseMetrics.replaceChildren(
    metric("点位数", String(rows.length)),
    metric("最高 Leq", Number.isFinite(maxLeq) ? `${fmt(maxLeq, 1)} dB(A)` : "-"),
    metric("最低 Leq", Number.isFinite(minLeq) ? `${fmt(minLeq, 1)} dB(A)` : "-"),
    metric("算法", "能量平均"),
  );

  els.noiseResultRows.replaceChildren(...rows.map((item) => {
    const row = document.createElement("tr");
    const diff = item.equivalent - item.avg;
    row.innerHTML = [
      `<td>${escapeHtml(item.point)} / ${escapeHtml(item.period)}</td>`,
      `<td>${fmt(item.avg, 1)} dB(A)</td>`,
      `<td>${fmt(item.equivalent, 1)} dB(A)</td>`,
      `<td>${diff >= .3 ? "波动较明显" : "波动平稳"}</td>`,
    ].join("");
    return row;
  }));

  drawNoise(result);
  updateConclusion();
  setStatus("噪声 Leq 计算完成");
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
  drawAxisLabels(ctx, width, height, "浓度", result.responseName);

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
  drawAxisLabels(ctx, width, height, "点位", "dB(A)");

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
    const linearText = fit.r2 >= target ? "线性关系满足设定阈值" : "线性关系未达到设定阈值，建议复核标样配制、空白和仪器响应";
    lines.push(`${els.reportTitle.value || analyteLabel}：本次 ${analyteLabel} 标准曲线采用 ${fit.n} 个有效点拟合，${responseName} = ${fmt(fit.slope, 6)} x C + ${fmt(fit.intercept, 6)}，R² = ${fmt(fit.r2, 5)}，${linearText}。`);
    if (samples.length) {
      const sampleText = samples.map((sample) => `${sample.name} ${fmt(sample.concentration, 3)} ${unit}`).join("；");
      const rangeWarn = samples.some((sample) => !sample.inRange) ? "其中存在样品换算点超出标准曲线范围，结果宜稀释复测或扩展曲线后确认。" : "样品换算点均位于标准曲线范围内。";
      lines.push(`样品结果：${sampleText}。${rangeWarn}`);
    }
  }

  if (lastNoise) {
    const rows = lastNoise.rows;
    if (rows.length) {
      const top = rows.reduce((best, item) => item.equivalent > best.equivalent ? item : best, rows[0]);
      const text = rows.map((row) => `${row.point}${row.period ? `(${row.period})` : ""} Leq ${fmt(row.equivalent, 1)} dB(A)`).join("；");
      lines.push(`噪声监测：${text}。最高点位为 ${top.point}，Leq = ${fmt(top.equivalent, 1)} dB(A)。`);
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
  rows.push(["报告名称", els.reportTitle.value]);
  rows.push([]);
  if (water) {
    rows.push(["水质标准曲线"]);
    rows.push(["标样", "浓度", water.responseName]);
    water.standards.forEach((point) => rows.push([point.name, point.x, point.y]));
    rows.push(["方程", `${water.responseName} = ${fmt(water.fit.slope, 6)} x C + ${fmt(water.fit.intercept, 6)}`, "R2", fmt(water.fit.r2, 5)]);
    rows.push([]);
    rows.push(["水质样品结果"]);
    rows.push(["样品", "平均响应", "曲线浓度", "稀释倍数", "最终浓度", "单位", "判读"]);
    water.samples.forEach((sample) => rows.push([
      sample.name,
      fmt(sample.avgResponse, 4),
      fmt(sample.curveConcentration, 4),
      sample.dilution,
      fmt(sample.concentration, 3),
      water.unit,
      sample.inRange ? "曲线范围内" : "超出曲线范围",
    ]));
    rows.push([]);
  }
  if (noise) {
    rows.push(["噪声 Leq 结果"]);
    rows.push(["点位", "工况/时段", "算术均值 dB(A)", "Leq dB(A)", "原始声级"]);
    noise.rows.forEach((item) => rows.push([
      item.point,
      item.period,
      fmt(item.avg, 1),
      fmt(item.equivalent, 1),
      item.readings.join(" "),
    ]));
    rows.push([]);
  }
  rows.push(["结论"]);
  rows.push([els.conclusionText.value]);

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  download(`lab-results-${dateStamp()}.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
  setStatus("CSV 已导出");
}

function exportMarkdown() {
  const { water, noise } = ensureLatest();
  const parts = [`# ${els.reportTitle.value || "实验数据计算记录"}`];
  if (water) {
    parts.push(
      "",
      "## 水质标准曲线",
      "",
      `- 方程：${water.responseName} = ${fmt(water.fit.slope, 6)} x C + ${fmt(water.fit.intercept, 6)}`,
      `- R²：${fmt(water.fit.r2, 5)}`,
      "",
      "| 标样 | 浓度 | 响应值 |",
      "| --- | ---: | ---: |",
      ...water.standards.map((point) => `| ${point.name} | ${fmt(point.x, 4)} | ${fmt(point.y, 4)} |`),
      "",
      "## 水质样品结果",
      "",
      "| 样品 | 平均响应 | 最终浓度 | 判读 |",
      "| --- | ---: | ---: | --- |",
      ...water.samples.map((sample) => `| ${sample.name} | ${fmt(sample.avgResponse, 4)} | ${fmt(sample.concentration, 3)} ${water.unit} | ${sample.inRange ? "曲线范围内" : "超出曲线范围"} |`),
    );
  }
  if (noise) {
    parts.push(
      "",
      "## 噪声 Leq 结果",
      "",
      "| 点位 | 工况/时段 | 算术均值 | Leq |",
      "| --- | --- | ---: | ---: |",
      ...noise.rows.map((item) => `| ${item.point} | ${item.period} | ${fmt(item.avg, 1)} dB(A) | ${fmt(item.equivalent, 1)} dB(A) |`),
    );
  }
  parts.push("", "## 结论", "", els.conclusionText.value);
  download(`lab-results-${dateStamp()}.md`, parts.join("\n"), "text/markdown;charset=utf-8");
  setStatus("Markdown 已导出");
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
    setStatus("结论已复制");
  } catch {
    els.conclusionText.select();
    document.execCommand("copy");
    setStatus("结论已复制");
  }
}

function clearActive() {
  if (activePanelName() === "water") {
    els.standardRows.replaceChildren();
    els.sampleRows.replaceChildren();
    lastWater = null;
    els.waterResultRows.replaceChildren();
    els.waterMetrics.replaceChildren();
    els.curveEquation.textContent = "等待计算";
    els.curveCanvas.getContext("2d").clearRect(0, 0, els.curveCanvas.width, els.curveCanvas.height);
  } else {
    els.noiseRows.replaceChildren();
    lastNoise = null;
    els.noiseResultRows.replaceChildren();
    els.noiseMetrics.replaceChildren();
    els.noiseCanvas.getContext("2d").clearRect(0, 0, els.noiseCanvas.width, els.noiseCanvas.height);
  }
  updateConclusion();
  setStatus("已清空当前页数据");
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
    setStatus(tab.dataset.tab === "water" ? "已切换到水质指标" : "已切换到噪声 Leq");
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
