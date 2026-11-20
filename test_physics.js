// Checks the closed forms in physics.js against brute-force integration along the pulse path.
const { make } = require("./physics.js");
let worst = 0;
for (const alphaDeg of [0, 30, 60, 90, 135, 170, 179.9, 180, 250]) {
  for (const lambda of [0.07, 0.3, 1, 2.5]) {
    const m = make({ alpha: alphaDeg * Math.PI / 180, lambda, h0: 0.1, L: 1 });
    for (const ta of [0.13, 1.7, 4.2]) {
      // brute force: midpoint rule of s(t', x(t')) along x = ta - t'
      const N = 200000, te = ta - 1; let D = 0;
      for (let i = 0; i < N; i++) { const t = te + (i + 0.5) / N; D += m.strain(t, ta - t, 0) / N; }
      const err1 = Math.abs(D - m.residual(ta));
      const err2 = Math.abs(1 + m.mu) > 0.05 ? Math.abs(m.residual(ta) - m.earthTerm(ta) - m.pulsarTerm(ta)) : 0;
      const e = 1e-5, dnum = (m.residual(ta + e) - m.residual(ta - e)) / (2 * e);
      const err3 = Math.abs(dnum - m.periodShift(ta));
      worst = Math.max(worst, err1, err2, err3);
    }
  }
}
console.log("max abs error:", worst.toExponential(2));
// integer number of cycles along the path => residual vanishes identically
const m = make({ alpha: Math.PI / 3, lambda: 1.5 / 3, h0: 0.1, L: 1 });
console.log("cycles:", m.cyclesAlongPath(), " max |R|:", Math.max(...[0.1, 0.37, 0.8, 2.2].map(t => Math.abs(m.residual(t)))).toExponential(2));
process.exit(worst < 1e-7 ? 0 : 1);
