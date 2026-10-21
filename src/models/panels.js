// Leaf faces of the five doors, transcribed from the product photos on almaz-nsk.com.
//
// A face is a list of MDF regions — polygons in (u, v): u runs from the hinge edge (0) to the lock edge (1),
// v from the bottom (0) to the top (1) of the panel. Each region is extruded with an eased bevel that stays
// inside its outline, so two neighbouring regions meet in a real V-groove (the milled joint of the MDF).
// The same (u, v) works for both faces: seen from outside the hinges are on the right, from inside on the left.
//
// design(ctx) → { regions, strips, hw, decor }
//   regions: { pts, mat, t (thickness, m), lift (extra height above the skin), bevel }
//   strips:  { a: [u, v], b: [u, v], w, t, mat, lift } — straight inserts / mouldings
//   hw:      hardware layout { type, e (m from the lock edge) | u, y (m above the floor) }
//   decor:   (api) => void — anything else (Dino mouldings, raised panel)
import { rng } from '../geom.js';

const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

/** 1D value noise, smooth, seeded. */
function noise1(seed, n) {
  const R = rng(seed);
  const g = Array.from({ length: n + 1 }, () => R() * 2 - 1);
  return (x) => {
    const t = x * n, i = Math.floor(t), f = t - i, s = f * f * (3 - 2 * f);
    return g[Math.min(i, n)] * (1 - s) + g[Math.min(i + 1, n)] * s;
  };
}

/**
 * «Live edge» of a sawn board (рисунок № 278): u(v) around `base`, bottom → top. Fractal wobble from coarse
 * lobes down to splinters, plus a few deep bark pockets and hooked spurs like the photo of the leaf.
 */
function liveEdge(seed, base, amp) {
  const R = rng(seed);
  const oct = [3, 7, 16, 37, 80, 170].map((f, i) => [noise1(seed + i * 13, f), amp * [0.9, 0.55, 0.33, 0.17, 0.08, 0.04][i]]);
  const pockets = Array.from({ length: 5 }, () => [0.06 + R() * 0.88, (R() < 0.5 ? -1 : 1) * amp * (0.5 + R() * 0.7), 0.006 + R() * 0.014]);
  const pts = [];
  const N = 420;
  for (let i = 0; i <= N; i++) {
    const v = i / N;
    let u = base;
    for (const [f, a] of oct) u += f(v) * a;
    for (const [c, a, w] of pockets) {
      const d = (v - c) / w;
      u += a * Math.exp(-d * d) * (d > 0 ? 1 : 0.55 + 0.45 * Math.exp(d * 2)); // asymmetric: steep on one side
    }
    pts.push([Math.min(0.97, Math.max(0.55, u)), v]);
  }
  return pts;
}

/** Bowyer–Watson Delaunay triangulation of a few dozen points. */
function delaunay(P) {
  const big = [[-10, -10], [10, -10], [0, 10]];
  const pts = [...P, ...big];
  const n = P.length;
  let tris = [[n, n + 1, n + 2]];
  const circ = (t) => {
    const [a, b, c] = t.map((i) => pts[i]);
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    const ux = ((a[0] ** 2 + a[1] ** 2) * (b[1] - c[1]) + (b[0] ** 2 + b[1] ** 2) * (c[1] - a[1]) + (c[0] ** 2 + c[1] ** 2) * (a[1] - b[1])) / d;
    const uy = ((a[0] ** 2 + a[1] ** 2) * (c[0] - b[0]) + (b[0] ** 2 + b[1] ** 2) * (a[0] - c[0]) + (c[0] ** 2 + c[1] ** 2) * (b[0] - a[0])) / d;
    return [ux, uy, (a[0] - ux) ** 2 + (a[1] - uy) ** 2];
  };
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const bad = tris.filter((t) => {
      const [x, y, r2] = circ(t);
      return (p[0] - x) ** 2 + (p[1] - y) ** 2 < r2 - 1e-12;
    });
    const edges = [];
    for (const t of bad)
      for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
        const k = edges.findIndex((e) => (e[0] === b && e[1] === a) || (e[0] === a && e[1] === b));
        if (k >= 0) edges.splice(k, 1);
        else edges.push([a, b]);
      }
    tris = tris.filter((t) => !bad.includes(t));
    for (const [a, b] of edges) tris.push([a, b, i]);
  }
  return tris.filter((t) => t.every((i) => i < n)).map((t) => t.map((i) => P[i]));
}

function inPoly(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Standard lock-side hardware heights (m above the floor). */
const H = { keyhole: 1.26, lever: 1.0, cylinder: 0.885, latch: 1.12, peephole: 1.5 };
const E = 0.072; // backset from the lock edge

const outside = (extra = []) => [
  { type: 'keyhole', e: E, y: H.keyhole },
  { type: 'lever', e: E, y: H.lever },
  { type: 'cylinder', e: E, y: H.cylinder },
  ...extra,
];
const inside = (extra = []) => [
  { type: 'keyhole', e: E, y: H.keyhole },
  { type: 'latch', e: E, y: H.latch },
  { type: 'lever', e: E, y: H.lever },
  { type: 'cylinder', e: E, y: H.cylinder },
  ...extra,
];

export const DESIGNS = {
  // ---------------------------------------------------------------- КАССИОПЕЯ стандарт (рисунок № 278)
  kassiopeya_ext: () => {
    const edge = liveEdge(278, 0.77, 0.06);
    return {
      regions: [
        { pts: [[0, 0], ...edge, [0, 1]], mat: 'quartz', t: 0.01 },
        { pts: [[1, 0], [1, 1], ...[...edge].reverse()], mat: 'oak', t: 0.0105 },
      ],
      hw: outside([{ type: 'peephole', u: 0.42, y: H.peephole }]),
    };
  },
  kassiopeya_int: () => {
    const edge = liveEdge(2780, 0.75, 0.065);
    return {
      regions: [
        { pts: [[0, 0], ...edge, [0, 1]], mat: 'graphite', t: 0.016 },
        { pts: [[1, 0], [1, 1], ...[...edge].reverse()], mat: 'oak', t: 0.0165 },
      ],
      hw: inside([{ type: 'peephole', u: 0.42, y: H.peephole }]),
    };
  },

  // ---------------------------------------------------------------- ДИНО 10 ТЕРМО: classic steel leaf, glass, grille
  // Proportions measured on the product photo: glass 0.226–0.771 × 0.443–0.905 of the leaf, wide flat surround
  // with a cornice cap above, a sill with two consoles and the pull bar below, raised lower panel, base moulding.
  dino_ext: () => ({
    regions: [],
    hole: rect(0.226, 0.443, 0.774, 0.905),
    hw: [
      { type: 'keyhole', e: 0.095, y: 1.32 },
      { type: 'lever', e: 0.095, y: 1.0 },
      { type: 'cylinder', e: 0.095, y: 0.905 },
      { type: 'pull', u: 0.5, y: 0.735, len: 0.27, style: 'classic' },
    ],
    decor: (api) => {
      api.surround(0.18, 0.425, 0.82, 0.925); // flat raised frame round the glass
      api.moulding(0, 0, 0, 0, 'bolection'); // steps down into the glass opening
      api.ledge(0.12, 0.88, 0.955, 'cap'); // cornice cap over the window
      api.ledge(0.13, 0.87, 0.398, 'sill'); // window sill
      for (const u of [0.222, 0.778]) api.corbel(u, 0.357); // consoles under the sill
      api.moulding(0.18, 0.088, 0.82, 0.326, 'field');
      api.raised(0.235, 0.118, 0.765, 0.296);
      api.ledge(0.12, 0.88, 0.062, 'base'); // plinth moulding
    },
  }),
  dino_int: () => ({
    regions: [],
    hole: rect(0.226, 0.443, 0.774, 0.905),
    hw: [
      { type: 'keyhole', e: 0.06, y: 1.32 },
      { type: 'latch', e: 0.06, y: 1.2 },
      { type: 'lever', e: 0.06, y: 1.0 },
      { type: 'cylinder', e: 0.06, y: 0.905 },
    ],
    decor: (api) => {
      api.surround(0.155, 0.41, 0.845, 0.94);
      api.moulding(0, 0, 0, 0, 'bolection');
      api.moulding(0.155, 0.05, 0.845, 0.36, 'field');
      api.raised(0.205, 0.085, 0.795, 0.325);
    },
  }),

  // ---------------------------------------------------------------- БЕРИЛЛ КВАДРО-3 (рисунок № 277)
  berill_ext: () => {
    const strip = 0.075; // ribbed «софт чёрный» band along the hinge edge
    const black = [[1, 0.87], [0.64, 0.64], [0.6, 0.48], [0.79, 0.3], [1, 0.14]];
    const pts = [
      [strip, 0], [1, 0], [1, 1], [strip, 1], ...black,
      [strip, 0.21], [strip, 0.47], [strip, 0.69], [strip, 0.86],
      [0.31, 1], [0.57, 1], [0.82, 1], [0.27, 0], [0.55, 0], [0.84, 0], [1, 0.06], [1, 0.95],
      [0.82, 0.755], [0.7, 0.39], [0.82, 0.22],
      [0.34, 0.83], [0.52, 0.66], [0.27, 0.58], [0.44, 0.38], [0.24, 0.24], [0.5, 0.13], [0.69, 0.93], [0.46, 0.92], [0.4, 0.5],
    ];
    const facets = delaunay(pts).filter((t) => {
      const c = [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3];
      return c[0] > strip && !inPoly(c, black);
    });
    return {
      regions: [
        { pts: rect(0, 0, strip, 1), mat: 'ribbed', t: 0.0095, bevel: 0.001 },
        { pts: black, mat: 'ribbed', t: 0.0102, bevel: 0.001 },
        ...facets.map((f) => ({ pts: f, mat: 'walnut', t: 0.01, bevel: 0.0012, inset: 0.0011 })),
      ],
      hw: [
        { type: 'peephole', u: 0.5, y: H.peephole },
        { type: 'cylinder', e: E, y: 1.27 },
        { type: 'lever', e: E, y: H.lever },
        { type: 'keyhole', e: E, y: 0.875 },
      ],
    };
  },
  berill_int: () => {
    // light oak film columns, full-height mirror with black diagonal glazing bars
    const m0 = 0.25, m1 = 0.79;
    return {
      regions: [
        { pts: rect(0, 0, m0, 1), mat: 'whiteOak', t: 0.016 },
        { pts: rect(m1, 0, 1, 1), mat: 'whiteOak', t: 0.016 },
        { pts: rect(m0, 0.012, m1, 0.988), mat: 'mirror', t: 0.012, bevel: 0.004 },
      ],
      strips: (() => {
        const s = [];
        const ys = [0.012, 0.35, 0.67, 0.988];
        for (let i = 0; i < 3; i++) {
          s.push({ a: [m0, ys[i]], b: [m1, ys[i + 1]], w: 0.006, t: 0.0035, mat: 'barBlack', lift: 0.012 });
          s.push({ a: [m1, ys[i]], b: [m0, ys[i + 1]], w: 0.006, t: 0.0035, mat: 'barBlack', lift: 0.012 });
        }
        for (const y of ys.slice(1, -1)) s.push({ a: [m0, y], b: [m1, y], w: 0.006, t: 0.0035, mat: 'barBlack', lift: 0.012 });
        for (const u of [m0, m1]) s.push({ a: [u, 0.012], b: [u, 0.988], w: 0.007, t: 0.004, mat: 'barBlack', lift: 0.01 });
        return s;
      })(),
      hw: [
        { type: 'peephole', u: 0.5, y: H.peephole },
        { type: 'cylinder', e: E, y: 1.27 },
        { type: 'latch', e: E, y: 1.15 },
        { type: 'lever', e: E, y: H.lever },
        { type: 'keyhole', e: E, y: 0.875 },
      ],
    };
  },

  // ---------------------------------------------------------------- ОСКАР (№ 185 / № 186)
  oskar_ext: () => {
    const cuts = [0.165, 0.375, 0.585, 0.795];
    const g = 0.0045; // half groove in v (≈ 9 mm)
    const bands = [0, ...cuts, 1].slice(0, -1).map((v0, i, a) => [i ? v0 + g : 0, i < cuts.length ? cuts[i] - g : 1]);
    return {
      regions: bands.map(([v0, v1]) => ({ pts: rect(0, v0, 1, v1), mat: 'marbleBlack', t: 0.01 })),
      strips: cuts.map((v) => ({ a: [0.004, v], b: [0.996, v], w: 0.0055, t: 0.0115, mat: 'insert', lift: 0 })),
      hw: outside([{ type: 'peephole', u: 0.5, y: H.peephole }]),
    };
  },
  oskar_int: () => {
    const m0 = 0.3, m1 = 0.6;
    const cuts = [0.18, 0.39, 0.6, 0.805];
    const g = 0.0035;
    const col = (u0, u1) =>
      [0, ...cuts].map((v0, i) => ({ pts: rect(u0, i ? v0 + g : 0, u1, i < cuts.length ? cuts[i] - g : 1), mat: 'marbleWhite', t: 0.016 }));
    return {
      regions: [...col(0, m0), ...col(m1, 1), { pts: rect(m0, 0.004, m1, 0.996), mat: 'mirror', t: 0.012, bevel: 0.0035 }],
      strips: [
        ...cuts.flatMap((v) => [
          { a: [0.004, v], b: [m0, v], w: 0.006, t: 0.017, mat: 'barBlack', lift: 0 },
          { a: [m1, v], b: [0.996, v], w: 0.006, t: 0.017, mat: 'barBlack', lift: 0 },
        ]),
      ],
      hw: inside([{ type: 'peephole', u: 0.45, y: H.peephole }]),
    };
  },

  // ---------------------------------------------------------------- НИКО
  niko_ext: () => {
    const a = 0.755, b = 0.885, lo = 0.3, hi = 0.715;
    return {
      regions: [
        { pts: [[0, 0], [a, 0], [a, lo], [a - 0.03, lo], [a - 0.03, hi], [a, hi], [a, 1], [0, 1]], mat: 'stone', t: 0.016 },
        { pts: rect(a - 0.03, lo, 1, hi), mat: 'stone', t: 0.016 },
        { pts: rect(b, 0, 1, lo), mat: 'stone', t: 0.016 },
        { pts: rect(b, hi, 1, 1), mat: 'stone', t: 0.016 },
      ],
      hw: [
        { type: 'cylinder', e: 0.075, y: 1.31 },
        { type: 'cylinder', e: 0.075, y: 0.9 },
        { type: 'pull', e: 0.168, y: 1.105, len: 0.44, style: 'modern' },
      ],
    };
  },
  niko_int: () => {
    const a = 0.7, b = 0.84, lo = 0.28, hi = 0.68;
    return {
      regions: [
        { pts: [[0, 0], [a, 0], [a, lo], [a - 0.025, lo], [a - 0.025, hi], [a, hi], [a, 1], [0, 1]], mat: 'white', t: 0.016 },
        { pts: rect(a - 0.025, lo, 1, hi), mat: 'white', t: 0.016 },
        { pts: rect(b, 0, 1, lo), mat: 'white', t: 0.016 },
        { pts: rect(b, hi, 1, 1), mat: 'white', t: 0.016 },
      ],
      hw: [
        { type: 'cylinder', e: 0.075, y: 1.31 },
        { type: 'latch', e: 0.075, y: 1.1 },
        { type: 'cylinder', e: 0.075, y: 0.9 },
      ],
    };
  },
};
