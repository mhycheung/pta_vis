"use strict";
// Drawing and controls. All physics is in physics.js (c = 1, L = 1).

const L = 1;
const PULSE_PERIOD = L / 24;     // pulsar period (arbitrary, sets dot spacing)
const T_WINDOW = 2.5 * L;        // time window of the history plots
const RED = [200, 40, 40], BLUE = [40, 90, 200];
const COL_E = "#1b7837", COL_P = "#b35806", COL_R = "#222";

const $ = id => document.getElementById(id);
const state = { t: 3 * L, playing: true, last: null };

function params() {
  return {
    alpha: +$("alpha").value * Math.PI / 180,
    lambda: Math.pow(10, +$("lambda").value) * L,
    h0: +$("h0").value,
    L,
  };
}

// ---------- canvas helpers ----------
const canvases = {};
for (const id of ["scene", "ticks", "path", "hist"]) {
  const c = $(id);
  canvases[id] = { c, ctx: c.getContext("2d"), h: +c.getAttribute("height"), w: 0 };
}
function resize() {
  const dpr = window.devicePixelRatio || 1;
  for (const k in canvases) {
    const o = canvases[k];
    o.w = o.c.clientWidth;
    o.c.style.height = o.h + "px";
    o.c.width = Math.round(o.w * dpr);
    o.c.height = Math.round(o.h * dpr);
    o.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}
window.addEventListener("resize", resize);

function rgbFor(v) { // v in [-1, 1] -> white..red / white..blue
  const c = v >= 0 ? RED : BLUE, a = Math.min(1, Math.abs(v));
  return [255 + (c[0] - 255) * a, 255 + (c[1] - 255) * a, 255 + (c[2] - 255) * a];
}
function line(ctx, x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
function fmt(x) {
  if (x === 0) return "0";
  const a = Math.abs(x);
  return (a >= 0.01 && a < 1000) ? x.toFixed(a < 0.1 ? 4 : 3) : x.toExponential(2);
}
function pulsesInFlight(t) { // emission times of pulses between pulsar and Earth
  const out = [];
  for (let n = Math.ceil((t - L) / PULSE_PERIOD); n * PULSE_PERIOD <= t; n++) out.push(n * PULSE_PERIOD);
  return out;
}

// ---------- scene: Earth (left), pulsar (right), GW field ----------
const fieldCanvas = document.createElement("canvas");
function drawScene(m, t, exag) {
  const { ctx, w, h } = canvases.scene;
  const x0 = -0.1 * L, scale = w / (1.2 * L);
  const X = x => (x - x0) * scale, Y = y => h / 2 - y * scale;
  const ymax = h / 2 / scale;

  // strain field, normalized to the largest possible value h0/2
  const nx = 240, ny = Math.max(2, Math.round(nx * h / w));
  fieldCanvas.width = nx; fieldCanvas.height = ny;
  const fctx = fieldCanvas.getContext("2d"), img = fctx.createImageData(nx, ny);
  for (let j = 0; j < ny; j++) {
    const y = ymax - (j + 0.5) / ny * 2 * ymax;
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) / nx * 1.2 * L;
      const c = rgbFor(m.strain(t, x, y) / (0.5 * m.h0));
      const q = 4 * (j * nx + i);
      img.data[q] = c[0]; img.data[q + 1] = c[1]; img.data[q + 2] = c[2]; img.data[q + 3] = 255;
    }
  }
  fctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(fieldCanvas, 0, 0, w, h);

  // GW crests: lines Omega.x = t - n lambda
  const ox = Math.cos(params().alpha), oy = Math.sin(params().alpha);
  const corners = [[x0, -ymax], [x0, ymax], [x0 + 1.2 * L, -ymax], [x0 + 1.2 * L, ymax]].map(([x, y]) => ox * x + oy * y);
  const cmin = Math.min(...corners), cmax = Math.max(...corners), R = 2 * L;
  ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 1;
  for (let n = Math.ceil((t - cmax) / m.lambda); t - n * m.lambda >= cmin; n++) {
    const c = t - n * m.lambda;
    line(ctx, X(c * ox - R * oy), Y(c * oy + R * ox), X(c * ox + R * oy), Y(c * oy - R * ox));
  }

  // line of sight
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.setLineDash([4, 4]);
  line(ctx, X(0), Y(0), X(L), Y(0)); ctx.setLineDash([]);

  // pulses: open = without GW, filled = with GW (delay times exaggeration)
  for (const te of pulsesInFlight(t)) {
    const xg = L - (t - te);
    const xa = xg + exag * m.partialDelay(te, t);
    ctx.strokeStyle = "#555"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(X(xg), Y(0), 5, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(X(xa), Y(0), 3, 0, 2 * Math.PI); ctx.fill();
  }

  // Earth and pulsar
  ctx.fillStyle = "#2c7fb8"; ctx.beginPath(); ctx.arc(X(0), Y(0), 11, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = "#41ab5d"; ctx.beginPath(); ctx.arc(X(0) - 3, Y(0) - 3, 4, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = "#6a3d9a"; ctx.beginPath(); ctx.arc(X(L), Y(0), 7, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = "#6a3d9a"; ctx.lineWidth = 2;
  const ph = 2 * Math.PI * t / PULSE_PERIOD / 4;
  line(ctx, X(L) - 22 * Math.cos(ph), Y(0) - 22 * Math.sin(ph), X(L) + 22 * Math.cos(ph), Y(0) + 22 * Math.sin(ph));
  ctx.fillStyle = "#000"; ctx.font = "13px system-ui"; ctx.textAlign = "center";
  ctx.fillText("Earth", X(0), Y(0) + 28); ctx.fillText("Pulsar", X(L), Y(0) + 28);

  // GW direction arrow
  const ax = w - 60, ay = 40, al = 26;
  ctx.strokeStyle = "#000"; ctx.fillStyle = "#000"; ctx.lineWidth = 2;
  line(ctx, ax - al * ox, ay + al * oy, ax + al * ox, ay - al * oy);
  const hx = ax + al * ox, hy = ay - al * oy, th = Math.atan2(-oy, ox);
  ctx.beginPath(); ctx.moveTo(hx, hy);
  ctx.lineTo(hx - 9 * Math.cos(th - 0.4), hy - 9 * Math.sin(th - 0.4));
  ctx.lineTo(hx - 9 * Math.cos(th + 0.4), hy - 9 * Math.sin(th + 0.4)); ctx.fill();
  ctx.textAlign = "left"; ctx.fillText("GW", ax - 50, ay - 22);
  ctx.textAlign = "left"; ctx.fillStyle = "#333";
  ctx.fillText("pulse delays drawn ×" + exag, 8, 16);
}

// ---------- arrival-time axis ----------
function drawTicks(m, t, exag) {
  const { ctx, w, h } = canvases.ticks;
  ctx.clearRect(0, 0, w, h);
  const left = 150, right = w - 15, tw = 1.0 * L;
  const T = x => left + (x - (t - tw)) / tw * (right - left);
  const y1 = 30, y2 = 70;
  ctx.font = "12px system-ui"; ctx.fillStyle = "#333"; ctx.textAlign = "right";
  ctx.fillText("without GW", left - 10, y1 + 4); ctx.fillText("with GW (×" + exag + ")", left - 10, y2 + 4);
  ctx.strokeStyle = "#999"; ctx.lineWidth = 1;
  line(ctx, left, y1, right, y1); line(ctx, left, y2, right, y2);
  for (let n = Math.ceil((t - tw - L - 0.5) / PULSE_PERIOD); (n * PULSE_PERIOD + L) <= t + 0.5; n++) {
    const ta = n * PULSE_PERIOD + L;
    const r = m.residual(ta), tr = ta + exag * r;
    if (ta <= t && ta >= t - tw) {
      ctx.strokeStyle = "#888"; ctx.lineWidth = 2; line(ctx, T(ta), y1 - 10, T(ta), y1 + 10);
    }
    if (tr <= t && tr >= t - tw) {
      const c = rgbFor(r / (Math.abs(r) + 1e-30) * 0.9);
      ctx.strokeStyle = `rgb(${c})`; ctx.lineWidth = 2; line(ctx, T(tr), y2 - 10, T(tr), y2 + 10);
      if (ta >= t - tw) { ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1; line(ctx, T(ta), y1 + 10, T(tr), y2 - 10); }
    }
  }
  // time axis
  ctx.strokeStyle = "#000"; ctx.lineWidth = 1; line(ctx, left, h - 22, right, h - 22);
  ctx.fillStyle = "#000"; ctx.textAlign = "center";
  for (let s = Math.ceil((t - tw) * 4) / 4; s <= t; s += 0.25) {
    line(ctx, T(s), h - 22, T(s), h - 17); ctx.fillText(s.toFixed(2), T(s), h - 5);
  }
  ctx.textAlign = "right"; ctx.fillText("arrival time at Earth (L/c) \u2192 now", right, h - 27);
}

// ---------- integrand along the path of the pulse arriving now ----------
function drawPath(m, t) {
  const { ctx, w, h } = canvases.path;
  ctx.clearRect(0, 0, w, h);
  const left = 70, right = w - 35, top = 22, bot = h - 34, mid = (top + bot) / 2;
  const D = d => left + d / L * (right - left);
  const ys = 0.5 * m.h0, V = v => mid - v / ys * (bot - top) / 2;
  const N = 600, pts = [];
  for (let i = 0; i <= N; i++) { const d = i / N * L; pts.push([d, m.strain(t - d, d, 0)]); }
  for (let i = 0; i < N; i++) {
    const [d, v] = pts[i], [d2, v2] = pts[i + 1];
    ctx.fillStyle = (v + v2) >= 0 ? "rgba(200,40,40,0.35)" : "rgba(40,90,200,0.35)";
    ctx.beginPath(); ctx.moveTo(D(d), V(0)); ctx.lineTo(D(d), V(v)); ctx.lineTo(D(d2), V(v2)); ctx.lineTo(D(d2), V(0)); ctx.fill();
  }
  ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.beginPath();
  pts.forEach(([d, v], i) => i ? ctx.lineTo(D(d), V(v)) : ctx.moveTo(D(d), V(v))); ctx.stroke();
  ctx.strokeStyle = "#999"; ctx.lineWidth = 1; line(ctx, left, V(0), right, V(0)); line(ctx, left, top, left, bot);
  ctx.fillStyle = "#000"; ctx.font = "12px system-ui"; ctx.textAlign = "center";
  ctx.fillText("Earth", D(0), bot + 14); ctx.fillText("Pulsar", D(L), bot + 14);
  ctx.fillText("position along the path (pulse moves right → left)", (left + right) / 2, bot + 28);
  ctx.save(); ctx.translate(14, mid); ctx.rotate(-Math.PI / 2); ctx.fillText("strain s seen by pulse", 0, 0); ctx.restore();
  ctx.textAlign = "left";
  ctx.fillText(`area = delay of this pulse = R(now) = ${fmt(m.residual(t))} L/c     (wave cycles along path N = ${m.cyclesAlongPath().toFixed(3)})`, left + 6, 14);
}

// ---------- period shift and residual vs time ----------
function drawHist(m, t) {
  const { ctx, w, h } = canvases.hist;
  ctx.clearRect(0, 0, w, h);
  const left = 70, right = w - 15, t0 = t - T_WINDOW;
  const T = s => left + (s - t0) / T_WINDOW * (right - left);
  const u = 0.5 * m.k * L * (1 + m.mu);
  const A = m.F * m.h0, sincU = Math.abs(u) < 1e-9 ? 1 : Math.sin(u) / u;
  const Ramp = A * L * Math.abs(sincU);
  const showTerms = Math.abs(1 + m.mu) > 0.05;
  const termAmp = showTerms ? A / (m.k * Math.abs(1 + m.mu)) : 0;
  const N = 500;

  function panel(top, bot, label, scale, curves, dots, shade) {
    const mid = (top + bot) / 2, V = v => mid - v / scale * (bot - top) / 2;
    ctx.strokeStyle = "#999"; ctx.lineWidth = 1;
    line(ctx, left, V(0), right, V(0)); line(ctx, left, top, left, bot);
    if (shade) {
      for (let i = 0; i < N; i++) {
        const s1 = t0 + i / N * T_WINDOW, s2 = t0 + (i + 1) / N * T_WINDOW, v1 = shade(s1), v2 = shade(s2);
        ctx.fillStyle = (v1 + v2) >= 0 ? "rgba(200,40,40,0.25)" : "rgba(40,90,200,0.25)";
        ctx.beginPath(); ctx.moveTo(T(s1), V(0)); ctx.lineTo(T(s1), V(v1)); ctx.lineTo(T(s2), V(v2)); ctx.lineTo(T(s2), V(0)); ctx.fill();
      }
    }
    for (const [f, col, dash, lw] of curves) {
      ctx.strokeStyle = col; ctx.setLineDash(dash); ctx.lineWidth = lw; ctx.beginPath();
      for (let i = 0; i <= N; i++) { const s = t0 + i / N * T_WINDOW; i ? ctx.lineTo(T(s), V(f(s))) : ctx.moveTo(T(s), V(f(s))); }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (dots) {
      ctx.fillStyle = "#000";
      for (let n = Math.ceil((t0 - L) / PULSE_PERIOD); n * PULSE_PERIOD + L <= t; n++) {
        const ta = n * PULSE_PERIOD + L;
        ctx.beginPath(); ctx.arc(T(ta), V(dots(ta)), 2.5, 0, 2 * Math.PI); ctx.fill();
      }
    }
    ctx.fillStyle = "#000"; ctx.font = "12px system-ui"; ctx.textAlign = "left";
    ctx.fillText(label, left + 6, top + 12);
    ctx.textAlign = "right"; ctx.fillText(fmt(scale), left - 4, top + 10); ctx.fillText(fmt(-scale), left - 4, bot);
  }

  const dpScale = 1.15 * Math.max(m.k * Ramp, 1e-4 * m.h0);
  panel(10, 150, "δP/P (fractional change of pulse period)", dpScale,
        [[m.periodShift, COL_R, [], 2]], null, m.periodShift);
  const rScale = 1.15 * Math.max(Ramp, termAmp, 1e-4 * m.h0 * L);
  const curves = [[m.residual, COL_R, [], 2]];
  if (showTerms) curves.push([m.earthTerm, COL_E, [6, 4], 1.5], [m.pulsarTerm, COL_P, [2, 3], 1.5]);
  panel(170, h - 30, "R(t) = ∫ δP/P dt  (timing residual, L/c)" + (showTerms ? "   dashed: Earth term, dotted: pulsar term" : "   (Earth/pulsar split hidden near α = 180°)"),
        rScale, curves, ta => m.partialDelay(ta - L, ta), null);

  ctx.strokeStyle = "#000"; ctx.lineWidth = 1; line(ctx, left, h - 22, right, h - 22);
  ctx.fillStyle = "#000"; ctx.textAlign = "center";
  for (let s = Math.ceil(t0 * 2) / 2; s <= t; s += 0.5) { line(ctx, T(s), h - 22, T(s), h - 17); ctx.fillText(s.toFixed(1), T(s), h - 5); }
  ctx.textAlign = "right"; ctx.fillText("arrival time (L/c) → now", right, h - 26);
}

// ---------- controls ----------
function updateLabels(m) {
  $("alphaV").textContent = $("alpha").value + "°";
  $("lambdaV").textContent = m.lambda.toFixed(3);
  $("h0V").textContent = (+$("h0").value).toFixed(3);
  $("exagV").textContent = "×" + $("exag").value;
  $("speedV").textContent = (+$("speed").value).toFixed(2);
  const u = 0.5 * m.k * L * (1 + m.mu), sincU = Math.abs(u) < 1e-9 ? 1 : Math.sin(u) / u;
  const Ramp = m.F * m.h0 * L * Math.abs(sincU);
  const terms = Math.abs(1 + m.mu) > 0.05 ? fmt(m.F * m.h0 / (m.k * Math.abs(1 + m.mu))) : "n/a";
  $("readout").innerHTML =
    `Wave cycles a pulse passes through on its way, N = L(1+cosα)/λ = <b>${m.cyclesAlongPath().toFixed(3)}</b> ` +
    `&nbsp;|&nbsp; line-of-sight factor F = ½ sin²α = <b>${m.F.toFixed(3)}</b> ` +
    `&nbsp;|&nbsp; residual amplitude = <b>${fmt(Ramp)}</b> L/c ` +
    `&nbsp;|&nbsp; Earth- and pulsar-term amplitude = <b>${terms}</b> L/c`;
}
$("play").onclick = () => { state.playing = !state.playing; $("play").textContent = state.playing ? "Pause" : "Play"; };
$("integer").onclick = () => {
  const p = params(), N = L * (1 + Math.cos(p.alpha)) / p.lambda;
  const n = Math.max(1, Math.round(N)), lam = L * (1 + Math.cos(p.alpha)) / n;
  const lmin = Math.pow(10, +$("lambda").min), lmax = Math.pow(10, +$("lambda").max);
  if (lam < lmin || lam > lmax) { alert("No wavelength in the slider range gives a whole number of cycles at this angle (α is too close to 180°). Change α first."); return; }
  $("lambda").value = Math.log10(lam);
};

function frame(now) {
  if (state.last !== null && state.playing) state.t += (now - state.last) / 1000 * +$("speed").value;
  state.last = now;
  const m = PTA.make(params()), exag = +$("exag").value;
  updateLabels(m);
  drawScene(m, state.t, exag);
  drawTicks(m, state.t, exag);
  drawPath(m, state.t);
  drawHist(m, state.t);
  requestAnimationFrame(frame);
}
resize();
requestAnimationFrame(frame);
