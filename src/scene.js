// Entrance setting around the door: outside a facade in large light stone slabs, a dark stone surround with a
// brass reveal, a canopy with a walnut soffit and linear light, sconces, a lit porch and step, planted thujas;
// a hallway with herringbone parquet, plaster walls, skirting, door casing and ceiling spots inside. Rebuilt when the door size changes.
import * as THREE from 'three';
import { Batch, M, box, metreUV, sweep, lathe } from './geom.js';
import { surface, emitter, powderCoat, metal, mulberry } from './materials.js';

const WALL = 0.4; // wall thickness: exterior face z = 0, interior face z = -WALL
const ROOM = { x: 2.4, z: 5.2, h: 2.85 };
const GROUND = -0.18;

let mats;
function materials() {
  if (mats) return mats;
  mats = {
    // exterior: warm light marble-look facade slabs, dark stone surround and porch, brass details
    facade: surface('marble_white', { tint: 'stain', color: '#e2d8c8', keep: 0.6, contrast: 0.3, roughness: 0.36, tile: [2.0, 4.0] }),
    portal: surface('stone_grey', { tint: 'stain', color: '#3a3632', keep: 0.45, contrast: 1.15, roughness: 0.36 }),
    porch: surface('stone_grey', { tint: 'stain', color: '#56534f', keep: 0.4, contrast: 0.9, roughness: 0.55, tile: [1.6, 3.2] }),
    grout: new THREE.MeshStandardMaterial({ color: '#1e1d1c', roughness: 0.95, name: 'grout' }),
    brass: metal('brass'),
    number: new THREE.MeshStandardMaterial({ color: '#c9a35a', metalness: 1, roughness: 0.26, map: numberTexture('12'), alphaTest: 0.5, name: 'number' }),
    soil: new THREE.MeshStandardMaterial({ color: '#221a13', roughness: 1, name: 'soil' }),
    mat: new THREE.MeshStandardMaterial({ color: '#2d2925', roughness: 1, name: 'mat' }),
    foliage: (() => {
      const t = foliageTexture();
      return new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 4, roughness: 0.85, name: 'foliage' });
    })(),
    pavers: surface('pavers', { roughness: 0.85 }),
    grass: surface('grass', { roughness: 0.95 }),
    plaster: surface('plaster', { tint: 'paint', color: '#ebe7df', contrast: 0.7, roughness: 0.9 }),
    parquet: surface('parquet', { roughness: 0.42 }),
    // ceiling: the downlights barely reach it, the warm emissive stands in for light bounced off the floor
    ceiling: new THREE.MeshStandardMaterial({ color: '#f6efe4', roughness: 0.92, emissive: '#3b2f22', name: 'ceiling' }),
    trim: new THREE.MeshStandardMaterial({ color: '#f0eee9', roughness: 0.45, name: 'trim' }),
    blackMetal: powderCoat('#1a1b1d', { texture: 'peel', roughness: 0.45 }),
    glow: emitter('#ffd9a8'),
    walnut: surface('walnut', { tint: 'stain', color: '#4a2c1c', keep: 0.5, contrast: 1.6, roughness: 0.45 }),
    ceramic: new THREE.MeshPhysicalMaterial({ color: '#e9e4da', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2, name: 'ceramic' }),
    bookA: new THREE.MeshStandardMaterial({ color: '#7d6a55', roughness: 0.8, name: 'bookA' }),
    bookB: new THREE.MeshStandardMaterial({ color: '#2f3a3e', roughness: 0.8, name: 'bookB' }),
    passe: new THREE.MeshStandardMaterial({ color: '#f3efe8', roughness: 0.9, name: 'passe' }),
    art: new THREE.MeshStandardMaterial({ map: artTexture(), roughness: 0.85, name: 'art' }),
  };
  return mats;
}

/** Abstract print for the hallway: soft colour fields and a few calligraphic strokes (canvas, no assets). */
function artTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 666;
  const g = c.getContext('2d');
  g.fillStyle = '#e8dfd1';
  g.fillRect(0, 0, c.width, c.height);
  const blob = (x, y, r, col, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = a;
    g.fillStyle = gr;
    g.fillRect(0, 0, c.width, c.height);
  };
  blob(300, 380, 420, '#b5643c', 0.75);
  blob(720, 260, 360, '#2f3b40', 0.8);
  blob(560, 520, 300, '#c9a26b', 0.6);
  g.globalAlpha = 0.9;
  g.strokeStyle = '#1d1f20';
  g.lineCap = 'round';
  for (const [w, pts] of [[14, [[180, 520], [380, 300], [520, 360], [760, 140]]], [6, [[600, 560], [700, 470], [880, 500]]]]) {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(...pts[0]);
    for (let i = 1; i < pts.length; i++) g.quadraticCurveTo(pts[i][0] - 60, pts[i][1] + 40, ...pts[i]);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Brass house number: digits on a transparent canvas, used as the map and alpha of a metal plane. */
function numberTexture(text = '12') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 384;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '500 330px "Didot", "Bodoni MT", "Playfair Display", Georgia, serif';
  g.fillText(text, 256, 200);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Dense thuja foliage: overlapping small leaf scales in greens (canvas), used as albedo and bump. */
function foliageTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#16210f';
  g.fillRect(0, 0, 512, 512);
  const r = mulberry(5);
  for (let i = 0; i < 12000; i++) {
    const x = r() * 512, y = r() * 512, l = 2 + r() * 6;
    const k = r();
    g.fillStyle = `hsl(${82 + k * 26}, ${30 + r() * 18}%, ${8 + k * 20}%)`;
    for (const dx of [-512, 0, 512])
      for (const dy of [-512, 0, 512]) {
        g.beginPath();
        g.ellipse(x + dx, y + dy, l, l * 0.45, r() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.5, 1.5);
  t.anisotropy = 8;
  return t;
}

/**
 * Clipped thuja (radius r, height h, base at y = 0): a dark core cone wrapped in overlapping foliage puffs,
 * so the silhouette and the light break up like a real sheared shrub. Returns a list of geometries.
 */
function topiary(r, h, seed) {
  const rad = (t) => r * (t < 0.1 ? 0.7 + 0.3 * Math.sin((t / 0.1) * (Math.PI / 2)) : Math.pow(1 - (t - 0.1) / 0.9, 0.8));
  const prof = [];
  for (let i = 0; i <= 24; i++) prof.push(new THREE.Vector2(Math.max(1e-4, rad(i / 24) * 0.9), (i / 24) * h * 0.97));
  const out = [new THREE.LatheGeometry(prof, 32)];
  const rr = mulberry(seed);
  const n = 230;
  for (let i = 0; i < n; i++) {
    const t = Math.pow(rr(), 0.8) * 0.96, a = rr() * Math.PI * 2;
    const R = rad(t), s = 0.05 + 0.045 * (1 - t) * rr() + 0.02;
    const g = new THREE.IcosahedronGeometry(Math.min(s, R * 0.9 + 0.025), 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (0.9 + rr() * 0.2), p.getY(k) * (0.75 + rr() * 0.2), p.getZ(k) * (0.9 + rr() * 0.2));
    g.computeVertexNormals();
    g.applyMatrix4(M(Math.cos(a) * R * 0.88, t * h, Math.sin(a) * R * 0.88, rr(), rr() * 6, rr()));
    out.push(g);
  }
  return out;
}

/** Horizontal tiles (module m) over x0…x1 × z0…z1, top at yTop + t, open joints. */
function slabsFlat(b, key, x0, x1, z0, z1, m, y0, t, joint) {
  for (let x = x0; x < x1 - 1e-6; x += m)
    for (let z = z0; z < z1 - 1e-6; z += m) {
      const w = Math.min(m, x1 - x) - joint, d = Math.min(m, z1 - z) - joint;
      const g = box(w, t, d, { round: 0.0015, seg: 1 });
      g.applyMatrix4(M(x + joint / 2 + w / 2, y0 + t / 2, z + joint / 2 + d / 2));
      metreUV(g);
      b.add(key, g);
    }
}

/** World-space metre UVs for a box placed by matrix m (so neighbouring wall pieces share one texture field). */
function wbox(b, key, w, h, d, x, y, z, opts) {
  const g = box(w, h, d, opts);
  g.applyMatrix4(M(x, y, z));
  metreUV(g, { grainAxis: 'y' });
  b.add(key, g);
}

/**
 * door: built door ({ W, H, decorW, decorH }). Returns { group, lights, glowMats }.
 */
export function buildEntrance(door) {
  const m = materials();
  const b = new Batch();
  const { W, H } = door;
  const g = 0.006; // opening clearance round the frame
  const ox = W / 2 + g, oy = H + g;
  const FX = 4.6, FY = 3.5; // facade extent

  // ---- wall core in plaster (inside, reveals); outside it is clad in stone slabs on a dark mortar bed
  const clad = 0.03;
  wbox(b, 'plaster', FX - ox, FY, WALL - clad, -(ox + FX) / 2, FY / 2, -(WALL + clad) / 2);
  wbox(b, 'plaster', FX - ox, FY, WALL - clad, (ox + FX) / 2, FY / 2, -(WALL + clad) / 2);
  wbox(b, 'plaster', ox * 2, FY - oy, WALL - clad, 0, (FY + oy) / 2, -(WALL + clad) / 2);
  wbox(b, 'grout', FX - ox, FY - GROUND, 0.01, -(ox + FX) / 2, (FY + GROUND) / 2, -0.025);
  wbox(b, 'grout', FX - ox, FY - GROUND, 0.01, (ox + FX) / 2, (FY + GROUND) / 2, -0.025);
  wbox(b, 'grout', ox * 2, FY - oy, 0.01, 0, (FY + oy) / 2, -0.025);
  // house returns so oblique views never look behind the facade
  for (const s of [-1, 1]) wbox(b, 'facade', 0.3, FY - GROUND, 7, s * (FX + 0.15), (FY + GROUND) / 2, -3.5);
  wbox(b, 'facade', FX * 2 + 0.6, 0.3, 7.4, 0, FY + 0.15, -3.5);

  // stone sill under the opening (through the wall thickness)
  wbox(b, 'porch', ox * 2 + 0.02, 0.12, WALL, 0, -0.06, -WALL / 2);

  // ---- layout: dark stone surround round the opening (clears the classic portal of ДИНО), canopy over it
  const tall = door.decorW > W + 0.05;
  const pin = tall ? door.decorW / 2 + 0.012 : ox; // inner edge of the surround
  const ptop = tall ? door.decorH + 0.012 : oy;
  const PB = 0.5, pout = pin + PB; // band width, outer edge
  const cw = pout + 0.18, cz = 1.15, cy = Math.max(3.0, ptop + 0.5); // canopy half-width, depth, soffit height

  /** Slabs on a grid (module mw × mh from origin x0g, y0g) clipped to a rectangle, 5 mm open joints; z0 = back. */
  const JOINT = 0.005;
  const rnd = mulberry(23);
  const slabs = (key, x0, x1, y0, y1, mw, mh, z0, t, x0g = 0, y0g = GROUND) => {
    for (let i = Math.floor((x0 - x0g) / mw + 1e-6); x0g + i * mw < x1 - 1e-6; i++)
      for (let j = Math.floor((y0 - y0g) / mh + 1e-6); y0g + j * mh < y1 - 1e-6; j++) {
        const a0 = Math.max(x0, x0g + i * mw + JOINT / 2), a1 = Math.min(x1, x0g + (i + 1) * mw - JOINT / 2);
        const b0 = Math.max(y0, y0g + j * mh + JOINT / 2), b1 = Math.min(y1, y0g + (j + 1) * mh - JOINT / 2);
        if (a1 - a0 < 0.004 || b1 - b0 < 0.004) continue;
        const g = box(a1 - a0, b1 - b0, t, { round: 0.0015, seg: 1 });
        g.applyMatrix4(M((a0 + a1) / 2, (b0 + b1) / 2, z0 + t / 2));
        metreUV(g, { grainAxis: 'y' });
        // every slab shows its own piece of the stone
        const uv = g.attributes.uv.array, du = rnd() * 7.3, dv = rnd() * 5.1;
        for (let k = 0; k < uv.length; k += 2) {
          uv[k] += du;
          uv[k + 1] += dv;
        }
        b.add(key, g);
      }
  };

  // facade: large-format light stone 1.2 × 0.6 m, z -0.02 … 0
  const fz = -0.02, ft = 0.02;
  slabs('facade', -FX, -pout, GROUND, FY, 1.2, 0.6, fz, ft, -pout);
  slabs('facade', pout, FX, GROUND, FY, 1.2, 0.6, fz, ft, pout);
  slabs('facade', -pout, pout, cy, FY, 1.2, 0.6, fz, ft, -pout);
  if (tall) {
    // between the classic portal and the surround
    slabs('facade', -pin, -ox, 0, ptop, 1.2, 0.6, fz, ft);
    slabs('facade', ox, pin, 0, ptop, 1.2, 0.6, fz, ft);
    slabs('facade', -ox, ox, oy, ptop, 1.2, 0.6, fz, ft);
  }
  // surround: dark stone, 30 mm proud of the facade, three slabs per side, the head split evenly
  const pz = -0.02, pt = 0.05;
  slabs('portal', -pout, -pin, 0.06, ptop, PB, (ptop - 0.06) / 3, pz, pt, -pout, 0.06);
  slabs('portal', pin, pout, 0.06, ptop, PB, (ptop - 0.06) / 3, pz, pt, pin, 0.06);
  {
    const n = Math.max(2, Math.round((2 * pout) / 0.75));
    slabs('portal', -pout, pout, ptop, cy, (2 * pout) / n, cy - ptop + 0.01, pz, pt, -pout, ptop);
  }
  for (const s of [-1, 1]) b.add('portal', box(PB + 0.02, 0.06, pt + 0.02, { round: 0.003 }), M(s * (pin + PB / 2), 0.03, pz + (pt + 0.02) / 2));
  // brass reveal along the opening edge of the surround
  for (const s of [-1, 1]) b.add('brass', box(0.008, ptop + 0.004, pt + 0.004, { round: 0.0015, seg: 1 }), M(s * (pin + 0.004), (ptop + 0.004) / 2, pz + pt / 2 + 0.002));
  b.add('brass', box(2 * pin + 0.016, 0.008, pt + 0.004, { round: 0.0015, seg: 1 }), M(0, ptop + 0.004, pz + pt / 2 + 0.002));

  // ---- canopy: slim dark steel slab, slatted walnut soffit, linear light behind the fascia, downlights
  b.add('blackMetal', box(cw * 2, 0.16, cz, { round: 0.004, seg: 2 }), M(0, cy + 0.08, cz / 2));
  {
    const span = cw * 2 - 0.1, n = Math.floor(span / 0.05);
    for (let i = 0; i < n; i++) {
      const g = box(0.032, 0.022, cz - 0.1, { round: 0.003, seg: 1 });
      g.applyMatrix4(M(-span / 2 + (i + 0.5) * (span / n), cy - 0.011, cz / 2 - 0.02));
      b.add('walnut', g);
    }
    b.add('grout', box(span, 0.002, cz - 0.1), M(0, cy - 0.001, cz / 2 - 0.02));
    b.add('blackMetal', box(cw * 2, 0.05, 0.03, { round: 0.004 }), M(0, cy - 0.025, cz - 0.015));
    b.add('glow', box(span - 0.02, 0.006, 0.012), M(0, cy - 0.026, cz - 0.042));
  }
  const lights = [];
  for (const sx of [-0.55, 0.55]) {
    b.add('blackMetal', new THREE.CylinderGeometry(0.045, 0.045, 0.012, 32), M(sx, cy - 0.028, 0.5));
    b.add('glow', new THREE.CircleGeometry(0.032, 32), M(sx, cy - 0.0345, 0.5, Math.PI / 2, 0, 0));
    const L = new THREE.SpotLight('#ffd6a0', 0, 6, 0.75, 0.75, 2);
    L.position.set(sx, cy - 0.05, 0.5);
    L.target.position.set(sx * 0.4, 0, 0.3);
    L.userData.on = 9;
    lights.push(L);
  }

  // ---- wall sconces on the surround (black body, brass caps, opal up/down light), house number in brass
  const scx = pin + PB / 2, sz0 = pz + pt;
  for (const s of [-1, 1]) {
    const x = s * scx;
    b.add('blackMetal', box(0.08, 0.34, 0.085, { round: 0.006, seg: 3 }), M(x, 1.9, sz0 + 0.0425));
    for (const dy of [-1, 1]) {
      b.add('brass', box(0.084, 0.012, 0.089, { round: 0.003, seg: 2 }), M(x, 1.9 + dy * 0.164, sz0 + 0.0445));
      b.add('glow', box(0.064, 0.004, 0.07), M(x, 1.9 + dy * 0.1715, sz0 + 0.044));
    }
    const P = new THREE.PointLight('#ffcf94', 0, 4.5, 2);
    P.position.set(x, 1.9, sz0 + 0.16);
    P.userData.on = 2.2;
    lights.push(P);
  }
  b.add('number', new THREE.PlaneGeometry(0.22, 0.165), M((door.hingeSign || 1) * scx, 1.5, sz0 + 0.004));

  // ---- porch: graphite porcelain 600 × 600 with a floating edge and LED under it, one step down to the path
  const PW = 2.6, PD = 1.9, TT = 0.03;
  wbox(b, 'grout', PW * 2 - 0.06, -GROUND - TT, PD - 0.06, 0, (GROUND - TT) / 2, (PD - 0.06) / 2);
  slabsFlat(b, 'porch', -PW, PW, 0, PD, 0.6, -TT, TT, JOINT);
  b.add('glow', box(PW * 2 - 0.2, 0.01, 0.004), M(0, -TT - 0.007, PD - 0.058));
  const SD = 0.38, sy = GROUND / 2, SW = 2.2;
  wbox(b, 'grout', SW - 0.06, sy - TT - GROUND, SD, 0, (GROUND + sy - TT) / 2, PD + SD / 2 - 0.03);
  slabsFlat(b, 'porch', -SW / 2, SW / 2, PD, PD + SD, 0.55, sy - TT, TT, JOINT);
  b.add('glow', box(SW - 0.2, 0.01, 0.004), M(0, sy - TT - 0.007, PD + SD - 0.028));
  // door mat on the porch
  b.add('mat', box(1.0, 0.012, 0.6, { round: 0.004, seg: 2 }), M(0, 0.006, 0.45));

  // ---- path, lawn
  wbox(b, 'pavers', 1.8, 0.02, 7, 0, GROUND + 0.005, PD + SD + 3.5);
  const lawn = new THREE.PlaneGeometry(80, 40);
  lawn.rotateX(-Math.PI / 2);
  lawn.translate(0, GROUND - 0.002, 19.8);
  metreUV(lawn);
  b.add('grass', lawn);

  // ---- planters with clipped thujas either side of the entrance
  for (const s of [-1, 1]) {
    const x = s * (pout + 0.45), z = 0.5;
    b.add('portal', box(0.5, 0.8, 0.5, { round: 0.008, seg: 2 }), M(x, 0.4, z));
    b.add('brass', box(0.508, 0.012, 0.508, { round: 0.003 }), M(x, 0.1, z));
    b.add('soil', box(0.46, 0.01, 0.46), M(x, 0.79, z));
    for (const g of topiary(0.24, 1.6, s > 0 ? 3 : 7)) b.add('foliage', g, M(x, 0.77, z));
  }
  // ---- garden bollards along the path
  for (const s of [-1, 1])
    for (const z of [PD + SD + 1.2, PD + SD + 3.6]) {
      b.add('blackMetal', box(0.11, 0.62, 0.11, { round: 0.006, seg: 2 }), M(s * 1.2, GROUND + 0.31, z));
      b.add('glow', box(0.114, 0.045, 0.114), M(s * 1.2, GROUND + 0.55, z));
    }

  // ---- hallway
  const RZ0 = -WALL, RZ1 = -WALL - ROOM.z;
  const floor = new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z);
  floor.rotateX(-Math.PI / 2);
  floor.translate(0, 0.0005, (RZ0 + RZ1) / 2);
  metreUV(floor);
  b.add('parquet', floor);
  const ceil = new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z);
  ceil.rotateX(Math.PI / 2);
  ceil.translate(0, ROOM.h, (RZ0 + RZ1) / 2);
  b.add('ceiling', ceil);
  for (const s of [-1, 1]) {
    const w = new THREE.PlaneGeometry(ROOM.z, ROOM.h);
    w.rotateY((-s * Math.PI) / 2);
    w.translate(s * ROOM.x, ROOM.h / 2, (RZ0 + RZ1) / 2);
    metreUV(w);
    b.add('plaster', w);
    b.add('trim', box(0.016, 0.08, ROOM.z, { round: 0.003 }), M(s * (ROOM.x - 0.008), 0.04, (RZ0 + RZ1) / 2));
  }
  const back = new THREE.PlaneGeometry(ROOM.x * 2, ROOM.h);
  back.translate(0, ROOM.h / 2, RZ1);
  metreUV(back);
  b.add('plaster', back);
  // skirting along the door wall (both sides of the opening)
  for (const s of [-1, 1]) b.add('trim', box(ROOM.x - ox - 0.08, 0.08, 0.016, { round: 0.003 }), M(s * (ox + 0.08 + (ROOM.x - ox - 0.08) / 2), 0.04, RZ0 - 0.008));
  // casing round the opening (inside), 80 × 16 mm, eased profile
  const casing = [[0.08, 0], [0.08, 0.008], [0.077, 0.0125], [0.07, 0.0155], [0.05, 0.016], [0.012, 0.016], [0.004, 0.0135], [0, 0.009], [0, 0]];
  b.add('trim', sweep(casing, [[ox, 0], [ox, oy], [-ox, oy], [-ox, 0]], { closed: false }), M(0, 0, RZ0, 0, Math.PI, 0));
  // ceiling spots
  for (const [sx, sz] of [[-0.75, -1.5], [0.75, -1.5], [-0.75, -3.5], [0.75, -3.5]]) {
    b.add('trim', new THREE.CylinderGeometry(0.05, 0.05, 0.008, 32), M(sx, ROOM.h - 0.004, sz));
    b.add('glow', new THREE.CircleGeometry(0.035, 32), M(sx, ROOM.h - 0.0085, sz, Math.PI / 2, 0, 0));
    const L = new THREE.SpotLight('#ffdcae', 0, 8, 1.05, 0.85, 2);
    L.position.set(sx, ROOM.h - 0.02, sz);
    L.target.position.set(sx * 0.6, 0.4, sz > -2 ? -0.4 : sz - 0.2);
    L.userData.on = sz > -2 ? 22 : 18;
    L.userData.inside = true;
    lights.push(L);
  }

  // ---- hallway furnishing on the back wall (what the door mirrors reflect): console, art, vase, books
  {
    const z = RZ1;
    b.add('walnut', box(1.3, 0.032, 0.36, { round: 0.004, seg: 2 }), M(0, 0.8, z + 0.19));
    b.add('walnut', box(1.22, 0.02, 0.3, { round: 0.003 }), M(0, 0.22, z + 0.18));
    for (const sx of [-0.62, 0.62]) for (const sz of [0.03, 0.34]) b.add('blackMetal', box(0.022, 0.784, 0.022, { round: 0.003 }), M(sx, 0.392, z + sz));
    for (const sz of [0.03, 0.34]) b.add('blackMetal', box(1.26, 0.022, 0.022, { round: 0.003 }), M(0, 0.771, z + sz));
    b.add('ceramic', lathe([[0, 0], [0.06, 0], [0.085, 0.06], [0.09, 0.14], [0.07, 0.24], [0.04, 0.3], [0.042, 0.33], [0.036, 0.33], [0, 0.32]], 48), M(-0.38, 0.816, z + 0.2, -Math.PI / 2, 0, 0));
    for (const [w, h, c, y] of [[0.26, 0.035, 'bookA', 0.834], [0.24, 0.03, 'bookB', 0.866], [0.22, 0.028, 'bookA', 0.895]]) b.add(c, box(w, h, 0.19, { round: 0.002 }), M(0.35, y, z + 0.17, 0, 0.08, 0));
    // framed abstract print
    b.add('blackMetal', box(1.06, 0.76, 0.03, { round: 0.003 }), M(0, 1.62, z + 0.015));
    b.add('passe', new THREE.PlaneGeometry(1.0, 0.7), M(0, 1.62, z + 0.0305));
    b.add('art', new THREE.PlaneGeometry(0.8, 0.52), M(0, 1.62, z + 0.031));
    // pendant over the console
    b.add('blackMetal', new THREE.CylinderGeometry(0.003, 0.003, 0.7, 8), M(0, ROOM.h - 0.35, z + 0.6));
    b.add('blackMetal', lathe([[0, 0.12], [0.03, 0.12], [0.16, 0.02], [0.17, 0], [0.165, 0], [0.025, 0.11], [0, 0.11]], 48), M(0, ROOM.h - 0.82, z + 0.6, -Math.PI / 2, 0, 0));
    b.add('glow', new THREE.CircleGeometry(0.15, 32), M(0, ROOM.h - 0.818, z + 0.6, Math.PI / 2, 0, 0));
  }

  // picture light over the console (warm wall wash for the back wall the mirrors show)
  {
    const L = new THREE.SpotLight('#ffd8a8', 0, 5, 0.75, 0.9, 2);
    L.position.set(0, ROOM.h - 0.05, RZ1 + 1.1);
    L.target.position.set(0, 1.3, RZ1);
    L.userData.on = 16;
    L.userData.inside = true;
    lights.push(L);
    b.add('trim', new THREE.CylinderGeometry(0.05, 0.05, 0.008, 32), M(0, ROOM.h - 0.004, RZ1 + 1.1));
    b.add('glow', new THREE.CircleGeometry(0.035, 32), M(0, ROOM.h - 0.0085, RZ1 + 1.1, Math.PI / 2, 0, 0));
  }

  // the hallway is lit by its own lamps: keep the sky light low on its surfaces
  for (const k of ['plaster', 'parquet', 'ceiling', 'trim', 'walnut', 'passe', 'art']) m[k].envMapIntensity = 0.32;
  const group = b.build(m);
  for (const L of lights) {
    group.add(L);
    if (L.target) group.add(L.target);
  }
  return { group, lights, glowMats: [m.glow] };
}

export const ROOM_BOUNDS = { x: ROOM.x - 0.15, z0: -WALL - ROOM.z + 0.2, y: ROOM.h - 0.15, wall: WALL };
