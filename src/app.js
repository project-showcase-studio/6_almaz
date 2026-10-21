import * as THREE from 'three';
import { Engine } from './engine.js';
import { DOORS, ORDER, COMPANY, HANDING, rub, fmt } from './catalog.js';
import { preloadSets, onTextureReady } from './materials.js';
import { buildDoor, doorMaterials } from './models/door.js';
import { buildEntrance, ROOM_BOUNDS } from './scene.js';

const $ = (s) => document.querySelector(s);
const engine = new Engine($('#viewport'));
onTextureReady.add(() => engine.invalidate(3));
preloadSets(['quartz_black', 'oak_rustic', 'film_graphite', 'muar', 'concrete', 'porcelain', 'plaster', 'parquet', 'grass']);

const params = new URLSearchParams(location.search);
const qd = params.get('d');
// shareable view: ?cam=x,y,z,tx,ty,tz, &tod=evening, &open=1, &clean — scene only
const qcam = (params.get('cam') || '').split(',').map(Number);
if (params.has('clean')) document.body.classList.add('clean');
const state = {
  door: DOORS[qd] ? qd : ORDER[0],
  tod: params.get('tod') === 'evening' ? 'evening' : 'day',
  open: params.get('open') === '1' ? 1 : 0,
  openAnim: params.get('open') === '1' ? 1 : 0,
  mode: 'out',
  cfg: {},
};
// default handing as on the product photo of each door
for (const id of ORDER) state.cfg[id] = { size: 1, hand: id === 'berill' || id === 'dino' ? 'left' : 'right' };

// ---------------------------------------------------------------- scene
const scene = engine.scene;
engine.sunFrom = [-0.62, 0.78]; // sun front-left: raking light across the panel milling
const matsCache = {};
let current = null; // { id, door, key }
let entrance = null; // { key, group, lights, glowMats }

function build({ fly = false } = {}) {
  const id = state.door, D = DOORS[id], c = state.cfg[id];
  const size = D.sizes[c.size];
  const key = JSON.stringify([id, size, c.hand]);
  if (current?.key === key) return;
  const changedDoor = !current || current.id !== id;
  const mats = matsCache[id] || (matsCache[id] = doorMaterials(D.look));
  const door = buildDoor(D, { size, hand: c.hand }, mats);
  if (current) {
    scene.remove(current.door.group);
    current.door.group.traverse((m) => m.isMesh && m.geometry.dispose());
  }
  scene.add(door.group);
  door.setOpen(state.openAnim);
  current = { id, door, key, mats };
  // surroundings follow the door size (opening, portal of ДИНО)
  const ekey = JSON.stringify([door.W, door.H, door.decorW, door.decorH, door.hingeSign]);
  if (!entrance || entrance.key !== ekey) {
    if (entrance) {
      scene.remove(entrance.group);
      entrance.group.traverse((m) => m.isMesh && m.geometry.dispose());
    }
    entrance = { key: ekey, ...buildEntrance(door) };
    scene.add(entrance.group);
  }
  applyLights();
  if (fly || changedDoor) {
    if (!state.started) {
      const [p, t] = qcam.length === 6 && qcam.every(Number.isFinite) ? [qcam.slice(0, 3), qcam.slice(3)] : view(state.view || 'out');
      engine.camera.position.set(...p);
      engine.controls.target.set(...t);
      setMode(t[2] < -0.2 && p[2] < -0.2 ? 'in' : 'out');
      state.started = true;
    }
  }
  engine.invalidate(3);
}

// ---------------------------------------------------------------- lights, time of day
function applyLights() {
  if (!entrance) return;
  const eve = state.tod === 'evening';
  for (const L of entrance.lights) L.intensity = L.userData.inside ? L.userData.on * (eve ? 1 : 0.55) : eve ? L.userData.on : 0;
  for (const m of entrance.glowMats) m.emissiveIntensity = eve ? 6 : 0.6;
  engine.invalidate(3);
}
async function applyTod() {
  await engine.setEnvironment(state.tod);
  applyLights();
}

// ---------------------------------------------------------------- camera
/** Preset views [position, target]; computed from the current door. */
function view(k) {
  const d = current?.door;
  const H = d ? d.H : 2.05, tall = d && d.decorH > H + 0.1;
  const ty = tall ? 1.18 : 1.05;
  const k1 = Math.min(1.35, Math.max(1, 1.05 / engine.camera.aspect)); // pull back on narrow screens
  const lx = d ? d.lockPoint.x : -0.45, hs = d ? d.hingeSign : 1;
  switch (k) {
    case 'front':
      return [[0, ty + 0.05, (tall ? 4.6 : 3.9) * k1], [0, ty, 0]];
    case 'in':
      return [[-0.8 * hs, 1.45, -4.25], [0, 1.08, -0.3]];
    case 'hw':
      return [[lx + Math.sign(lx) * 0.38, 1.22, 0.62], [lx - Math.sign(lx) * 0.07, 1.06, 0.02]];
    case 'edge': {
      // in front of the lock edge of the open leaf, slightly to the exterior-face side
      d.leaf.updateWorldMatrix(true, false);
      const p = d.leaf.localToWorld(d.lockEdge.clone());
      const n = d.leaf.localToWorld(d.lockEdge.clone().add(new THREE.Vector3(-1, 0, 0))).sub(p).normalize();
      const f = d.leaf.localToWorld(d.lockEdge.clone().add(new THREE.Vector3(0, 0, 1))).sub(p).normalize();
      const c = p.clone().addScaledVector(n, 0.5).addScaledVector(f, 0.22);
      return [[c.x, 1.32, c.z], [p.x, 1.08, p.z]];
    }
    default:
      return [[-1.45 * hs * k1, ty + 0.28, (tall ? 4.9 : 4.2) * k1], [0, ty, 0]];
  }
}
function setMode(mode) {
  state.mode = mode;
  const c = engine.controls;
  if (mode === 'in') {
    c.minAzimuthAngle = Math.PI - 1.05;
    c.maxAzimuthAngle = -(Math.PI - 1.05);
    c.maxDistance = 4.2;
  } else {
    c.minAzimuthAngle = -1.35;
    c.maxAzimuthAngle = 1.35;
    c.maxDistance = 9;
  }
}
engine.clamp = (cam) => {
  if (engine.onFrame.length) return; // camera flights pass through walls on purpose
  const p = cam.position;
  if (state.mode === 'in') {
    p.x = THREE.MathUtils.clamp(p.x, -ROOM_BOUNDS.x, ROOM_BOUNDS.x);
    p.z = THREE.MathUtils.clamp(p.z, ROOM_BOUNDS.z0, -ROOM_BOUNDS.wall - 0.25);
    p.y = THREE.MathUtils.clamp(p.y, 0.3, ROOM_BOUNDS.y);
  } else {
    p.z = Math.max(p.z, 0.2);
  }
};
function go(k) {
  if (k === 'edge' && (state.open < 1 || state.openAnim < 1)) {
    state.view = k;
    setOpen(1, () => go('edge'));
    return;
  }
  const [p, t] = view(k);
  setMode(k === 'in' ? 'in' : 'out');
  state.view = k;
  engine.flyTo(p, t, 1.2);
  renderStage();
}

// ---------------------------------------------------------------- opening
function setOpen(v, done) {
  state.open = v;
  const from = state.openAnim, dur = 1.1;
  let t = 0;
  const f = (dt) => {
    t = Math.min(1, t + dt / dur);
    const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    state.openAnim = from + (v - from) * k;
    current?.door.setOpen(state.openAnim);
    if (t >= 1) {
      engine.onFrame.splice(engine.onFrame.indexOf(f), 1);
      if (done) setTimeout(done, 0);
    }
    return true;
  };
  engine.onFrame.push(f);
  renderStage();
}

// ---------------------------------------------------------------- UI
const VIEWS = [
  ['out', 'Снаружи'],
  ['front', 'Фасад'],
  ['in', 'Внутри'],
  ['hw', 'Фурнитура'],
  ['edge', 'Торец и замки'],
];

function renderHeader() {
  $('#models').innerHTML = ORDER.map((id) => {
    const D = DOORS[id];
    return `<button data-d="${id}" class="${id === state.door ? 'on' : ''}"><b>${D.short}</b><small>${rub(D.price)}</small></button>`;
  }).join('');
}
function renderStage() {
  $('#views').innerHTML = VIEWS.map(([k, l]) => `<button data-v="${k}" class="${state.view === k ? 'on' : ''}">${l}</button>`).join('');
  $('#open').innerHTML = `<button id="open-btn" class="${state.open ? 'on' : ''}">
      <svg viewBox="0 0 24 24"><path d="M5 3h9v18H5z M14 5l5 2v12l-5 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="11.5" cy="12" r="0.9" fill="currentColor"/></svg>
      <span>${state.open ? 'Закрыть дверь' : 'Открыть дверь'}</span></button>`;
  $('#tod').innerHTML = [
    ['day', 'День'],
    ['evening', 'Вечер'],
  ]
    .map(([k, l]) => `<button data-t="${k}" class="${state.tod === k ? 'on' : ''}">${l}</button>`)
    .join('');
}
$('#models').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b || b.dataset.d === state.door) return;
  state.door = b.dataset.d;
  history.replaceState(null, '', '?d=' + state.door);
  renderAll();
  build();
  const v = state.view && state.view !== 'edge' ? state.view : 'out';
  const [p, t] = view(v);
  engine.flyTo(p, t, 1.0);
};
$('#views').onclick = (e) => {
  const b = e.target.closest('button');
  if (b && current) go(b.dataset.v);
};
$('#open').onclick = (e) => e.target.closest('button') && setOpen(state.open ? 0 : 1);
$('#tod').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.tod = b.dataset.t;
  renderStage();
  applyTod();
};

function renderProject() {
  const D = DOORS[state.door];
  const s = D.specs;
  const specs = [
    ['Толщина стали', s.steel],
    ['Глубина короба', s.box],
    ['Толщина полотна', s.leaf],
    ['Уплотнение', s.contours],
    ['Замки', s.locks],
    ...(s.weight ? [['Вес', s.weight]] : []),
  ];
  $('#project').innerHTML = `
    <div class="eyebrow"><span>${D.collection}</span> · <span>${D.kind}</span></div>
    <h1>${D.name}</h1>
    <p class="tag">${D.tagline}</p>
    <dl class="specs">${specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <details class="incl"><summary>Характеристики с сайта</summary>
      <dl>${D.details.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    </details>`;
}

function renderOptions() {
  const D = DOORS[state.door], c = state.cfg[state.door];
  let num = 0;
  const sec = (title, body, sub = '') => `<section class="opt"><h2><em>${String(++num).padStart(2, '0')}</em>${title}${sub ? `<span>${sub}</span>` : ''}</h2>${body}</section>`;
  const handIcon = (h) =>
    `<svg viewBox="0 0 40 52" class="hand ${h}"><rect x="6" y="4" width="28" height="44" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="10" y="8" width="20" height="36" fill="currentColor" opacity=".14"/>${
      h === 'right'
        ? '<circle cx="31.2" cy="13" r="1.4" fill="currentColor"/><circle cx="31.2" cy="38" r="1.4" fill="currentColor"/><path d="M12 25h5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
        : '<circle cx="8.8" cy="13" r="1.4" fill="currentColor"/><circle cx="8.8" cy="38" r="1.4" fill="currentColor"/><path d="M23 25h5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
    }</svg>`;
  let html = sec(
    'Размер блока',
    `<div class="cards">${D.sizes
      .map(([w, h], i) => `<button data-k="size" data-v="${i}" class="card ${c.size === i ? 'on' : ''}"><b>${w} × ${h}</b><small>мм, по коробу · проём от ${w + 40} × ${h + 30}</small></button>`)
      .join('')}</div>`,
    'цена не меняется',
  );
  html += sec(
    'Открывание',
    `<div class="cards">${HANDING.map(([k, l, d]) => `<button data-k="hand" data-v="${k}" class="card hand-card ${c.hand === k ? 'on' : ''}">${handIcon(k)}<span><b>${l}</b><small>${d}</small></span></button>`).join('')}</div>
     <p class="note">Вид снаружи. Входные двери Алмаз открываются наружу.</p>`,
  );
  html += sec(
    'Отделка',
    `<div class="finish">${D.details
      .filter(([k]) => /отделка/.test(k))
      .map(([k, v]) => `<div><b>${k.replace(' отделка', '')}</b><span>${v}</span></div>`)
      .join('')}</div>
     <p class="note">Комплектация модели — как на сайте завода. ${state.door === 'niko' ? 'Заявки принимаются только в стандартном варианте.' : 'Другие цвета и рисунки — по запросу в салоне.'}</p>`,
    'стандарт',
  );
  $('#options').innerHTML = html;
}

function renderSummary() {
  const D = DOORS[state.door], c = state.cfg[state.door];
  const [w, h] = D.sizes[c.size];
  $('#summary').innerHTML = `<div class="sum-lines">
      <div><span>${D.name} · ${w} × ${h} мм · ${HANDING.find((x) => x[0] === c.hand)[1].toLowerCase()}</span></div>
    </div>
    <div class="sum-total"><span>Розничная цена</span><strong>${rub(D.price)}</strong><small>Цена завода «Алмаз» с сайта almaz-nsk.com</small></div>
    <div class="sum-btns"><button class="btn primary" id="send">Купить в 1 клик</button><a class="btn ghost" href="${D.url}" target="_blank" rel="noopener">На сайте</a></div>`;
  $('#send').onclick = openRequest;
}

function renderAll() {
  renderHeader();
  renderStage();
  renderProject();
  renderOptions();
  renderSummary();
}

$('#options').addEventListener('click', (e) => {
  const c = state.cfg[state.door];
  const t = e.target.closest('button');
  if (!t?.dataset.k) return;
  c[t.dataset.k] = t.dataset.k === 'size' ? Number(t.dataset.v) : t.dataset.v;
  build();
  if (state.view === 'hw' || state.view === 'edge') setTimeout(() => go(state.view), 50);
  renderOptions();
  renderSummary();
});

function requestLines() {
  const D = DOORS[state.door], c = state.cfg[state.door];
  const [w, h] = D.sizes[c.size];
  return [
    `Модель: ${D.name} (${D.collection})`,
    `Размер: ${w} × ${h} мм`,
    `Открывание: ${HANDING.find((x) => x[0] === c.hand)[1].toLowerCase()}`,
    `Замки: ${D.specs.locks}`,
    `Цена: ${rub(D.price)}`,
  ];
}
function openRequest() {
  const D = DOORS[state.door];
  const lines = requestLines();
  $('#req-body').innerHTML = `<ul>${lines.map((l) => `<li>${l.replace(/^([^:]+):/, '<span>$1</span>')}</li>`).join('')}</ul>
    <p class="note">Замер, доставка и установка — по Новосибирску и области. Салон и склад: ${COMPANY.city}.</p>
    <p class="req-phone"><a href="${COMPANY.phoneHref}">${COMPANY.phone}</a> · <a href="${COMPANY.freeHref}">${COMPANY.free}</a> · <a href="${COMPANY.telegram}" target="_blank" rel="noopener">Telegram</a> · <a href="mailto:${COMPANY.email}">${COMPANY.email}</a></p>`;
  $('#req-link').href = D.url;
  $('#req-copy').onclick = (e) => {
    e.preventDefault();
    navigator.clipboard?.writeText(lines.join('\n'));
    $('#req-copy').textContent = 'Скопировано';
    setTimeout(() => ($('#req-copy').textContent = 'Скопировать заказ'), 1600);
  };
  $('#request').showModal();
}

$('#shot').onclick = () => {
  const url = engine.capture(2560, 1440);
  const a = document.createElement('a');
  a.href = url;
  a.download = `АЛМАЗ-${DOORS[state.door].name.replace(/\s+/g, '-')}.png`;
  a.click();
};

// ---------------------------------------------------------------- start
renderAll();
(async () => {
  const bar = $('#loader i');
  bar.style.width = '30%';
  await engine.setEnvironment(state.tod);
  bar.style.width = '65%';
  build({ fly: true });
  bar.style.width = '85%';
  await engine.renderer.compileAsync(scene, engine.camera).catch(() => {});
  bar.style.width = '100%';
  setTimeout(() => $('#loader').classList.add('done'), 250);
  setTimeout(() => document.body.setAttribute('data-ready', ''), 3000);
  setTimeout(() => $('#hint').classList.add('done'), 6000);
})();

globalThis.__app = { engine, state, get current() { return current; }, build, go, setOpen, view };
