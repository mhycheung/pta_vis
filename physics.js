// Physics of a plane gravitational wave acting on pulses travelling from a pulsar to Earth.
//
// Units: c = 1, pulsar distance L sets the length/time unit.
// Geometry (all in the x-y plane): Earth at x = 0, pulsar at x = L, so the unit vector
// from Earth to pulsar is p = +x. Pulses travel in the -x direction.
// The GW propagates along Omega = (cos a, sin a, 0). Plus polarization with axes
// m = (-sin a, cos a, 0) and z, so h_ij = h0 cos(k (t - Omega.x)) (m_i m_j - z_i z_j).
// The strain projected on the line of sight is s = (1/2) p^i p^j h_ij = F h0 cos(...),
// with F = (1/2) sin^2 a.
//
// Along the null path, dt = |dx| (1 + s), so each pulse arrives late by
//   Delta = integral of s(t', x(t')) dt' over its flight from pulsar to Earth.
(function (root) {
  "use strict";

  // integral_a^b cos(c1 t + c0) dt, written so it stays finite as c1 -> 0
  function cosIntegral(c1, c0, a, b) {
    const d = b - a, x = 0.5 * c1 * d;
    const sinc = Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x;
    return d * Math.cos(c1 * 0.5 * (a + b) + c0) * sinc;
  }

  function sinc(x) { return Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x; }

  function make(p) {
    const a = p.alpha, L = p.L, h0 = p.h0;
    const k = 2 * Math.PI / p.lambda;
    const ox = Math.cos(a), oy = Math.sin(a);
    const mu = ox;                       // Omega . p
    const F = 0.5 * Math.sin(a) ** 2;    // (1/2) p p e+
    const A = F * h0;

    const m = {
      k, mu, F, L, lambda: p.lambda, h0,
      // projected strain s = (1/2) p p h at event (t, x, y)
      strain(t, x, y) { return A * Math.cos(k * (t - ox * x - oy * y)); },
      // delay accumulated so far (at time t) by a pulse emitted from the pulsar at te.
      // On its path x = L - (t' - te), so the GW phase is k (t'(1+mu) - mu (L + te)).
      partialDelay(te, t) { return A * cosIntegral(k * (1 + mu), -k * mu * (L + te), te, t); },
      // timing residual of a pulse arriving at Earth at time ta
      residual(ta) { return m.partialDelay(ta - L, ta); },
      // the residual split into Earth and pulsar terms (each diverges as 1+mu -> 0)
      earthTerm(ta) { return A / (k * (1 + mu)) * Math.sin(k * ta); },
      pulsarTerm(ta) { return -A / (k * (1 + mu)) * Math.sin(k * (ta - L * (1 + mu))); },
      // fractional change of the observed pulse period, dDelta/dta
      //   = [s(Earth, ta) - s(pulsar, ta - L)] / (1 + mu)
      periodShift(ta) {
        const u = 0.5 * k * L * (1 + mu);
        return -A * k * L * Math.sin(k * ta - u) * sinc(u);
      },
      // number of GW cycles a pulse passes through on its way to Earth
      cyclesAlongPath() { return L * (1 + mu) / p.lambda; },
    };
    return m;
  }

  const api = { make, cosIntegral };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PTA = api;
})(this);
