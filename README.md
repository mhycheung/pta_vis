# pta_vis

Interactive web page showing how a plane gravitational wave changes the arrival times of pulses travelling from a pulsar to Earth, and why the timing residual (a time integral of a periodic signal) does not vanish.

Open `index.html` in a browser, or visit the GitHub Pages site.

- `physics.js`: closed-form delays (units c = 1, pulsar distance L = 1).
- `app.js`: drawing and controls.
- `test_physics.js`: checks the closed forms against brute-force integration along the pulse path (`node test_physics.js`).
