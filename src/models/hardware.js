// Door hardware, modelled at true size (metres). Every builder works in a face frame: the door face
// is the plane z = 0, the part sticks out along +z, x runs to the right as seen from that side and
// `h` (+1 / -1) is the direction towards the hinges. Material keys:
//   hw — main finish, hwDark — recesses and keyways, cyl — cylinder plug, lens — peephole glass.
import * as THREE from 'three';
import { Batch, M, box, slab, roundRect, roundRectPath, lathe, curveTube } from '../geom.js';

// ---------------------------------------------------------------- escutcheons
/** Plate outline: 'rect' (броненакладка прямоугольная), 'square', 'round'. */
function plateShape(kind, w, h, hole) {
  const s = kind === 'round' ? new THREE.Shape().absarc(0, 0, w / 2, 0, Math.PI * 2) : roundRect(w, h, kind === 'square' ? 0.007 : 0.006);
  if (hole) s.holes.push(hole);
  return s;
}

/** Keyhole of a lever (сувальдный) lock: a round bit hole above a slot. */
function keyholePath(scale = 1) {
  const p = new THREE.Path();
  const r = 0.0042 * scale, sw = 0.0018 * scale, sl = 0.011 * scale;
  const a = Math.asin(sw / r);
  p.absarc(0, 0.004 * scale, r, -Math.PI / 2 + a, Math.PI * 1.5 - a, false);
  p.lineTo(-sw, 0.004 * scale - sl);
  p.lineTo(sw, 0.004 * scale - sl);
  p.closePath();
  return p;
}

/** Armoured cylinder escutcheon with the cylinder face and keyway (outside). */
export function cylinderPlate(kind) {
  const b = new Batch();
  const [w, h, d] = kind === 'rect' ? [0.042, 0.078, 0.014] : kind === 'square' ? [0.05, 0.05, 0.013] : [0.058, 0.058, 0.016];
  if (kind === 'round') {
    b.add('hw', lathe([[0, 0], [0.029, 0], [0.029, 0.003], [0.0275, 0.008], [0.023, 0.0135], [0.016, 0.016], [0.0105, 0.0162], [0.0105, 0.0155], [0, 0.0155]], 64));
  } else {
    b.add('hw', slab(plateShape(kind, w, h, new THREE.Path().absarc(0, 0, 0.0105, 0, Math.PI * 2, true)), d, { bevel: 0.004, segs: 4, curveSegments: 16 }));
    b.add('hwDark', lathe([[0, 0], [0.0108, 0], [0.0108, d - 0.001], [0, d - 0.001]], 40));
  }
  // cylinder plug: ring + face, keyway slot (profile cylinder)
  const top = kind === 'round' ? 0.0155 : d;
  b.add('cyl', lathe([[0, 0], [0.0095, 0], [0.0095, top + 0.0012], [0.0088, top + 0.0022], [0, top + 0.0022]], 40));
  b.add('hwDark', box(0.0024, 0.0115, 0.002), M(0, -0.0005, top + 0.0018));
  b.add('hwDark', box(0.0046, 0.0024, 0.002), M(0.0008, 0.0036, top + 0.0018));
  return b;
}

/** Thumb-turn of the cylinder lock (inside, «ключ-поворотник»). */
export function thumbTurn(kind) {
  const b = new Batch();
  if (kind === 'round') b.add('hw', lathe([[0, 0], [0.026, 0], [0.026, 0.003], [0.023, 0.008], [0.012, 0.0105], [0, 0.0105]], 56));
  else b.add('hw', slab(plateShape(kind, kind === 'rect' ? 0.04 : 0.046, kind === 'rect' ? 0.07 : 0.046), 0.009, { bevel: 0.003, segs: 3 }));
  const base = kind === 'round' ? 0.0105 : 0.009;
  b.add('hw', lathe([[0, 0], [0.0095, 0], [0.0095, 0.006], [0.008, 0.008], [0, 0.008]], 32), M(0, 0, base));
  b.add('hw', box(0.009, 0.032, 0.018, { round: 0.0035, seg: 3 }), M(0, 0, base + 0.016));
  return b;
}

/** Decorative plate with the keyhole of the lever (сувальдный) lock. */
export function keyholePlate(kind, inside = false) {
  const b = new Batch();
  const hole = keyholePath(kind === 'round' ? 1 : 1.05);
  const [w, h] = kind === 'rect' ? [0.034, 0.068] : kind === 'square' ? [0.046, 0.046] : [0.048, 0.048];
  b.add('hw', slab(plateShape(kind, w, h, hole), 0.0045, { bevel: 0.0016, segs: 3, curveSegments: 20 }));
  b.add('hwDark', new THREE.CircleGeometry(0.012, 24), M(0, 0, 0.0008));
  if (inside) b.add('hwDark', box(0.006, 0.02, 0.0004), M(0, -0.004, 0.0006));
  return b;
}

// ---------------------------------------------------------------- handles
/** Lever handle on a rosette. style: 'modern' (square section) | 'classic' (Армадилло). */
export function lever(style, kind, h) {
  const b = new Batch();
  if (style === 'classic') {
    b.add('hw', lathe([[0, 0], [0.03, 0], [0.03, 0.002], [0.0285, 0.005], [0.026, 0.0065], [0.0245, 0.0085], [0.019, 0.011], [0.012, 0.0125], [0.0095, 0.0128], [0, 0.0128]], 72));
    b.add('hw', lathe([[0, 0], [0.0085, 0], [0.0085, 0.02], [0.0105, 0.026], [0.0105, 0.03], [0, 0.03]], 32), M(0, 0, 0.0128));
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0.034),
      new THREE.Vector3(h * 0.012, 0, 0.056),
      new THREE.Vector3(h * 0.05, -0.003, 0.064),
      new THREE.Vector3(h * 0.1, -0.011, 0.06),
      new THREE.Vector3(h * 0.128, -0.016, 0.054),
    ]);
    const g = curveTube(c, 0.0068, 64, 14);
    b.add('hw', g);
    b.add('hw', new THREE.SphereGeometry(0.0102, 24, 16), M(h * 0.129, -0.0165, 0.054, 0, 0, 0, [1.1, 1, 0.9]));
    b.add('hw', new THREE.SphereGeometry(0.0105, 24, 16), M(0, 0, 0.036));
    return b;
  }
  // modern: rounded square rosette, short round neck, square-section lever ending in a soft radius
  if (kind === 'round') b.add('hw', lathe([[0, 0], [0.026, 0], [0.026, 0.003], [0.024, 0.008], [0, 0.009]], 56));
  else b.add('hw', slab(roundRect(0.052, 0.052, 0.008), 0.009, { bevel: 0.0028, segs: 3 }));
  b.add('hw', lathe([[0, 0], [0.0088, 0], [0.0088, 0.04], [0, 0.04]], 32), M(0, 0, 0.008));
  b.add('hw', box(0.026, 0.02, 0.024, { round: 0.0055, seg: 4 }), M(h * 0.003, 0, 0.055));
  b.add('hw', box(0.128, 0.0185, 0.0125, { round: 0.0055, seg: 4 }), M(h * 0.066, 0, 0.0585));
  return b;
}

/** Pull bar (ручка-скоба). Horizontal classic bar with rosettes, or a vertical flat modern bar. */
export function pullBar(style, len) {
  const b = new Batch();
  if (style === 'classic') {
    for (const s of [-1, 1]) {
      b.add('hw', lathe([[0, 0], [0.022, 0], [0.022, 0.003], [0.019, 0.007], [0.012, 0.009], [0, 0.009]], 48), M((s * len) / 2, 0, 0));
      b.add('hw', lathe([[0, 0], [0.0075, 0], [0.0062, 0.02], [0.009, 0.034], [0, 0.036]], 32), M((s * len) / 2, 0, 0.009));
      b.add('hw', new THREE.SphereGeometry(0.0105, 20, 14), M((s * len) / 2, 0, 0.045));
    }
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-len / 2, 0, 0.045),
      new THREE.Vector3(-len / 4, -0.004, 0.047),
      new THREE.Vector3(0, -0.005, 0.048),
      new THREE.Vector3(len / 4, -0.004, 0.047),
      new THREE.Vector3(len / 2, 0, 0.045),
    ]);
    b.add('hw', curveTube(c, 0.0085, 64, 16));
    return b;
  }
  for (const s of [-1, 1]) b.add('hw', box(0.014, 0.02, 0.04, { round: 0.004, seg: 3 }), M(0, (s * (len - 0.06)) / 2, 0.02));
  b.add('hw', box(0.024, len, 0.012, { round: 0.005, seg: 4 }), M(0, 0, 0.046));
  return b;
}

// ---------------------------------------------------------------- small parts
/**
 * Wide-angle door viewer. Outside: a domed bezel in the hardware finish with a polished chrome ring round a
 * convex fisheye lens. Inside: the eyepiece with a knurled grip ring and a recessed lens.
 */
export function peephole(inside) {
  const b = new Batch();
  if (inside) {
    // flange, knurled body, chrome lip, deep lens
    b.add('hw', lathe([[0, 0], [0.0175, 0], [0.0175, 0.0012], [0.0168, 0.0025], [0.0135, 0.003], [0, 0.003]], 64));
    const knurl = [];
    for (let i = 0; i <= 24; i++) knurl.push([0.0118 + (i % 2 ? 0.0006 : 0), 0.003 + (i / 24) * 0.0105]);
    b.add('hw', lathe([[0, 0.003], ...knurl, [0.0112, 0.0138], [0.0098, 0.0146], [0, 0.0146]], 72));
    b.add('chrome', lathe([[0.0062, 0.0141], [0.0094, 0.0141], [0.0094, 0.0152], [0.0084, 0.0158], [0.0062, 0.0158]], 48));
    b.add('hwDark', new THREE.CircleGeometry(0.0062, 32), M(0, 0, 0.0128));
    b.add('lens', new THREE.SphereGeometry(0.0058, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0, 0, 0.0131, Math.PI / 2, 0, 0, [1, 0.22, 1]));
    return b;
  }
  // exterior: low dome in the hardware finish, chrome bezel ring, glass fisheye
  b.add('hw', lathe([[0, 0], [0.0145, 0], [0.0145, 0.0012], [0.0138, 0.0032], [0.0118, 0.0052], [0.0092, 0.0062], [0.0078, 0.0063], [0.0078, 0.0058], [0, 0.0058]], 72));
  b.add('chrome', lathe([[0.0056, 0.0056], [0.0081, 0.0056], [0.0081, 0.0066], [0.0074, 0.0072], [0.0056, 0.0072]], 48));
  b.add('hwDark', new THREE.CircleGeometry(0.0057, 32), M(0, 0, 0.0058));
  b.add('lens', new THREE.SphereGeometry(0.0062, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), M(0, 0, 0.0059, Math.PI / 2, 0, 0, [0.92, 0.42, 0.92]));
  return b;
}

/** Night latch knob (ночная задвижка). */
export function nightLatch(kind) {
  const b = new Batch();
  if (kind === 'round') b.add('hw', lathe([[0, 0], [0.021, 0], [0.021, 0.0025], [0.018, 0.0065], [0, 0.0075]], 48));
  else b.add('hw', slab(roundRect(0.036, 0.036, 0.006), 0.0075, { bevel: 0.0025, segs: 3 }));
  b.add('hw', box(0.024, 0.009, 0.016, { round: 0.0035, seg: 3 }), M(0, 0, 0.0145));
  return b;
}

/** Barrel hinge knuckle of length len, axis along +Y from y = 0. */
export function knuckle(len, r = 0.0115) {
  const g = lathe([[0, 0], [r * 0.72, 0], [r * 0.97, 0.0018], [r, 0.004], [r, len - 0.004], [r * 0.97, len - 0.0018], [r * 0.72, len], [0, len]], 32);
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * Places a hardware layout on one face. items: [{ type, e (m from the lock edge), y (m), ... }].
 * at(e, y) → THREE.Matrix4 of the face frame at that spot (provided by the door).
 */
export function mountHardware(target, items, look, at, h, inside) {
  const kind = look.plate;
  const style = look.lever || 'modern';
  for (const it of items) {
    let part;
    switch (it.type) {
      case 'cylinder':
        part = inside ? thumbTurn(kind) : cylinderPlate(kind);
        break;
      case 'keyhole':
        part = keyholePlate(kind, inside);
        break;
      case 'lever':
        part = lever(style, kind, h);
        break;
      case 'peephole':
        part = peephole(inside);
        break;
      case 'latch':
        part = nightLatch(kind);
        break;
      case 'pull':
        part = pullBar(it.style || style, it.len || 0.3);
        break;
      default:
        continue;
    }
    target.merge(part, at(it.e, it.y, it.u));
  }
}

// ---------------------------------------------------------------- lock edge and strike side
// Edge frame: the part lies on the plane z = 0 facing +z, x runs across the edge (door thickness), y up.

/** Countersunk screw head with a Phillips recess, flush with a plate. */
function screw(b, x, y, z) {
  b.add('chrome', lathe([[0, 0], [0.0036, 0], [0.0036, 0.0003], [0.0031, 0.0006], [0, 0.0006]], 24), M(x, y, z));
  b.add('hwDark', box(0.0034, 0.0007, 0.0005), M(x, y, z + 0.0005));
  b.add('hwDark', box(0.0007, 0.0034, 0.0005), M(x, y, z + 0.0005));
}

/** Round bolt (ригель) Ø14 mm: chamfered polished end standing `out` proud of the faceplate, dark clearance ring. */
function bolt(b, y, z, out) {
  b.add('hwDark', new THREE.RingGeometry(0.0069, 0.0078, 32), M(0, y, z + 0.0002));
  b.add('chrome', lathe([[0, -0.004], [0.0069, -0.004], [0.0069, out - 0.0012], [0.0061, out], [0, out]], 40), M(0, y, z));
}

/**
 * Lock faceplate on the leaf edge. kind: 'latch' (cylinder lock with a spring latch and two bolts) or
 * 'bolts' (lever lock, three bolts). ys: { bolts: [y...], latch: y } relative to the plate centre.
 */
export function lockFaceplate(kind, len, ys) {
  const b = new Batch();
  const pt = 0.0025;
  b.add('steel', slab(roundRect(0.024, len, 0.0045), pt, { bevel: 0.0007, segs: 2 }));
  screw(b, 0, len / 2 - 0.012, pt);
  screw(b, 0, -len / 2 + 0.012, pt);
  for (const y of ys.bolts) bolt(b, y, pt, 0.0022);
  if (kind === 'latch') {
    // spring latch: square body, bevelled striking face towards the frame
    const ly = ys.latch;
    b.add('hwDark', box(0.0175, 0.029, 0.0004), M(0, ly, pt + 0.0001));
    // 16 mm across the edge, 25 mm tall, 12 mm throw; the bevel leads on the inner side (the leaf closes inwards)
    // shape x → across the edge (+x = exterior), shape y → out of the plate
    const tongue = new THREE.Shape([new THREE.Vector2(-0.008, 0), new THREE.Vector2(0.008, 0), new THREE.Vector2(0.008, 0.0118), new THREE.Vector2(0.002, 0.0118), new THREE.Vector2(-0.008, 0.0035)]);
    const g = slab(tongue, 0.025, { bevel: 0.0007, segs: 2 });
    g.translate(0, 0, -0.0125);
    b.add('chrome', g, M(0, ly, pt, Math.PI / 2, 0, 0));
  }
  return b;
}

/** Strike plate on the frame: openings for the bolts and the latch, adjustable eccentric keeper. */
export function strikePlate(len, ys) {
  const b = new Batch();
  const pt = 0.002;
  const s = roundRect(0.026, len, 0.004);
  const holes = [];
  for (const y of ys.bolts) holes.push([y, 0.0165]);
  if (ys.latch != null) holes.push([ys.latch, 0.031]);
  for (const [y, h] of holes) s.holes.push(roundRectPath(0.0165, h, 0.003, 0, y));
  b.add('steel', slab(s, pt, { bevel: 0.0005, segs: 1 }));
  for (const [y, h] of holes) b.add('hwDark', box(0.016, h, 0.0006), M(0, y, -0.0002));
  screw(b, 0, len / 2 - 0.011, pt);
  screw(b, 0, -len / 2 + 0.011, pt);
  if (ys.latch != null) {
    // eccentric press adjuster on the plate axis, beyond the latch opening (away from the bolts)
    const ey = ys.latch + Math.sign(ys.latch || 1) * 0.033;
    b.add('steel', lathe([[0, 0], [0.0075, 0], [0.0075, 0.0028], [0.0068, 0.0034], [0, 0.0034]], 32), M(0, ey, pt));
    b.add('hwDark', box(0.0095, 0.0012, 0.0006), M(0, ey, pt + 0.0033));
  }
  return b;
}
