// Parametric steel entrance door: bent-steel frame («короб») with mitred corners, leaf with an MDF
// overlay that laps over the frame, seal contours, barrel hinges, anti-removal pins, lock faceplate with
// bolts and strike plate, thermal break, glazing with a forged grille and the classic portal of ДИНО.
//
// Door coordinates: the frame block is centred on x = 0, stands on y = 0, its outer face is z = 0 and the
// exterior is +z. The model is built right-handed (hinges on the right seen from outside, «правое»);
// a left door is the same group mirrored in x. The leaf hangs on a pivot at the hinge axis.
import * as THREE from 'three';
import { Batch, M, box, prism, sweep, rectPath, roundRect, slab, polyShape, pipe, curveTube, lathe } from '../geom.js';
import { surface, powderCoat, metal, rubber, glass, mirror } from '../materials.js';
import { DESIGNS } from './panels.js';
import { Mirror } from '../reflector.js';
import { mountHardware, knuckle, lockFaceplate, strikePlate } from './hardware.js';

// frame section (m)
const FW = 0.05; // face width of jambs and head
const FB = 0.03; // threshold face height
const LIP = 0.012; // inner stop lip
const OV = 0.012; // leaf overlap onto the frame face
const GAP = 0.003; // leaf body to frame clearance
const TS = 0.003; // steel skin under the MDF
const ZE0 = 0.0025; // back of the exterior overlay (seal compression gap)
const MAX_OPEN = (75 * Math.PI) / 180;

// ---------------------------------------------------------------- materials
const shared = {};
function sharedMats() {
  if (shared.ready) return shared;
  Object.assign(shared, {
    ready: true,
    quartz: surface('quartz_black', { roughness: 0.66 }),
    graphite: surface('film_graphite', { roughness: 0.62 }),
    oak: surface('oak_rustic', { roughness: 0.52 }),
    walnut: surface('walnut', { tint: 'stain', color: '#4f2f1e', keep: 0.45, contrast: 1.9, roughness: 0.46 }),
    whiteOak: surface('oak_rustic', { tint: 'paint', color: '#e2e0db', contrast: 0.32, roughness: 0.5, rotate: true }),
    ribbed: surface('soft_ribbed', { roughness: 0.6 }),
    marbleBlack: surface('marble_black', { roughness: 0.3 }),
    marbleWhite: surface('marble_white', { roughness: 0.28 }),
    stone: surface('stone_grey', { tint: 'stain', color: '#4d4f52', keep: 0.5, contrast: 0.75, roughness: 0.58 }),
    white: surface('film_white', { roughness: 0.42 }),
    mirror: mirror(),
    insert: new THREE.MeshPhysicalMaterial({ color: '#0c0c0d', metalness: 0.7, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, name: 'insert' }),
    barBlack: powderCoat('#121314', { texture: 'peel', roughness: 0.5 }),
    hwDark: new THREE.MeshStandardMaterial({ color: '#08090a', roughness: 0.6, metalness: 0.3, name: 'hwDark' }),
    cyl: metal('nickel'),
    lens: new THREE.MeshPhysicalMaterial({ color: '#06080a', roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, name: 'lens' }),
    chrome: metal('chrome'),
    rubber: rubber(),
    steel: metal('steel'),
    glass: glass(),
    grille: metal('bronze'),
    thermo: new THREE.MeshStandardMaterial({ color: '#2b2c2e', roughness: 0.62, name: 'thermo' }),
  });
  return shared;
}

/** Materials for one door model (powder coats and hardware finish differ per model). */
export function doorMaterials(look) {
  const s = sharedMats();
  const frame = powderCoat(look.frame.color, look.frame);
  const leaf = powderCoat(look.leaf.color, look.leaf);
  const inner = look.inner ? powderCoat(look.inner.color, look.inner) : leaf;
  return { ...s, frame, leaf, inner, hw: metal(look.hw) };
}

/** Applies a matrix and keeps triangles facing their normals when the matrix mirrors. */
function placed(g, m) {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.applyMatrix4(m);
  if (m.determinant() < 0) {
    const p = ng.attributes.position.array, uv = ng.attributes.uv?.array;
    for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) [p[i + 3 + k], p[i + 6 + k]] = [p[i + 6 + k], p[i + 3 + k]];
    const n = ng.attributes.normal.array;
    for (let i = 0; i < n.length; i += 9) for (let k = 0; k < 3; k++) [n[i + 3 + k], n[i + 6 + k]] = [n[i + 6 + k], n[i + 3 + k]];
    if (uv) for (let i = 0; i < uv.length; i += 6) for (let k = 0; k < 2; k++) [uv[i + 2 + k], uv[i + 4 + k]] = [uv[i + 4 + k], uv[i + 2 + k]];
  }
  return ng;
}
const basis = (ax, ay, az, t = [0, 0, 0]) => new THREE.Matrix4().makeBasis(new THREE.Vector3(...ax), new THREE.Vector3(...ay), new THREE.Vector3(...az)).setPosition(...t);

// ---------------------------------------------------------------- build
/**
 * door: catalog entry; cfg: { size: [w, h] mm, hand: 'right' | 'left' }.
 * Returns { group, leaf, setOpen(rad), mirrors, W, H, D, decorW, decorH }.
 */
export function buildDoor(door, cfg, mats) {
  const look = door.look;
  const W = cfg.size[0] / 1000, H = cfg.size[1] / 1000, D = look.depth, T = look.thick;
  const ax = W / 2 - FW + OV + 0.004, az = 0.0095; // hinge axis
  const fixed = new Batch(), moving = new Batch();

  // ---- leaf layout (door coordinates)
  const xhE = W / 2 - FW + OV, Wp = W - 2 * (FW - OV), ybE = FB - 0.01, Hp = H - (FW - OV) - ybE;
  const bodyX = W / 2 - FW - GAP, bodyY0 = FB + GAP, bodyY1 = H - FW - GAP;
  const ziTop = ZE0 + TS + 0.01 - T; // interior face of the leaf
  const zb0 = ziTop + 0.016 + TS; // back of the steel body
  const xhI = bodyX - 0.008, WpI = 2 * xhI, ybI = bodyY0 + 0.008, HpI = bodyY1 - 0.008 - ybI;
  const zc = (ZE0 + zb0) / 2; // mid-thickness of the body

  const ext = DESIGNS[look.ext]({ Wp, Hp });
  const int = DESIGNS[look.int]({ Wp: WpI, Hp: HpI });

  const plates = lockPlates(ext.hw || []);

  // glazing: hole given in exterior (u, v) → door coordinates
  let hole = null;
  if (ext.hole) {
    const us = ext.hole.map((p) => p[0]), vs = ext.hole.map((p) => p[1]);
    hole = { x0: xhE - Math.max(...us) * Wp, x1: xhE - Math.min(...us) * Wp, y0: ybE + Math.min(...vs) * Hp, y1: ybE + Math.max(...vs) * Hp };
  }
  const holePath = (toS) => {
    const [a, b] = [toS(hole.x0, hole.y0), toS(hole.x1, hole.y1)];
    const p = new THREE.Path();
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    p.moveTo(x0, y0).lineTo(x0, y1).lineTo(x1, y1).lineTo(x1, y0).closePath();
    return p;
  };

  // ---- leaf body (steel box) in leaf-local coordinates
  const L = (x, y, z) => M(x - ax, y, z - az);
  {
    const s = new THREE.Shape();
    s.moveTo(-bodyX, bodyY0).lineTo(bodyX, bodyY0).lineTo(bodyX, bodyY1).lineTo(-bodyX, bodyY1).closePath();
    if (hole) s.holes.push(holePath((x, y) => [x, y]));
    moving.add('leaf', slab(s, ZE0 - zb0, { bevel: 0.003, segs: 3 }), L(0, 0, zb0));
  }

  // ---- faces
  const mirrorParts = [];
  const faces = [
    { d: ext, side: 'ext', sgn: -1, Wf: Wp, Hf: Hp, yb: ybE, m: L(xhE, ybE, ZE0), skin: 'leaf', toS: (x, y) => [x - xhE, y - ybE] },
    { d: int, side: 'int', sgn: 1, Wf: WpI, Hf: HpI, yb: ybI, m: L(xhI, ybI, zb0).multiply(M(0, 0, 0, 0, Math.PI, 0)), skin: 'inner', toS: (x, y) => [xhI - x, y - ybI] },
  ];
  for (const f of faces) {
    const S = (u, v) => [f.sgn * u * f.Wf, v * f.Hf];
    const fb = new Batch();
    // steel skin (the leaf colour shows in grooves and gaps)
    const sk = new THREE.Shape();
    const [a0, b0] = [S(0, 0), S(1, 1)];
    sk.moveTo(Math.min(a0[0], b0[0]), 0).lineTo(Math.max(a0[0], b0[0]), 0).lineTo(Math.max(a0[0], b0[0]), f.Hf).lineTo(Math.min(a0[0], b0[0]), f.Hf).closePath();
    if (hole) sk.holes.push(holePath(f.toS));
    fb.add(f.skin, slab(sk, TS, { bevel: 0.0014, segs: 2 })); // bent steel edge, ~2 mm radius
    let top = TS;
    for (const r of f.d.regions) {
      let pts = r.pts.map(([u, v]) => S(u, v));
      if (r.inset) pts = insetTriangle(pts, r.inset);
      const g = slab(polyShape(pts), r.t, { bevel: r.bevel ?? 0.0022, segs: 3, curveSegments: 4 });
      if (r.mat === 'mirror') {
        // planar mirror: own mesh, reflective face on its local z = 0
        g.translate(0, 0, -r.t);
        mirrorParts.push({ geo: g, m: f.m.clone().multiply(M(0, 0, TS + (r.lift || 0) + r.t)) });
      } else fb.add(r.mat, g, M(0, 0, TS + (r.lift || 0)));
      top = Math.max(top, TS + r.t);
    }
    for (const st of f.d.strips || []) {
      const [x0, y0] = S(...st.a), [x1, y1] = S(...st.b);
      const len = Math.hypot(x1 - x0, y1 - y0);
      fb.add(st.mat, box(len, st.w, st.t, { round: Math.min(0.0015, st.w * 0.3), seg: 2 }), M((x0 + x1) / 2, (y0 + y1) / 2, TS + (st.lift || 0) + st.t / 2, 0, 0, Math.atan2(y1 - y0, x1 - x0)));
    }
    if (f.d.decor) f.d.decor(decorApi(fb, S, f.skin, hole && ((x, y) => f.toS(x, y)), hole));
    // hardware sits on the face surface
    const at = (e, y, u) => {
      const px = u != null ? u * f.Wf : f.Wf - e;
      return M(f.sgn * px, y - f.yb, top + 0.0002);
    };
    mountHardware(fb, f.d.hw || [], look, at, f.side === 'ext' ? 1 : -1, f.side === 'int');
    moving.merge(fb, f.m);
  }

  // ---- glazing and forged grille (ДИНО)
  if (hole) glazing(moving, hole, { ax, az, zFront: ZE0 + TS, zBack: zb0 });

  // ---- leaf edge: lock faceplate with bolts, anti-removal pins, thermal break, leaf seal
  {
    const xl = -bodyX; // lock edge
    // edge frame: plate on the edge plane, facing out of the lock edge; local x → towards the exterior face
    const edgeM = (y) => L(xl, y, zc).multiply(basis([0, 0, 1], [0, 1, 0], [-1, 0, 0]));
    for (const p of plates) moving.merge(lockFaceplate(p.rel.latch != null ? 'latch' : 'bolts', p.len, p.rel), edgeM(p.c));
    // anti-removal pins: hardened conical pins on a pressed collar
    for (const y of [0.32, 1.0, 1.68]) {
      const pin = lathe([[0, 0], [0.0095, 0], [0.0095, 0.0015], [0.0072, 0.002], [0.0072, 0.0105], [0.0055, 0.0135], [0, 0.0138]], 32);
      moving.add('steel', pin, L(bodyX, y, zc).multiply(basis([0, 0, -1], [0, 1, 0], [1, 0, 0])));
    }
    if (look.thermo) {
      for (const sx of [-1, 1]) moving.add('thermo', box(0.0012, bodyY1 - bodyY0 - 0.01, 0.008), L(sx * (bodyX + 0.0005), (bodyY0 + bodyY1) / 2, zc + 0.012));
      moving.add('thermo', box(bodyX * 2 - 0.01, 0.0012, 0.008), L(0, bodyY1 + 0.0005, zc + 0.012));
    }
    const zs = zb0 + 0.006 - az, r = 0.0035, e = bodyX + 0.0012;
    moving.add('rubber', pipe([[-ax, bodyY0 - 0.0012, zs], [e - ax, bodyY0 - 0.0012, zs], [e - ax, bodyY1 + 0.0012, zs], [-e - ax, bodyY1 + 0.0012, zs], [-e - ax, bodyY0 - 0.0012, zs], [-ax, bodyY0 - 0.0012, zs]], r, { bend: 0.006, radial: 8 }));
  }

  // ---- frame
  const jamb = [[0, -D], [FW + LIP, -D], [FW + LIP, -D + LIP], [FW, -D + LIP], [FW, -0.0015], [FW - 0.0015, 0], [0, 0]];
  const jg = prism(jamb, H, { miterEnd: 1 });
  fixed.add('frame', placed(jg.clone(), basis([1, 0, 0], [0, 1, 0], [0, 0, 1], [-W / 2, 0, 0])));
  fixed.add('frame', placed(jg, basis([-1, 0, 0], [0, 1, 0], [0, 0, 1], [W / 2, 0, 0])));
  fixed.add('frame', placed(prism(jamb, W, { miterStart: 1, miterEnd: 1 }), basis([0, -1, 0], [1, 0, 0], [0, 0, 1], [-W / 2, H, 0])));
  const thr = [[0, -D], [FB, -D], [FB, -0.0015], [FB - 0.0015, 0], [0, 0]];
  fixed.add('frame', placed(prism(thr, W - 2 * FW), basis([0, 1, 0], [1, 0, 0], [0, 0, 1], [-W / 2 + FW, 0, 0])));
  if (look.threshold) {
    fixed.add('steel', box(W - 2 * FW, 0.0015, D - 0.004, { round: 0.0006 }), M(0, FB + 0.00075, -D / 2 - 0.001));
    fixed.add('steel', box(W - 2 * FW, FB - 0.004, 0.0015, { round: 0.0006 }), M(0, FB / 2 + 0.001, 0.0008));
  }
  // seal contours: frame face (always), inner stop lip (3-contour doors)
  {
    const a = FW - 0.0062, z = 0.0016, yb = FB - 0.0062, r = 0.0034;
    fixed.add('rubber', pipe([[0, yb, z], [W / 2 - a, yb, z], [W / 2 - a, H - a, z], [-W / 2 + a, H - a, z], [-W / 2 + a, yb, z], [0, yb, z]], r, { bend: 0.006, radial: 8 }));
    if (look.contours >= 3) {
      const a2 = FW + LIP * 0.45, z2 = -D + LIP + 0.0028;
      fixed.add('rubber', pipe([[0, FB + 0.004, z2], [W / 2 - a2, FB + 0.004, z2], [W / 2 - a2, H - a2, z2], [-W / 2 + a2, H - a2, z2], [-W / 2 + a2, FB + 0.004, z2], [0, FB + 0.004, z2]], r, { bend: 0.006, radial: 8 }));
    }
    if (look.thermo) for (const sx of [-1, 1]) fixed.add('thermo', box(0.0012, H - FW - FB, 0.008), M(sx * (W / 2 - FW - 0.0004), (H - FW + FB) / 2, -D / 2));
  }
  // strike plates on the lock jamb (openings match the bolts), sockets for the anti-removal pins
  const strikeM = (y) => M(-W / 2 + FW, y, zc).multiply(basis([0, 0, -1], [0, 1, 0], [1, 0, 0]));
  for (const p of plates) fixed.merge(strikePlate(p.len, p.rel), strikeM(p.c));
  for (const y of [0.32, 1.0, 1.68]) {
    const sm = M(W / 2 - FW, y, zc).multiply(basis([0, 0, 1], [0, 1, 0], [-1, 0, 0]));
    fixed.add('steel', new THREE.RingGeometry(0.0085, 0.0118, 32), sm.clone().multiply(M(0, 0, 0.0004)));
    fixed.add('hwDark', new THREE.CircleGeometry(0.0086, 32), sm.clone().multiply(M(0, 0, 0.0002)));
  }

  // ---- barrel hinges: lower knuckle on the frame, upper on the leaf
  for (const y of [0.24, H - 0.52, H - 0.24]) {
    fixed.add('frame', knuckle(0.062), M(ax, y - 0.064, az));
    moving.add('leaf', knuckle(0.062), M(0, y, 0));
  }

  // ---- classic portal: fluted pilasters and cornice (ДИНО: «фигурные наличники, капитель»)
  let decorW = W, decorH = H;
  if (look.glass) {
    const p = portal(fixed, W, H);
    decorW = p.w;
    decorH = p.h;
  }

  const group = new THREE.Group();
  group.add(fixed.build(mats));
  const leaf = new THREE.Group();
  leaf.position.set(ax, 0, az);
  leaf.add(moving.build(mats));
  group.add(leaf);
  if (cfg.hand === 'left') group.scale.x = -1;
  const mirrors = mirrorParts.map(({ geo, m }) => {
    const mesh = new Mirror(geo);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(m);
    leaf.add(mesh);
    return mesh;
  });
  return {
    group,
    leaf,
    mirrors,
    W, H, D, decorW, decorH,
    maxOpen: MAX_OPEN,
    setOpen: (k) => (leaf.rotation.y = Math.max(0, Math.min(1, k)) * MAX_OPEN),
    lockPoint: new THREE.Vector3(cfg.hand === 'left' ? W / 2 : -W / 2, 1.0, 0),
    lockEdge: new THREE.Vector3(-bodyX - ax, 1.1, zc - az), // leaf-local, for the «торец» view
    hingeSign: cfg.hand === 'left' ? -1 : 1,
  };
}

/**
 * Lock bodies behind the hardware: the lock nearest to the lever carries the spring latch (at the lever
 * height) and two bolts, any other lock throws three bolts. Returns faceplates { c, len, rel: { bolts, latch } }.
 */
function lockPlates(hw) {
  const lever = hw.find((i) => i.type === 'lever');
  const locks = [...new Set(hw.filter((i) => (i.type === 'cylinder' || i.type === 'keyhole') && i.u == null).map((i) => i.y))].sort((a, b) => a - b);
  const near = lever && locks.length ? locks.reduce((a, b) => (Math.abs(b - lever.y) < Math.abs(a - lever.y) ? b : a)) : null;
  return locks.map((y) => {
    if (y === near) {
      const dir = y < lever.y ? -1 : 1;
      const bolts = [y, y + dir * 0.04];
      // the strike plate carries the eccentric keeper beyond the latch opening: extra length on that end
      const lo = Math.min(Math.min(...bolts) - 0.042, lever.y - (dir > 0 ? 0.06 : 0.042));
      const hi = Math.max(Math.max(...bolts) + 0.042, lever.y + (dir < 0 ? 0.06 : 0.042));
      const c = (lo + hi) / 2;
      return { c, len: hi - lo, rel: { bolts: bolts.map((b) => b - c), latch: lever.y - c } };
    }
    return { c: y, len: 0.21, rel: { bolts: [-0.056, 0, 0.056] } };
  });
}

/** Shrinks a triangle so every edge moves inwards by d (incentre scaling). */
function insetTriangle(t, d) {
  if (t.length !== 3) return t;
  const [A, B, C] = t;
  const a = Math.hypot(B[0] - C[0], B[1] - C[1]), b = Math.hypot(A[0] - C[0], A[1] - C[1]), c = Math.hypot(A[0] - B[0], A[1] - B[1]);
  const p = a + b + c;
  const I = [(a * A[0] + b * B[0] + c * C[0]) / p, (a * A[1] + b * B[1] + c * C[1]) / p];
  const area = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
  const r = (2 * area) / p;
  const k = Math.max(0.1, (r - d) / r);
  return t.map(([x, y]) => [I[0] + (x - I[0]) * k, I[1] + (y - I[1]) * k]);
}

// ---------------------------------------------------------------- face decor (ДИНО)
function decorApi(fb, S, mat, toS, hole) {
  // mouldings are in the face colour; the ones round the glass follow the real opening of this face
  const R = (u0, v0, u1, v1) => {
    const a = S(u0, v0), b = S(u1, v1);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])];
  };
  const holeRect = () => {
    const a = toS(hole.x0, hole.y0), b = toS(hole.x1, hole.y1);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])];
  };
  const PROFILES = {
    // applied panel moulding, 32 × 11 mm
    field: [[0.016, 0], [0.016, 0.0028], [0.0135, 0.0042], [0.012, 0.0062], [0.0085, 0.0098], [0.004, 0.011], [-0.001, 0.0108], [-0.0055, 0.0088], [-0.009, 0.0062], [-0.0125, 0.0035], [-0.016, 0.0022], [-0.016, 0]],
    // bolection round the glass, steps down into the opening
    bolection: [[0.026, 0], [0.026, 0.003], [0.021, 0.0052], [0.016, 0.0098], [0.01, 0.0122], [0.005, 0.0116], [0.0015, 0.009], [0, 0.005], [0, -0.02]],
  };
  // horizontal ledges (path runs +x, so +s is downwards): cornice cap, window sill, plinth
  const LEDGES = {
    cap: [[0.035, 0], [0.035, 0.004], [0.03, 0.006], [0.022, 0.0095], [0.013, 0.017], [0.004, 0.024], [-0.008, 0.029], [-0.02, 0.031], [-0.027, 0.03], [-0.031, 0.026], [-0.035, 0.018], [-0.035, 0]],
    sill: [[0.02, 0], [0.02, 0.006], [0.017, 0.012], [0.012, 0.022], [0.007, 0.029], [0.002, 0.033], [-0.016, 0.033], [-0.019, 0.03], [-0.021, 0.022], [-0.021, 0]],
    base: [[0.03, 0], [0.03, 0.011], [0.027, 0.015], [0.021, 0.018], [-0.012, 0.018], [-0.018, 0.015], [-0.024, 0.009], [-0.03, 0.004], [-0.03, 0]],
  };
  let lift = 0; // raised surround under the bolection
  return {
    surround(u0, v0, u1, v1) {
      const [x, y, w, h] = R(u0, v0, u1, v1);
      const s = roundRect(w, h, 0.003, x + w / 2, y + h / 2);
      if (hole) {
        const [hx, hy, hw, hh] = holeRect();
        s.holes.push(new THREE.Path().moveTo(hx, hy).lineTo(hx, hy + hh).lineTo(hx + hw, hy + hh).lineTo(hx + hw, hy).closePath());
      }
      lift = 0.008;
      fb.add(mat, slab(s, lift, { bevel: 0.0035, segs: 3 }), M(0, 0, TS));
    },
    moulding(u0, v0, u1, v1, kind) {
      const [x, y, w, h] = kind === 'bolection' && hole ? holeRect() : R(u0, v0, u1, v1);
      fb.add(mat, sweep(PROFILES[kind], rectPath(x, y, w, h), { closed: true }), M(0, 0, TS + (kind === 'bolection' ? lift : 0)));
    },
    ledge(u0, u1, v, kind) {
      const a = S(u0, v), b = S(u1, v);
      const [p0, p1] = a[0] < b[0] ? [a, b] : [b, a];
      fb.add(mat, sweep(LEDGES[kind], [p0, p1], { closed: false }), M(0, 0, TS));
    },
    raised(u0, v0, u1, v1) {
      const [x, y, w, h] = R(u0, v0, u1, v1);
      fb.add(mat, slab(roundRect(w, h, 0.004, x + w / 2, y + h / 2), 0.013, { bevel: 0.024, segs: 3 }), M(0, 0, TS));
      fb.add(mat, slab(roundRect(w - 0.07, h - 0.07, 0.002, x + w / 2, y + h / 2), 0.0035, { bevel: 0.0015, segs: 2 }), M(0, 0, TS + 0.012));
    },
    corbel(u, v) {
      // console bracket hanging under the sill: abacus, fluted body, drop
      const [x, y] = S(u, v);
      fb.add(mat, box(0.07, 0.016, 0.03, { round: 0.003, seg: 2 }), M(x, y + 0.042, TS + 0.015));
      fb.add(mat, box(0.058, 0.07, 0.022, { round: 0.003, seg: 2 }), M(x, y, TS + 0.011));
      for (const dx of [-0.015, 0, 0.015]) fb.add('hwDark', box(0.0045, 0.05, 0.0012), M(x + dx, y + 0.002, TS + 0.0218));
      fb.add(mat, box(0.046, 0.016, 0.016, { round: 0.003, seg: 2 }), M(x, y - 0.042, TS + 0.008));
    },
  };
}

function glazing(b, h, { ax, az, zFront, zBack }) {
  const w = h.x1 - h.x0, ht = h.y1 - h.y0, cx = (h.x0 + h.x1) / 2 - ax, cy = (h.y0 + h.y1) / 2;
  // insulated glass unit: two panes and the dark spacer frame
  for (const z of [zFront - 0.012, zBack + 0.012]) {
    b.add('glass', new THREE.PlaneGeometry(w, ht), M(cx, cy, z - az));
    for (const [sx, sy, gw, gh] of [[0, 1, w, 0.01], [0, -1, w, 0.01], [1, 0, 0.01, ht], [-1, 0, 0.01, ht]])
      b.add('hwDark', box(gw, gh, 0.004), M(cx + (sx * (w - 0.01)) / 2, cy + (sy * (ht - 0.01)) / 2, z - az + (z > zBack + 0.02 ? -0.003 : 0.003)));
  }
  // forged grille as on the photo: straight flat bars in a diamond lattice, rings at the nodes, small
  // upright lozenges between the rings of a row
  const gz = zFront + 0.006 - az, ix = 0.008;
  const gw = w - ix * 2, gh = ht - ix * 2, x0 = cx - gw / 2, y0 = cy + gh / 2; // y measured down from the top
  const P = (u, t) => [x0 + u * gw, y0 - t * gh];
  const du = 0.17, dt = 0.265, s = du / dt; // lattice step (fractions of the glass)
  const bar = (a, c, wid = 0.0065) => {
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (len < 1e-4) return;
    b.add('grille', box(len + 0.002, wid, 0.009, { round: 0.0012, seg: 2 }), M((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, gz, 0, 0, Math.atan2(c[1] - a[1], c[0] - a[0])));
  };
  // clip the line u = u0 + sgn * s * (t - t0) to the glass
  for (const sgn of [1, -1])
    for (let k = -4; k <= 4; k++) {
      const u0 = 0.33 + k * 2 * du, t0 = 0.23;
      let ta = 0, tb = 1;
      const uAt = (t) => u0 + sgn * s * (t - t0);
      // restrict to 0 <= u <= 1
      const tu0 = t0 + (0 - u0) / (sgn * s), tu1 = t0 + (1 - u0) / (sgn * s);
      ta = Math.max(ta, Math.min(tu0, tu1));
      tb = Math.min(tb, Math.max(tu0, tu1));
      if (tb - ta > 0.01) bar(P(uAt(ta), ta), P(uAt(tb), tb));
    }
  const ring = (u, t, r) => {
    const g = new THREE.TorusGeometry(r, 0.0034, 12, 40);
    b.add('grille', g, M(...P(u, t), gz));
  };
  for (const [t, us] of [[0.23, [0.33, 0.66]], [0.495, [0.16, 0.5, 0.83]], [0.76, [0.33, 0.66]]]) for (const u of us) ring(u, t, 0.016);
  for (const [u, t] of [[0.5, 0.23], [0.5, 0.76], [0.33, 0.495], [0.66, 0.495]]) {
    const hw = 0.05, hh = 0.078;
    const pts = [P(u, t - hh), P(u + hw, t), P(u, t + hh), P(u - hw, t)];
    for (let i = 0; i < 4; i++) bar(pts[i], pts[(i + 1) % 4], 0.0055);
  }
  for (const [sx, sy, bw, bh] of [[0, 1, w, 0.014], [0, -1, w, 0.014], [1, 0, 0.014, ht], [-1, 0, 0.014, ht]])
    b.add('grille', box(bw, bh, 0.01, { round: 0.002 }), M(cx + (sx * (w - 0.014)) / 2, cy + (sy * (ht - 0.014)) / 2, gz));
}

function portal(b, W, H) {
  const pw = 0.12, pd = 0.032, ov = 0.015;
  const flutes = 5, fr = 0.006;
  const sec = [[-pw / 2, 0], [pw / 2, 0], [pw / 2, pd]];
  const span = pw - 0.026;
  for (let i = flutes - 1; i >= 0; i--) {
    const cx = -span / 2 + ((i + 0.5) * span) / flutes;
    sec.push([cx + fr + 0.0018, pd]);
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * Math.PI;
      sec.push([cx + Math.cos(a) * fr, pd - Math.sin(a) * fr * 0.8]);
    }
    sec.push([cx - fr - 0.0018, pd]);
  }
  sec.push([-pw / 2, pd]);
  const clean = sec.filter((p, i) => i === 0 || Math.hypot(p[0] - sec[i - 1][0], p[1] - sec[i - 1][1]) > 1e-5);
  const plinth = 0.15, capH = 0.075, top = H + 0.03;
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + pw / 2 - ov);
    b.add('frame', prism(clean, top - plinth - capH), M(x, plinth, 0));
    b.add('frame', box(pw + 0.024, plinth, pd + 0.014, { round: 0.003, seg: 2 }), M(x, plinth / 2, (pd + 0.014) / 2));
    b.add('frame', box(pw + 0.012, 0.014, pd + 0.008, { round: 0.003, seg: 2 }), M(x, plinth + 0.007, (pd + 0.008) / 2));
    b.add('frame', box(pw + 0.02, capH - 0.02, pd + 0.012, { round: 0.003, seg: 2 }), M(x, top - capH + 0.02 + (capH - 0.02) / 2, (pd + 0.012) / 2));
    b.add('frame', box(pw + 0.012, 0.02, pd + 0.006, { round: 0.004, seg: 2 }), M(x, top - capH + 0.01, (pd + 0.006) / 2));
  }
  // frieze between the pilaster capitals
  b.add('frame', box(W + 2 * (pw - ov), top - H + 0.01, 0.03, { round: 0.002 }), M(0, (H + top) / 2 - 0.005, 0.015));
  // cornice: front run and two returns, mitred
  const zf = 0.1;
  const prof = [[0.1, 0], [0.058, 0], [0.058, 0.032], [0.052, 0.037], [0.05, 0.052]];
  for (let k = 1; k <= 8; k++) {
    const a = (k / 8) * (Math.PI / 2);
    prof.push([0.05 - Math.sin(a) * 0.036, 0.052 + (1 - Math.cos(a)) * 0.046]);
  }
  prof.push([0.009, 0.104], [0.004, 0.108], [0.0, 0.112], [0.0, 0.142], [0.004, 0.147], [0.012, 0.152], [0.022, 0.158], [0.022, 0.165], [0.1, 0.165]);
  const sec2 = prof.slice().reverse().map(([x, z]) => [x, z]);
  const Lc = W + 2 * (pw - ov) + 0.07, y0 = top;
  b.add('frame', placed(prism(sec2, Lc, { miterStart: 1, miterEnd: 1 }), basis([0, 0, -1], [-1, 0, 0], [0, 1, 0], [Lc / 2, y0, zf])));
  b.add('frame', placed(prism(sec2, zf, { miterEnd: 1 }), basis([-1, 0, 0], [0, 0, 1], [0, 1, 0], [Lc / 2, y0, 0])));
  b.add('frame', placed(prism(sec2, zf, { miterStart: 1 }), basis([1, 0, 0], [0, 0, -1], [0, 1, 0], [-Lc / 2, y0, zf])));
  return { w: Lc, h: y0 + 0.165 };
}
