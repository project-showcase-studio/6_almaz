// Geometry builders: batching, mitred prisms (door frame), profile sweeps (mouldings, cornice), extrusions.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry } from './materials.js';

// ---------------------------------------------------------------- batching
/**
 * Collects geometries per material key, merges them on build(). Every geometry gets the same set of
 * attributes (position, normal, uv, color) so they can be merged.
 */
export class Batch {
  constructor() {
    this.parts = new Map();
  }
  add(key, geo, matrix) {
    const g = normaliseAttrs(geo.index ? geo.toNonIndexed() : geo);
    if (matrix) g.applyMatrix4(matrix);
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
    return g;
  }
  /** Moves everything collected in `other` into this batch, transformed by `matrix`. */
  merge(other, matrix) {
    for (const [k, geos] of other.parts) for (const g of geos) this.add(k, g, matrix);
    other.parts.clear();
  }
  build(materials, { castShadow = true, receiveShadow = true } = {}) {
    const group = new THREE.Group();
    for (const [key, geos] of this.parts) {
      const mat = materials[key];
      if (!mat) {
        console.warn('no material', key);
        continue;
      }
      const g = mergeGeometries(geos, false);
      geos.forEach((x) => x.dispose());
      // real tangents: screen-space derivative tangents break up into sparkles on narrow eased edges
      const n = g.attributes.position.count;
      g.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(n).map((_, i) => i) : new Uint16Array(n).map((_, i) => i), 1));
      try {
        g.computeTangents();
      } catch (e) {
        /* degenerate UVs: fall back to derivative tangents */
      }
      const m = new THREE.Mesh(g, mat);
      m.name = key;
      m.castShadow = castShadow && !mat.userData.noShadow;
      m.receiveShadow = receiveShadow;
      group.add(m);
    }
    this.parts.clear();
    return group;
  }
}

function normaliseAttrs(g) {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  g.morphAttributes = {};
  g.groups = [];
  return g;
}

// ---------------------------------------------------------------- transforms
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
export function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  const sc = Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, sc);
}

/** Box with metre UVs (rounded edges when round > 0). Centred at the origin. */
export function box(w, h, d, { round = 0, seg = 2 } = {}) {
  const g = round > 0 ? new RoundedBoxGeometry(w, h, d, seg, Math.min(round, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)) : new THREE.BoxGeometry(w, h, d);
  return metreUV(g);
}

/** Planar-projected UVs in metres, projection picked per vertex from the normal. Grain follows the longest axis. */
export function metreUV(g, { grainAxis } = {}) {
  const p = g.attributes.position, n = g.attributes.normal;
  g.computeBoundingBox();
  const s = g.boundingBox.getSize(new THREE.Vector3());
  const ax = grainAxis || (s.x >= s.y && s.x >= s.z ? 'x' : s.y >= s.z ? 'y' : 'z');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let u, v;
    // texture grain runs along image V; map the grain axis to V
    if (nx >= ny && nx >= nz) [u, v] = ax === 'y' ? [z, y] : [y, z];
    else if (ny >= nz) [u, v] = ax === 'x' ? [z, x] : [x, z];
    else [u, v] = ax === 'x' ? [y, x] : [x, y];
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Makes every triangle's winding agree with its vertex normals (non-indexed geometry). */
export function fixWinding(g) {
  const p = g.attributes.position.array, n = g.attributes.normal.array;
  const uvA = g.attributes.uv?.array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3(), vn = new THREE.Vector3(), t = new THREE.Vector3();
  const sw = (arr, stride, base) => {
    for (let k = 0; k < stride; k++) {
      const t1 = arr[base + stride + k];
      arr[base + stride + k] = arr[base + 2 * stride + k];
      arr[base + 2 * stride + k] = t1;
    }
  };
  for (let tri = 0; tri < p.length / 9; tri++) {
    const i = tri * 9;
    a.fromArray(p, i);
    b.fromArray(p, i + 3);
    c.fromArray(p, i + 6);
    fn.subVectors(b, a).cross(t.subVectors(c, a));
    vn.fromArray(n, i).add(t.fromArray(n, i + 3)).add(t.fromArray(n, i + 6));
    if (fn.dot(vn) < 0) {
      sw(p, 3, i);
      sw(n, 3, i);
      if (uvA) sw(uvA, 2, tri * 6);
    }
  }
  return g;
}

// ---------------------------------------------------------------- profiles
/** Normals of a 2D polyline profile: smooth across gentle bends, split at corners sharper than `crease`. */
function profileFrame(P, closed, crease = 0.6) {
  const n = P.length;
  const edges = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = P[i], b = P[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    edges.push({ a: i, b: (i + 1) % n, n: [dy / l, -dx / l], len: l });
  }
  // per edge end normals
  for (let e = 0; e < edges.length; e++) {
    const E = edges[e];
    const prev = edges[(e - 1 + edges.length) % edges.length], next = edges[(e + 1) % edges.length];
    const blend = (o, ok) => {
      if (!ok) return E.n;
      const d = E.n[0] * o.n[0] + E.n[1] * o.n[1];
      if (d < Math.cos(crease)) return E.n;
      const x = E.n[0] + o.n[0], y = E.n[1] + o.n[1], l = Math.hypot(x, y);
      return [x / l, y / l];
    };
    E.na = blend(prev, closed || e > 0);
    E.nb = blend(next, closed || e < edges.length - 1);
  }
  return edges;
}

/**
 * Prism along +Y (0..len) from a closed 2D section [[x, z], ...] (counter-clockwise seen from +Y).
 * miterStart / miterEnd: the end faces are cut at 45° so the section point at x = a is shortened by
 * a * miter (1 = mitred door-frame corner, 0 = square cut). x = 0 is the outer edge.
 */
export function prism(section, len, { miterStart = 0, miterEnd = 0, caps = true } = {}) {
  const edges = profileFrame(section, true, 0.5);
  const pos = [], nor = [], uv = [];
  const y0 = (x) => x * miterStart, y1 = (x) => len - x * miterEnd;
  // side faces split along the length: long sliver triangles make derivative-based normal mapping sparkle
  const steps = Math.max(1, Math.ceil(len / 0.12));
  let per = 0;
  for (const E of edges) {
    const pa = section[E.a], pb = section[E.b];
    const ya = (k) => y0(pa[0]) + ((y1(pa[0]) - y0(pa[0])) * k) / steps, yb = (k) => y0(pb[0]) + ((y1(pb[0]) - y0(pb[0])) * k) / steps;
    for (let k = 0; k < steps; k++) {
      const quad = [
        [pa, E.na, ya(k), per], [pb, E.nb, yb(k + 1), per + E.len], [pa, E.na, ya(k + 1), per],
        [pa, E.na, ya(k), per], [pb, E.nb, yb(k), per + E.len], [pb, E.nb, yb(k + 1), per + E.len],
      ];
      for (const [p, n, y, v] of quad) {
        pos.push(p[0], y, p[1]);
        nor.push(n[0], 0, n[1]);
        uv.push(v, y);
      }
    }
    per += E.len;
  }
  if (caps) {
    const tris = THREE.ShapeUtils.triangulateShape(section.map((p) => new THREE.Vector2(p[0], p[1])), []);
    for (const end of [0, 1]) {
      const ny = end ? 1 : -1;
      const nm = new THREE.Vector3(end ? miterEnd : -miterStart, ny, 0).normalize();
      for (const t of tris)
        for (const k of t) {
          const p = section[k];
          pos.push(p[0], end ? y1(p[0]) : y0(p[0]), p[1]);
          nor.push(nm.x, nm.y, nm.z);
          uv.push(p[0], p[1]);
        }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return fixWinding(g);
}

/**
 * Sweeps an open profile [[s, t], ...] along a polyline in the XY plane with mitred corners.
 * s: offset to the right of the path direction (outwards for a counter-clockwise loop), t: height (+Z).
 * Profile order: from the outer foot over the top to the inner foot, so its normals face out.
 * closed: the path is a loop. Open paths get end caps (the profile closed down to t = 0).
 */
export function sweep(profile, path, { closed = false, caps = true } = {}) {
  const edges = profileFrame(profile, false, 0.55);
  const N = path.length;
  const dir = (i) => {
    const a = path[i], b = path[(i + 1) % N];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    return [dx / l, dy / l, l];
  };
  // right-hand normal of each segment, mitre vector at each vertex
  const segs = closed ? N : N - 1;
  const D = [];
  for (let i = 0; i < segs; i++) D.push(dir(i));
  const mitre = [];
  for (let i = 0; i < N; i++) {
    const dp = D[closed ? (i - 1 + segs) % segs : Math.max(0, i - 1)];
    const dn = D[closed ? i % segs : Math.min(segs - 1, i)];
    const np = [dp[1], -dp[0]], nn = [dn[1], -dn[0]];
    let mx = np[0] + nn[0], my = np[1] + nn[1];
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml;
    my /= ml;
    const k = 1 / Math.max(0.2, mx * nn[0] + my * nn[1]);
    mitre.push([mx * k, my * k]);
  }
  const pos = [], nor = [], uv = [];
  let along = 0;
  for (let i = 0; i < segs; i++) {
    const a = path[i], b = path[(i + 1) % N], ma = mitre[i], mb = mitre[(i + 1) % N];
    const sn = [D[i][1], -D[i][0]];
    let per = 0;
    for (const E of edges) {
      const p0 = profile[E.a], p1 = profile[E.b];
      const P = (v, m, p) => [v[0] + m[0] * p[0], v[1] + m[1] * p[0], p[1]];
      const A0 = P(a, ma, p0), A1 = P(a, ma, p1), B0 = P(b, mb, p0), B1 = P(b, mb, p1);
      const n0 = [sn[0] * E.na[0], sn[1] * E.na[0], E.na[1]], n1 = [sn[0] * E.nb[0], sn[1] * E.nb[0], E.nb[1]];
      const q = [
        [A0, n0, along, per], [B0, n0, along + D[i][2], per], [B1, n1, along + D[i][2], per + E.len],
        [A0, n0, along, per], [B1, n1, along + D[i][2], per + E.len], [A1, n1, along, per + E.len],
      ];
      for (const [p, n, u, v] of q) {
        pos.push(...p);
        nor.push(...n);
        uv.push(u, v);
      }
      per += E.len;
    }
    along += D[i][2];
  }
  if (!closed && caps) {
    const ring = [...profile, [profile[profile.length - 1][0], 0], [profile[0][0], 0]];
    const tris = THREE.ShapeUtils.triangulateShape(ring.map((p) => new THREE.Vector2(p[0], p[1])), []);
    for (const end of [0, N - 1]) {
      const d = D[end === 0 ? 0 : segs - 1], m = mitre[end], v = path[end];
      const sgn = end === 0 ? -1 : 1;
      for (const t of tris)
        for (const k of t) {
          const p = ring[k];
          pos.push(v[0] + m[0] * p[0], v[1] + m[1] * p[0], p[1]);
          nor.push(d[0] * sgn, d[1] * sgn, 0);
          uv.push(p[0], p[1]);
        }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return fixWinding(g);
}

/** Counter-clockwise rectangle path (for sweep) with lower-left corner (x, y). */
export const rectPath = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/** Rounded-rectangle THREE.Shape centred on (cx, cy). */
export function roundRect(w, h, r, cx = 0, cy = 0, shape = new THREE.Shape()) {
  r = Math.min(r, w / 2, h / 2);
  const x = cx - w / 2, y = cy - h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

/** Same outline as a THREE.Path (for holes). */
export function roundRectPath(w, h, r, cx = 0, cy = 0) {
  return roundRect(w, h, r, cx, cy, new THREE.Path());
}

/**
 * UVs for extruded panels: faces and bevels share one planar (x, y) field in metres, so the surface texture
 * runs over the eased edge continuously. Depth is folded in so the narrow side walls never sample a single
 * texel row (which smeared texture grains into dashes along the edges).
 */
const SLAB_UV = {
  generateTopUV(geo, v, a, b, c) {
    return [a, b, c].map((i) => new THREE.Vector2(v[i * 3], v[i * 3 + 1]));
  },
  generateSideWallUV(geo, v, a, b, c, d) {
    return [a, b, c, d].map((i) => new THREE.Vector2(v[i * 3] + v[i * 3 + 2] * 0.7, v[i * 3 + 1] + v[i * 3 + 2] * 0.7));
  },
};

/**
 * Rebuilds a shape with long straight edges split into ≤ 25 mm pieces: the eased edge (bevel) of a panel is a
 * strip only ~1.5 mm wide, and strip triangles as long as the whole edge make the normal-mapped highlight
 * break into dashes.
 */
function densify(shape, curveSegments, step = 0.025) {
  const { shape: outer, holes } = shape.extractPoints(curveSegments);
  const dense = (pts) => {
    const out = [];
    const n = pts.length - (pts[0].equals(pts[pts.length - 1]) ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const k = Math.max(1, Math.ceil(a.distanceTo(b) / step));
      for (let j = 0; j < k; j++) out.push(a.clone().lerp(b, j / k));
    }
    return out;
  };
  const s = new THREE.Shape(dense(outer));
  s.holes = holes.map((h) => new THREE.Path(dense(h)));
  return s;
}

/**
 * Extrudes a shape over z = 0..depth with a soft edge bevel that stays inside the outline,
 * so neighbouring pieces form V-grooves (MDF milling) and outer edges read as eased arrises.
 */
export function slab(shape, depth, { bevel = 0.0015, segs = 2, curveSegments = 10 } = {}) {
  const bt = Math.min(bevel, depth * 0.45);
  shape = densify(shape, curveSegments);
  const g = new THREE.ExtrudeGeometry(shape, {
    UVGenerator: SLAB_UV,
    depth: Math.max(1e-4, depth - bt * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bt,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: segs,
    curveSegments,
  });
  if (bevel > 0) g.translate(0, 0, bt);
  return g;
}

/** Shape from a polygon [[x, y], ...]. */
export function polyShape(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

/** Lathe around +Z from a profile [[r, z], ...] (bottom to top). */
export function lathe(profile, segs = 48) {
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(Math.max(r, 1e-5), z)), segs);
  g.rotateX(Math.PI / 2);
  return g;
}

// ---------------------------------------------------------------- tubes
/** Polyline path with rounded corners, as a TubeGeometry (start a loop mid-edge and end at the same point). */
export function pipe(points, radius, { bend = 0.08, radial = 16 } = {}) {
  const P = points.map((p) => new THREE.Vector3(...p));
  const path = new THREE.CurvePath();
  let prev = P[0].clone();
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], c = P[i + 1];
    if (!c) {
      path.add(new THREE.LineCurve3(prev, b.clone()));
      break;
    }
    const d1 = b.clone().sub(a), d2 = c.clone().sub(b);
    const r = Math.min(bend, d1.length() / 2, d2.length() / 2);
    const p1 = b.clone().sub(d1.normalize().multiplyScalar(r));
    const p2 = b.clone().add(d2.normalize().multiplyScalar(r));
    if (prev.distanceTo(p1) > 1e-5) path.add(new THREE.LineCurve3(prev, p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
    prev = p2;
  }
  const len = path.getLength();
  return new THREE.TubeGeometry(path, Math.max(16, Math.ceil(len * 60)), radius, radial, false);
}

/** Smooth tube through a curve (forged grille bars). */
export function curveTube(curve, radius, segs = 64, radial = 10) {
  return new THREE.TubeGeometry(curve, segs, radius, radial, false);
}

export function rng(seed) {
  return mulberry(seed);
}

export { mergeGeometries, RoundedBoxGeometry };
