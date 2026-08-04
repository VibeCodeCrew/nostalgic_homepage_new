/* ============================================================
   SPACE CADET PINBALL — JS-версия (3D-перспектива)
   Физика 2D, рендер — перспективная проекция с экструзией.
   Управление: Shift/Z — левый флиппер, //M — правый,
   Пробел (удерживать) — плунжер, R — заново, P — пауза.
   ============================================================ */
(() => {
'use strict';

// ---------------- Константы ----------------
const W = 400, H = 800;
const BALL_R = 7.5;
const GRAV = 1150;
const MAXV = 2600;
const SUB = 6;
const BALLS_PER_GAME = 3;
const FLIP_R = 9;
const D = Math.PI / 180;

// ---------------- Камера (перспектива) ----------------
const TILT = 42 * D;          // наклон стола
const FOCAL = 800;
const CY = 520;               // центр вращения по Y
const SIN_T = Math.sin(TILT), COS_T = Math.cos(TILT);
const FIT = { k: 1, cx: 0, cy: 0 };

function projRaw(x, y) {
  const rz = (CY - y) * SIN_T;
  const s = FOCAL / (FOCAL + rz);
  return { x: 200 + (x - 200) * s, y: CY + (y - CY) * COS_T * s, s };
}
// проекция точки стола с высотой z
function proj(x, y, z = 0) {
  const p = projRaw(x, y);
  return {
    x: (p.x - FIT.cx) * FIT.k + W / 2,
    y: (p.y - FIT.cy) * FIT.k + H / 2 - z * p.s * FIT.k,
    s: p.s * FIT.k,
  };
}
function fitProjection(samples) {
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const [x, y] of samples) {
    const p = projRaw(x, y);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const m = 8;
  FIT.k = Math.min((W - 2 * m) / (maxX - minX), (H - 2 * m - 12) / (maxY - minY));
  FIT.cx = (minX + maxX) / 2;
  FIT.cy = (minY + maxY) / 2;
}

// ---------------- Canvas ----------------
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const SS = 2;
canvas.width = W * SS;
canvas.height = H * SS;

// ---------------- Звёзды фона ----------------
const stars = [];
for (let i = 0; i < 170; i++) {
  stars.push({ x: Math.random() * W, y: Math.random() * H,
               r: Math.random() * 1.2 + 0.3, a: Math.random() * 0.55 + 0.2 });
}

// ---------------- Звук ----------------
let AC = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function blip(f0, f1, dur, type = 'square', vol = 0.1) {
  const ac = audio(); if (!ac) return;
  try {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(f0, 1), ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur + 0.03);
  } catch (e) {}
}
const sfx = {
  flipper:  () => blip(140, 90, 0.05, 'square', 0.06),
  bumper:   () => blip(300 + Math.random() * 80, 90, 0.13, 'sawtooth', 0.12),
  sling:    () => blip(220, 120, 0.09, 'square', 0.09),
  rollover: () => blip(880, 1320, 0.08, 'sine', 0.1),
  target:   () => blip(520, 260, 0.08, 'triangle', 0.11),
  launch:   () => blip(160, 700, 0.3, 'sawtooth', 0.1),
  drain:    () => blip(380, 55, 0.5, 'sawtooth', 0.12),
  mult:     () => { blip(660, 660, 0.09, 'sine', 0.12); setTimeout(() => blip(990, 990, 0.12, 'sine', 0.12), 100); },
  serve:    () => blip(500, 750, 0.1, 'sine', 0.08),
  boost:    () => blip(240, 900, 0.16, 'sawtooth', 0.1),
  kickback: () => blip(180, 620, 0.22, 'square', 0.12),
  well:     () => blip(90, 400, 0.35, 'sine', 0.13),
  peg:      () => blip(700, 500, 0.04, 'triangle', 0.07),
};

// ---------------- Геометрия стола ----------------
// Сегмент: {x1,y1,x2,y2,e,kx,ky,kick,score,tag,flash,h}
const segs = [];
function S(x1, y1, x2, y2, e = 0.4, o = {}) {
  segs.push(Object.assign({ x1, y1, x2, y2, e, kick: 0, kx: 0, ky: 0, score: 0, tag: '', flash: 0, h: 14 }, o));
}
function arcSeg(cx, cy, r, a0deg, a1deg, stepDeg, e = 0.4) {
  let a0 = a0deg * D, a1 = a1deg * D, st = stepDeg * D;
  for (let a = a0; a < a1 - 1e-9; a += st) {
    const b = Math.min(a + st, a1);
    S(cx + r * Math.cos(a), cy + r * Math.sin(a),
      cx + r * Math.cos(b), cy + r * Math.sin(b), e);
  }
}

// Внешние границы
S(390, 120, 390, 790);
arcSeg(200, 230, 220, -150, -30, 6);
S(10, 120, 10, 535);
S(10, 535, 58, 610);
S(58, 610, 58, 815);
S(58, 796, 172, 815, 0.2, { h: 3, tag: 'floor' });
S(360, 535, 342, 610);
S(342, 610, 342, 815);
S(342, 796, 228, 815, 0.2, { h: 3, tag: 'floor' });
S(360, 115, 360, 790);                       // разделитель дорожки
S(360, 790, 390, 790, 0.4, { h: 3, tag: 'floor' });
S(360, 115, 352, 124, 0.3);
S(360, 115, 368, 124, 0.3);
// Инлейны
S(85, 640, 138, 704);
S(315, 640, 262, 704);

// Пращи — треугольники, активная грань первая
const SLING_L = { pts: [[80, 525], [145, 590], [80, 600]] };
const SLING_R = { pts: [[320, 525], [255, 590], [320, 600]] };
S(80, 525, 145, 590, 0.4, { kx: 0.707, ky: -0.707, kick: 560, score: 25, tag: 'sling', h: 10 });
S(145, 590, 80, 600, 0.3, { tag: 'slingSide', h: 10 });
S(80, 600, 80, 525, 0.3, { tag: 'slingSide', h: 10 });
S(320, 525, 255, 590, 0.4, { kx: -0.707, ky: -0.707, kick: 560, score: 25, tag: 'sling', h: 10 });
S(255, 590, 320, 600, 0.3, { tag: 'slingSide', h: 10 });
S(320, 600, 320, 525, 0.3, { tag: 'slingSide', h: 10 });

// Бамперы (5 штук)
const bumpers = [
  { x: 120, y: 290, r: 20, h: 26, color: '#ff5252', flash: 0, score: 100 },
  { x: 255, y: 290, r: 20, h: 26, color: '#ffd740', flash: 0, score: 100 },
  { x: 187, y: 375, r: 20, h: 26, color: '#69f0ae', flash: 0, score: 100 },
  { x: 105, y: 450, r: 15, h: 20, color: '#b388ff', flash: 0, score: 150 },
  { x: 270, y: 450, r: 15, h: 20, color: '#4fc3f7', flash: 0, score: 150 },
];

// Пеги-препятствия
const pegs = [
  { x: 150, y: 205, r: 5, h: 18, flash: 0 },
  { x: 250, y: 205, r: 5, h: 18, flash: 0 },
  { x: 200, y: 145, r: 5, h: 18, flash: 0 },
];

// Цели на правой стенке
const targets = [
  { x: 336, y: 230, r: 9, h: 12, lit: false, flash: 0, score: 250 },
  { x: 336, y: 300, r: 9, h: 12, lit: false, flash: 0, score: 250 },
  { x: 336, y: 370, r: 9, h: 12, lit: false, flash: 0, score: 250 },
];

// Ролловеры на верхней дуге
const rollovers = [
  { x: 115.5, y: 48.7, r: 7, lit: false, cool: 0 },
  { x: 200,   y: 30,   r: 7, lit: false, cool: 0 },
  { x: 284.5, y: 48.7, r: 7, lit: false, cool: 0 },
];

// Бустеры-ускорители (стрелки на полу)
const boosters = [
  { x: 58,  y: 468, r: 21, dx: 0.55, dy: -0.835, speed: 800, cool: 0, flash: 0 },
  { x: 328, y: 468, r: 21, dx: -0.55, dy: -0.835, speed: 800, cool: 0, flash: 0 },
];

// Гравитационная яма
const well = { x: 200, y: 480, r: 24, capture: 0, timer: 0, flash: 0 };

// Кикбэк — спасение левого аутлейна
const kickback = { lit: true, flash: 0 };

// 5 ламп: собери все — энергощиты в аутлейнах до конца шара
const lamps = [
  { x: 48,  y: 330, r: 5, lit: false, cool: 0 },
  { x: 345, y: 395, r: 5, lit: false, cool: 0 },
  { x: 200, y: 195, r: 5, lit: false, cool: 0 },
  { x: 118, y: 590, r: 5, lit: false, cool: 0 },
  { x: 282, y: 590, r: 5, lit: false, cool: 0 },
];
let shieldsActive = false;
// щиты-дефлекторы, перекрывающие аутлейны
const shieldSegs = [
  { x1: 58, y1: 655, x2: 87, y2: 682, e: 0.6, kx: 0.6, ky: -0.8, kick: 650, flash: 0 },
  { x1: 342, y1: 655, x2: 313, y2: 682, e: 0.6, kx: -0.6, ky: -0.8, kick: 650, flash: 0 },
];

// Спиннеры — свободно вращающиеся лопасти
const spinners = [
  { x: 90,  y: 350, len: 34, ang: 0.5,  w: 0, acc: 0 },
  { x: 310, y: 350, len: 34, ang: -0.5, w: 0, acc: 0 },
];

// Труба-телепорт: вход слева, выход в левый инлейн
const TUBE_PATH = [
  [62, 245], [32, 180], [38, 110], [90, 62], [150, 70], [140, 350], [120, 520], [105, 655],
];
const tube = { entryX: 62, entryY: 245, entryR: 12, active: false, t: 0, cool: 0, len: 0, segs: [] };
(function initTube() {
  let acc = 0;
  for (let i = 0; i < TUBE_PATH.length - 1; i++) {
    const [x1, y1] = TUBE_PATH[i], [x2, y2] = TUBE_PATH[i + 1];
    const l = Math.hypot(x2 - x1, y2 - y1);
    tube.segs.push({ x1, y1, x2, y2, l, start: acc });
    acc += l;
  }
  tube.len = acc;
})();
function tubePoint(d) {
  for (const s of tube.segs) {
    if (d <= s.start + s.l) {
      const t = s.l ? (d - s.start) / s.l : 0;
      return { x: s.x1 + (s.x2 - s.x1) * t, y: s.y1 + (s.y2 - s.y1) * t };
    }
  }
  const [x, y] = TUBE_PATH[TUBE_PATH.length - 1];
  return { x, y };
}

// Флипперы
function makeFlipper(px, py, restAng, actAng) {
  return { px, py, len: 48, restAng, actAng, ang: restAng, w: 0, pressed: false, wasPressed: false };
}
const flipL = makeFlipper(140, 710, 32 * D, -28 * D);
const flipR = makeFlipper(260, 710, 180 * D - 32 * D, 180 * D + 28 * D);

// ---------------- Состояние игры ----------------
let score = 0;
let best = parseInt(localStorage.getItem('scjs_best') || '0', 10) || 0;
let ballNum = 1;
let mult = 1;
let state = 'plunger';
let paused = false;
let plungerPower = 0;
let plungerHeld = false;
let stuckTimer = 0;
let skillShot = null;      // {lane, until} — скилл-шот после запуска
let orbitCheck = 0;        // время запуска для бонуса «Орбита»
let extraBalls = 0;
let targetsDoneOnce = false; // цели уже собирали за этот шар
let rankIdx = 0;

const RANKS = [
  [0, 'КАДЕТ'], [8000, 'ЛЕЙТЕНАНТ'], [20000, 'КАПИТАН'],
  [45000, 'МАЙОР'], [90000, 'ПОЛКОВНИК'], [180000, 'ФЛИТ-АДМИРАЛ'],
];

const ball = { x: 375, y: 766, vx: 0, vy: 0 };
const trail = [];
const messages = [];
const popups = [];
function msg(text, dur = 1800, color = '#ffe14d') {
  messages.push({ text, t0: performance.now(), dur, color });
  if (messages.length > 5) messages.shift(); // не больше пяти строк в логе
}
function popup(x, y, text) {
  popups.push({ x, y, text, t0: performance.now() });
  if (popups.length > 12) popups.shift();
}

// ---------------- HUD ----------------
const el = {
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  ball: document.getElementById('ball'),
  mult: document.getElementById('mult'),
  rank: document.getElementById('rank'),
};
function hud() {
  el.score.textContent = score;
  el.best.textContent = best;
  el.ball.textContent = ballNum + (extraBalls > 0 ? '+' + extraBalls : '');
  el.mult.textContent = '×' + mult;
  // звание по очкам
  let r = 0;
  for (let i = 0; i < RANKS.length; i++) if (score >= RANKS[i][0]) r = i;
  if (r > rankIdx) {
    rankIdx = r;
    msg('НОВОЕ ЗВАНИЕ: ' + RANKS[r][1] + '!', 2200, '#b388ff');
    sfx.mult();
  }
  el.rank.textContent = RANKS[rankIdx][1];
}
function addScore(n, x, y) {
  score += n * mult;
  if (x !== undefined) popup(x, y, '+' + n * mult);
  if (score > best) { best = score; localStorage.setItem('scjs_best', String(best)); }
  hud();
}

// ---------------- Управление ----------------
function pressLeft(v)  { flipL.pressed = v; }
function pressRight(v) { flipR.pressed = v; }
function pressPlunger(v) {
  plungerHeld = v;
  if (v) plungerPower = 0;
  else releasePlunger();
}
function releasePlunger() {
  if (state === 'plunger' && plungerPower > 0.03) {
    ball.vy = -(1250 + 800 * plungerPower);
    ball.vx = 0;
    state = 'play';
    orbitCheck = performance.now();
    if (skillShot) skillShot.until = orbitCheck + 8000;
    sfx.launch();
  }
  plungerPower = 0;
}

const keyMap = {
  ShiftLeft: 'L', ControlLeft: 'L', KeyZ: 'L', ArrowLeft: 'L',
  ShiftRight: 'R', ControlRight: 'R', Slash: 'R', KeyM: 'R', ArrowRight: 'R',
  Space: 'P', ArrowDown: 'P', Enter: 'P',
};
addEventListener('keydown', e => {
  if (e.repeat) { if (keyMap[e.code]) e.preventDefault(); return; }
  const k = keyMap[e.code];
  if (k) {
    e.preventDefault();
    if (paused) return;
    if (k === 'L') pressLeft(true);
    else if (k === 'R') pressRight(true);
    else pressPlunger(true);
  } else if (e.code === 'KeyR') restart();
  else if (e.code === 'KeyP') paused = !paused;
});
addEventListener('keyup', e => {
  const k = keyMap[e.code];
  if (!k) return;
  e.preventDefault();
  if (k === 'L') pressLeft(false);
  else if (k === 'R') pressRight(false);
  else pressPlunger(false);
});

const pointers = new Map();
function zoneFor(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = (clientX - r.left) / r.width, y = (clientY - r.top) / r.height;
  if (x > 0.86 && y > 0.55) return 'P';
  if (state === 'plunger' && y > 0.8) return 'P';
  return x < 0.5 ? 'L' : 'R';
}
function pdown(id, cx, cy) {
  const z = zoneFor(cx, cy);
  pointers.set(id, z);
  if (paused) return;
  if (z === 'L') pressLeft(true);
  else if (z === 'R') pressRight(true);
  else pressPlunger(true);
}
function pup(id) {
  const z = pointers.get(id);
  pointers.delete(id);
  if (!z) return;
  if (z === 'L' && ![...pointers.values()].includes('L')) pressLeft(false);
  if (z === 'R' && ![...pointers.values()].includes('R')) pressRight(false);
  if (z === 'P' && ![...pointers.values()].includes('P')) pressPlunger(false);
}
canvas.addEventListener('touchstart', e => { e.preventDefault(); for (const t of e.changedTouches) pdown(t.identifier, t.clientX, t.clientY); }, { passive: false });
canvas.addEventListener('touchend',   e => { e.preventDefault(); for (const t of e.changedTouches) pup(t.identifier); }, { passive: false });
canvas.addEventListener('touchcancel',e => { for (const t of e.changedTouches) pup(t.identifier); });
canvas.addEventListener('mousedown', e => { pdown('mouse', e.clientX, e.clientY); });
addEventListener('mouseup', () => pup('mouse'));
document.addEventListener('visibilitychange', () => { if (document.hidden) paused = true; });

// ---------------- Логика игры ----------------
function serve() {
  ball.x = 375; ball.y = 766; ball.vx = 0; ball.vy = 0;
  state = 'plunger';
  kickback.lit = true;
  shieldsActive = false;
  targetsDoneOnce = false;
  trail.length = 0;
  // скилл-шот: случайный лейн подсвечен на 8 секунд после запуска
  skillShot = { lane: Math.floor(Math.random() * 3), until: 0 };
  sfx.serve();
  msg('ШАР ' + ballNum + ' — ЗАПУСК!', 1400);
}
function resetBallBonuses() {
  rollovers.forEach(r => { r.lit = false; r.cool = 0; });
  targets.forEach(t => t.lit = false);
  mult = 1;
}
function drain() {
  state = 'drain';
  sfx.drain();
  skillShot = null;
  orbitCheck = 0;
  shieldsActive = false;
  if (extraBalls > 0) {
    extraBalls--;
    hud();
    msg('ДОПОЛНИТЕЛЬНЫЙ ШАР', 1500);
    setTimeout(() => { if (state === 'drain') serve(); }, 1200);
    return;
  }
  if (ballNum >= BALLS_PER_GAME) {
    state = 'over';
    msg('ИГРА ОКОНЧЕНА — R: ЗАНОВО', 60000);
  } else {
    msg('ШАР ПОТЕРЯН', 1500);
    ballNum++;
    resetBallBonuses();
    hud();
    setTimeout(() => { if (state === 'drain') serve(); }, 1200);
  }
}
function restart() {
  score = 0; ballNum = 1;
  extraBalls = 0; rankIdx = 0;
  resetBallBonuses();
  hud();
  messages.length = 0;
  serve();
}

// ---------------- Физика ----------------
function closestOnSeg(s, px, py) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy || 1e-9;
  let t = ((px - s.x1) * dx + (py - s.y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: s.x1 + t * dx, y: s.y1 + t * dy };
}

function collideSeg(s) {
  const c = closestOnSeg(s, ball.x, ball.y);
  let nx = ball.x - c.x, ny = ball.y - c.y;
  const d = Math.hypot(nx, ny);
  if (d >= BALL_R || d === 0) return;
  nx /= d; ny /= d;
  ball.x += nx * (BALL_R - d);
  ball.y += ny * (BALL_R - d);
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= (1 + s.e) * vn * nx;
    ball.vy -= (1 + s.e) * vn * ny;
  }
  if (s.kick) {
    ball.vx += s.kx * s.kick;
    ball.vy += s.ky * s.kick;
    s.flash = performance.now();
    addScore(s.score, ball.x, ball.y);
    sfx.sling();
  }
}

function collideCircle(o, kickSpeed, rest, onHit) {
  const nx = ball.x - o.x, ny = ball.y - o.y;
  const d = Math.hypot(nx, ny), minD = BALL_R + o.r;
  if (d >= minD || d === 0) return;
  const ux = nx / d, uy = ny / d;
  ball.x += ux * (minD - d);
  ball.y += uy * (minD - d);
  const vn = ball.vx * ux + ball.vy * uy;
  if (vn < 0) {
    ball.vx -= (1 + rest) * vn * ux;
    ball.vy -= (1 + rest) * vn * uy;
  }
  const out = ball.vx * ux + ball.vy * uy;
  if (out < kickSpeed) {
    ball.vx += ux * (kickSpeed - out);
    ball.vy += uy * (kickSpeed - out);
  }
  onHit(o);
}

function flipperTip(f) {
  return { x: f.px + f.len * Math.cos(f.ang), y: f.py + f.len * Math.sin(f.ang) };
}

function collideFlipper(f) {
  const tip = flipperTip(f);
  const s = { x1: f.px, y1: f.py, x2: tip.x, y2: tip.y };
  const c = closestOnSeg(s, ball.x, ball.y);
  let nx = ball.x - c.x, ny = ball.y - c.y;
  const d = Math.hypot(nx, ny), minD = BALL_R + FLIP_R;
  if (d >= minD || d === 0) return;
  nx /= d; ny /= d;
  ball.x += nx * (minD - d);
  ball.y += ny * (minD - d);
  const rx = c.x - f.px, ry = c.y - f.py;
  const svx = -f.w * ry, svy = f.w * rx;
  const rvx = ball.vx - svx, rvy = ball.vy - svy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const e = 0.45;
    ball.vx -= (1 + e) * vn * nx;
    ball.vy -= (1 + e) * vn * ny;
  }
}

function stepPhysics(dt, now) {
  for (const f of [flipL, flipR]) {
    const target = f.pressed ? f.actAng : f.restAng;
    const speed = f.pressed ? 22 : 12;
    const prev = f.ang;
    const diff = target - f.ang;
    const maxStep = speed * dt;
    f.ang += Math.abs(diff) < maxStep ? diff : Math.sign(diff) * maxStep;
    f.w = (f.ang - prev) / dt;
    if (f.pressed && !f.wasPressed) sfx.flipper();
    f.wasPressed = f.pressed;
  }

  if (state === 'plunger') {
    ball.x = 375; ball.y = 766; ball.vx = 0; ball.vy = 0;
    if (plungerHeld) plungerPower = Math.min(1, plungerPower + dt / 1.4);
    return;
  }
  if (state !== 'play') return;

  // движение шара по трубе
  if (tube.active) {
    tube.t += dt * 1.1;
    const p = tubePoint(tube.t * tube.len);
    ball.x = p.x; ball.y = p.y; ball.vx = 0; ball.vy = 0;
    trail.push({ x: ball.x, y: ball.y });
    if (trail.length > 10) trail.shift();
    if (tube.t >= 1) {
      tube.active = false;
      tube.cool = now + 5000;
      ball.vx = 120; ball.vy = 320;
    }
    return;
  }

  const sub = dt / SUB;
  for (let i = 0; i < SUB; i++) {
    // гравитационная яма: притяжение
    const wdx = well.x - ball.x, wdy = well.y - ball.y;
    const wd = Math.hypot(wdx, wdy);
    if (wd < 70 && wd > 1) {
      const pull = 150 + 520 * (1 - wd / 70);
      ball.vx += (wdx / wd) * pull * sub;
      ball.vy += (wdy / wd) * pull * sub;
      well.timer += sub;
      if (well.timer > 3) { // страховка от вечной орбиты — выброс
        const a = (-150 + Math.random() * 120) * D;
        ball.vx = Math.cos(a) * 850;
        ball.vy = Math.sin(a) * 850;
        well.timer = 0; well.capture = 0; well.flash = now;
        addScore(500, well.x, well.y);
        sfx.well();
      }
      if (wd < 13) {
        ball.vx *= 0.985; ball.vy *= 0.985;
        well.capture += sub;
        if (well.capture > 0.7) {
          const a = (-150 + Math.random() * 120) * D;
          ball.vx = Math.cos(a) * 850;
          ball.vy = Math.sin(a) * 850;
          well.capture = 0;
          well.flash = now;
          addScore(500, well.x, well.y);
          msg('ЧЁРНАЯ ДЫРА! +500', 1200);
          sfx.well();
        }
      } else well.capture = 0;
    } else { well.capture = 0; well.timer = 0; }

    ball.vy += GRAV * sub;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > MAXV) { ball.vx *= MAXV / sp; ball.vy *= MAXV / sp; }
    ball.x += ball.vx * sub;
    ball.y += ball.vy * sub;

    for (const s of segs) collideSeg(s);
    for (const b of bumpers) collideCircle(b, 620, 0.55, o => {
      o.flash = now; addScore(o.score, o.x, o.y); sfx.bumper();
    });
    for (const p of pegs) collideCircle(p, 260, 0.5, o => {
      o.flash = now; addScore(10, o.x, o.y); sfx.peg();
    });
    for (const t of targets) collideCircle(t, 380, 0.5, o => {
      o.flash = now;
      if (!o.lit) {
        o.lit = true; addScore(o.score, o.x, o.y); sfx.target();
        if (targets.every(t2 => t2.lit)) {
          targets.forEach(t2 => t2.lit = false);
          kickback.lit = true;
          if (!targetsDoneOnce) {
            targetsDoneOnce = true;
            addScore(5000, o.x, o.y);
            msg('ВСЕ ЦЕЛИ! +5000 · КИКБЭК ГОТОВ');
          } else {
            // повторный сбор за тот же шар — дополнительный шар
            extraBalls++;
            addScore(5000, o.x, o.y);
            msg('ДОПОЛНИТЕЛЬНЫЙ ШАР!', 2200);
            sfx.mult();
            hud();
          }
        }
      } else addScore(50, o.x, o.y);
    });
    collideFlipper(flipL);
    collideFlipper(flipR);

    // ролловеры (+ скилл-шот)
    for (let ri = 0; ri < rollovers.length; ri++) {
      const r = rollovers[ri];
      if (Math.hypot(ball.x - r.x, ball.y - r.y) < 16 && now - r.cool > 400) {
        r.cool = now;
        r.lit = true;
        if (skillShot && skillShot.until && now < skillShot.until && ri === skillShot.lane) {
          addScore(10000, r.x, r.y);
          msg('СКИЛЛ-ШОТ! +10000', 2000);
          sfx.mult();
          skillShot = null;
        } else {
          addScore(50, r.x, r.y);
        }
        sfx.rollover();
        if (rollovers.every(r2 => r2.lit)) {
          mult = Math.min(4, mult + 1);
          rollovers.forEach(r2 => r2.lit = false);
          msg('БОНУС ×' + mult, 1800);
          sfx.mult();
          hud();
        }
      }
    }

    // бустеры
    for (const bst of boosters) {
      if (Math.hypot(ball.x - bst.x, ball.y - bst.y) < bst.r && now - bst.cool > 700) {
        bst.cool = now; bst.flash = now;
        ball.vx = bst.dx * bst.speed;
        ball.vy = bst.dy * bst.speed;
        addScore(25, bst.x, bst.y);
        sfx.boost();
      }
    }

    // кикбэк: спасение левого аутлейна
    if (kickback.lit && ball.vy > 100 && ball.x < 100 && ball.y > 630 && ball.y < 790) {
      kickback.lit = false;
      kickback.flash = now;
      ball.vx = 320;
      ball.vy = -840;
      addScore(150, ball.x, ball.y);
      msg('КИКБЭК! СПАСЕН', 1300);
      sfx.kickback();
    }

    // лампы: собери все 5 — энергощиты в аутлейнах
    for (const l of lamps) {
      if (!l.lit && Math.hypot(ball.x - l.x, ball.y - l.y) < 14) {
        l.lit = true;
        addScore(100, l.x, l.y);
        sfx.rollover();
        if (lamps.every(l2 => l2.lit)) {
          lamps.forEach(l2 => l2.lit = false);
          shieldsActive = true;
          msg('ЭНЕРГОЩИТЫ АКТИВНЫ!', 2200, '#69f0ae');
          sfx.mult();
        }
      }
    }

    // энергощиты
    if (shieldsActive) {
      for (const sh of shieldSegs) {
        const c = closestOnSeg(sh, ball.x, ball.y);
        let nx = ball.x - c.x, ny = ball.y - c.y;
        const d = Math.hypot(nx, ny);
        if (d < BALL_R && d > 0) {
          nx /= d; ny /= d;
          ball.x += nx * (BALL_R - d);
          ball.y += ny * (BALL_R - d);
          const vn = ball.vx * nx + ball.vy * ny;
          if (vn < 0) {
            ball.vx -= (1 + sh.e) * vn * nx;
            ball.vy -= (1 + sh.e) * vn * ny;
            ball.vx += sh.kx * sh.kick;
            ball.vy += sh.ky * sh.kick;
            sh.flash = now;
            addScore(50, ball.x, ball.y);
            msg('ЩИТ!', 900, '#69f0ae');
            sfx.kickback();
          }
        }
      }
    }

    // спиннеры: вращение + столкновение с лопастью
    for (const sp of spinners) {
      sp.ang += sp.w * sub;
      sp.w *= (1 - 0.7 * sub);
      sp.acc += Math.abs(sp.w * sub);
      if (sp.acc > Math.PI * 2) {
        sp.acc -= Math.PI * 2;
        addScore(50, sp.x, sp.y);
        sfx.peg();
      }
      const hx = Math.cos(sp.ang) * sp.len / 2, hy = Math.sin(sp.ang) * sp.len / 2;
      const c = closestOnSeg({ x1: sp.x - hx, y1: sp.y - hy, x2: sp.x + hx, y2: sp.y + hy }, ball.x, ball.y);
      let nx = ball.x - c.x, ny = ball.y - c.y;
      const d = Math.hypot(nx, ny), minD = BALL_R + 4.5;
      if (d < minD && d > 0) {
        nx /= d; ny /= d;
        ball.x += nx * (minD - d);
        ball.y += ny * (minD - d);
        const rx = c.x - sp.x, ry = c.y - sp.y;
        const svx = -sp.w * ry, svy = sp.w * rx;
        const rvx = ball.vx - svx, rvy = ball.vy - svy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          ball.vx -= 1.55 * vn * nx;
          ball.vy -= 1.55 * vn * ny;
          // раскрутка лопасти от удара
          sp.w += Math.max(-32, Math.min(32, (rx * rvy - ry * rvx) * 0.006));
        }
      }
    }

    // вход в трубу
    if (!tube.active && now > tube.cool &&
        Math.hypot(ball.x - tube.entryX, ball.y - tube.entryY) < tube.entryR) {
      tube.active = true; tube.t = 0;
      addScore(250, tube.entryX, tube.entryY);
      msg('ТРУБА! +250', 1200, '#4fc3f7');
      sfx.boost();
    }
  }

  // бонус «Орбита»: полный круг по верхней дуге сразу после запуска
  if (orbitCheck && performance.now() - orbitCheck < 5000 &&
      ball.x < 45 && ball.y > 150 && ball.y < 520) {
    orbitCheck = 0;
    addScore(1000, ball.x, ball.y);
    msg('ОРБИТА! +1000', 1400);
    sfx.boost();
  }

  // след шара
  trail.push({ x: ball.x, y: ball.y });
  if (trail.length > 10) trail.shift();

  // анти-застревание
  if (Math.hypot(ball.vx, ball.vy) < 8) {
    stuckTimer += dt;
    if (stuckTimer > 2.5) {
      // выброс из «колыбели» у оси флиппера — в сторону центра стола
      const dir = ball.x < 200 ? 1 : -1;
      ball.vx = dir * 320;
      ball.vy = -300;
      stuckTimer = 0;
    }
  } else stuckTimer = 0;

  if (ball.y > 825) drain();
  if (state === 'play' && ball.x > 361 && ball.y > 740 && Math.hypot(ball.vx, ball.vy) < 60) {
    state = 'plunger';
  }
}

// ---------------- Отрисовка ----------------
function drawBackground(now) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#070c26');
  g.addColorStop(0.6, '#050818');
  g.addColorStop(1, '#03040c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // туманности
  const n1 = ctx.createRadialGradient(80, 120, 10, 80, 120, 160);
  n1.addColorStop(0, 'rgba(90,40,160,.25)'); n1.addColorStop(1, 'rgba(90,40,160,0)');
  ctx.fillStyle = n1; ctx.fillRect(0, 0, W, H);
  const n2 = ctx.createRadialGradient(330, 620, 10, 330, 620, 180);
  n2.addColorStop(0, 'rgba(20,80,160,.22)'); n2.addColorStop(1, 'rgba(20,80,160,0)');
  ctx.fillStyle = n2; ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    const tw = 0.6 + 0.4 * Math.sin(now / 700 + s.x * 13.7);
    ctx.globalAlpha = s.a * tw;
    ctx.fillStyle = '#cfe0ff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// контур стола (для заливки пола)
function floorPath() {
  const pts = [];
  pts.push([390, 790], [390, 120]);
  for (let a = -30; a >= -150; a -= 6) pts.push([200 + 220 * Math.cos(a * D), 230 + 220 * Math.sin(a * D)]);
  pts.push([10, 120], [10, 535], [58, 610], [58, 796], [172, 815], [228, 815], [342, 796], [342, 610], [360, 535], [360, 790]);
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const p = proj(x, y);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
}

function drawFloor(now) {
  ctx.save();
  floorPath();
  // пол
  const g = ctx.createLinearGradient(0, 120, 0, 760);
  g.addColorStop(0, '#101c4e');
  g.addColorStop(0.55, '#0c1538');
  g.addColorStop(1, '#080d24');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // сетка
  ctx.strokeStyle = 'rgba(110,160,255,.06)';
  ctx.lineWidth = 1;
  for (let x = 40; x < 400; x += 45) {
    const a = proj(x, 0), b = proj(x, 800);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (let y = 60; y < 800; y += 60) {
    const a = proj(0, y), b = proj(400, y);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // планета на полу
  const pc = proj(195, 240);
  const pr = 85 * pc.s;
  const pg = ctx.createRadialGradient(pc.x - pr * 0.3, pc.y - pr * 0.35, pr * 0.1, pc.x, pc.y, pr);
  pg.addColorStop(0, 'rgba(255,140,80,.34)');
  pg.addColorStop(0.6, 'rgba(160,60,120,.22)');
  pg.addColorStop(1, 'rgba(60,30,90,0)');
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.arc(pc.x, pc.y, pr, 0, 7); ctx.fill();
  // кольцо планеты
  ctx.strokeStyle = 'rgba(255,190,120,.16)';
  ctx.lineWidth = 3 * pc.s;
  ctx.beginPath();
  ctx.ellipse(pc.x, pc.y, pr * 1.45, pr * 0.42, -0.28, 0, 7);
  ctx.stroke();
  ctx.restore();

  // свечение краёв стола
  floorPath();
  ctx.strokeStyle = 'rgba(90,140,255,.28)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// экструзия сегмента: боковая грань + верх
function extrudeSeg(s, sideColor, topColor, topWidth) {
  const a0 = proj(s.x1, s.y1), b0 = proj(s.x2, s.y2);
  const a1 = proj(s.x1, s.y1, s.h), b1 = proj(s.x2, s.y2, s.h);
  ctx.fillStyle = sideColor;
  ctx.beginPath();
  ctx.moveTo(a0.x, a0.y); ctx.lineTo(b0.x, b0.y);
  ctx.lineTo(b1.x, b1.y); ctx.lineTo(a1.x, a1.y);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = topColor;
  ctx.lineWidth = topWidth * a1.s;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(b1.x, b1.y); ctx.stroke();
}

function drawWalls(now) {
  for (const s of segs) {
    if (s.tag.startsWith('sling')) continue; // пращи рисуем отдельно
    const fl = s.kick && now - s.flash < 120;
    // освещение грани: ярче к зрителю
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy) || 1;
    const facing = Math.abs(dy / len); // вертикальные стены ярче видны
    const k = 0.45 + 0.4 * facing;
    const side = s.tag === 'floor' ? 'rgba(20,30,64,.9)' : `rgb(${30 * k + 14},${44 * k + 18},${88 * k + 30})`;
    const top = fl ? '#ffffff' : s.tag === 'floor' ? '#2a3c74' : '#6f95e0';
    extrudeSeg(s, side, top, s.tag === 'floor' ? 2 : 5);
  }
}

function drawSling(tri, flashKey, now) {
  const fl = now - (segs.find(s => s.tag === 'sling' &&
    Math.abs(s.x1 - tri.pts[0][0]) < 1 && Math.abs(s.y1 - tri.pts[0][1]) < 1)?.flash || 0) < 120;
  const h = 10;
  // боковые грани
  for (let i = 0; i < 3; i++) {
    const [x1, y1] = tri.pts[i], [x2, y2] = tri.pts[(i + 1) % 3];
    const a0 = proj(x1, y1), b0 = proj(x2, y2);
    const a1 = proj(x1, y1, h), b1 = proj(x2, y2, h);
    ctx.fillStyle = 'rgba(120,40,20,.95)';
    ctx.beginPath();
    ctx.moveTo(a0.x, a0.y); ctx.lineTo(b0.x, b0.y);
    ctx.lineTo(b1.x, b1.y); ctx.lineTo(a1.x, a1.y);
    ctx.closePath(); ctx.fill();
  }
  // верхняя грань
  ctx.beginPath();
  tri.pts.forEach(([x, y], i) => {
    const p = proj(x, y, h);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = fl ? '#ffffff' : '#ff8a65';
  ctx.shadowColor = '#ff7043'; ctx.shadowBlur = fl ? 18 : 8;
  ctx.fill();
  ctx.shadowBlur = 0;
}

// цилиндр (бампер/пег/цель)
function drawCylinder(o, h, capStyle, ringColor, now, flash) {
  const N = 14;
  // боковая поверхность
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const x0 = o.x + o.r * Math.cos(a0), y0 = o.y + o.r * Math.sin(a0);
    const x1 = o.x + o.r * Math.cos(a1), y1 = o.y + o.r * Math.sin(a1);
    // яркость по нормали (к зрителю — светлее)
    const ny = Math.sin((a0 + a1) / 2);
    const k = 0.35 + 0.45 * Math.max(0, ny);
    const p0 = proj(x0, y0), p1 = proj(x1, y1);
    const p0h = proj(x0, y0, h), p1h = proj(x1, y1, h);
    ctx.fillStyle = shadeColor(ringColor, k);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p1h.x, p1h.y); ctx.lineTo(p0h.x, p0h.y);
    ctx.closePath(); ctx.fill();
  }
  // колпак
  const c = proj(o.x, o.y, h);
  const r = o.r * c.s;
  const g = ctx.createRadialGradient(c.x - r * 0.3, c.y - r * 0.35, r * 0.1, c.x, c.y, r);
  g.addColorStop(0, flash ? '#ffffff' : capStyle[0]);
  g.addColorStop(0.5, capStyle[1]);
  g.addColorStop(1, capStyle[2]);
  ctx.fillStyle = g;
  if (flash) { ctx.shadowColor = capStyle[1]; ctx.shadowBlur = 20; }
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.fill();
  ctx.shadowBlur = 0;
  // блик
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.beginPath(); ctx.arc(c.x - r * 0.3, c.y - r * 0.38, r * 0.2, 0, 7); ctx.fill();
}

function shadeColor(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * k);
  const g = Math.min(255, ((n >> 8) & 255) * k);
  const b = Math.min(255, (n & 255) * k);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function drawBoosters(now) {
  for (const b of boosters) {
    const fl = now - b.flash < 200;
    const c = proj(b.x, b.y);
    const pulse = 0.55 + 0.3 * Math.sin(now / 220);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.atan2(b.dy, b.dx));
    const sc = c.s * (fl ? 1.35 : 1);
    ctx.scale(sc, sc * 0.82);
    for (let i = 0; i < 3; i++) {
      const off = i * 7 - 7;
      ctx.strokeStyle = fl ? '#ffffff' : `rgba(80,255,140,${pulse - i * 0.12})`;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#69f0ae'; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(off - 4, -7); ctx.lineTo(off + 4, 0); ctx.lineTo(off - 4, 7);
      ctx.stroke();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }
}

function drawWell(now) {
  const c = proj(well.x, well.y);
  const r = well.r * c.s;
  const fl = now - well.flash < 300;
  // воронка
  const g = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, r * 1.3);
  g.addColorStop(0, '#000');
  g.addColorStop(0.55, 'rgba(60,10,90,.85)');
  g.addColorStop(1, 'rgba(60,10,90,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(c.x, c.y, r * 1.3, 0, 7); ctx.fill();
  // вращающаяся спираль
  ctx.strokeStyle = fl ? '#ffffff' : 'rgba(200,120,255,.7)';
  ctx.lineWidth = 1.6;
  ctx.shadowColor = '#c078ff'; ctx.shadowBlur = 10;
  for (let i = 0; i < 3; i++) {
    const a0 = now / 350 + i * (Math.PI * 2 / 3);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * (0.45 + i * 0.25), a0, a0 + 2.2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawKickback(now) {
  const c = proj(38, 690);
  const lit = kickback.lit;
  const pulse = lit ? 0.6 + 0.4 * Math.sin(now / 200) : 0.25;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(c.s, c.s);
  ctx.rotate(-Math.PI / 2);
  for (let i = 0; i < 2; i++) {
    const off = i * 9 - 4;
    ctx.strokeStyle = lit ? `rgba(255,225,77,${pulse - i * 0.15})` : 'rgba(120,120,140,.3)';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    if (lit) { ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 10; }
    ctx.beginPath();
    ctx.moveTo(off - 5, -8); ctx.lineTo(off + 5, 0); ctx.lineTo(off - 5, 8);
    ctx.stroke();
  }
  ctx.restore();
  ctx.shadowBlur = 0;
}

function drawLamps(now) {
  for (const l of lamps) {
    const c = proj(l.x, l.y, 2);
    const rr = l.r * c.s;
    if (l.lit) {
      const pulse = 0.7 + 0.3 * Math.sin(now / 250);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#18ffff';
      ctx.shadowColor = '#18ffff'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = 'rgba(20,35,80,.9)';
      ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(110,150,220,.6)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
}

function drawShields(now) {
  if (!shieldsActive) return;
  const pulse = 0.65 + 0.35 * Math.sin(now / 180);
  for (const sh of shieldSegs) {
    const a = proj(sh.x1, sh.y1, 4), b = proj(sh.x2, sh.y2, 4);
    const fl = now - sh.flash < 150;
    ctx.strokeStyle = fl ? '#ffffff' : `rgba(105,240,174,${pulse})`;
    ctx.lineWidth = 7 * a.s;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#69f0ae'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawSpinners(now) {
  for (const sp of spinners) {
    const c = proj(sp.x, sp.y, 8);
    const half = sp.len / 2 * c.s;
    const ca = Math.cos(sp.ang), sa = Math.sin(sp.ang) * 0.82;
    // «размытие» при быстром вращении
    if (Math.abs(sp.w) > 8) {
      ctx.strokeStyle = 'rgba(180,210,255,.25)';
      ctx.lineWidth = 7 * c.s;
      ctx.lineCap = 'round';
      for (const off of [-0.35, 0.35]) {
        const ca2 = Math.cos(sp.ang + off), sa2 = Math.sin(sp.ang + off) * 0.82;
        ctx.beginPath();
        ctx.moveTo(c.x - ca2 * half, c.y - sa2 * half);
        ctx.lineTo(c.x + ca2 * half, c.y + sa2 * half);
        ctx.stroke();
      }
    }
    // лопасть
    ctx.strokeStyle = '#2c3d6e';
    ctx.lineWidth = 9 * c.s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c.x - ca * half, c.y - sa * half);
    ctx.lineTo(c.x + ca * half, c.y + sa * half);
    ctx.stroke();
    ctx.strokeStyle = '#dfe9ff';
    ctx.lineWidth = 5.5 * c.s;
    ctx.shadowColor = '#9fc0ff'; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(c.x - ca * half, c.y - sa * half);
    ctx.lineTo(c.x + ca * half, c.y + sa * half);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // ось
    ctx.fillStyle = '#8fa5d8';
    ctx.beginPath(); ctx.arc(c.x, c.y, 3.5 * c.s, 0, 7); ctx.fill();
  }
}

function drawTube(now) {
  // труба
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  TUBE_PATH.forEach(([x, y], i) => {
    const p = proj(x, y, 6);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = 'rgba(60,80,140,.85)';
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(140,180,255,.5)';
  ctx.lineWidth = 4;
  ctx.stroke();
  // зев трубы
  const e = proj(tube.entryX, tube.entryY, 6);
  const open = !tube.active && now > tube.cool;
  const pulse = open ? 0.6 + 0.4 * Math.sin(now / 260) : 0.25;
  ctx.strokeStyle = `rgba(79,195,247,${pulse})`;
  ctx.lineWidth = 3;
  ctx.shadowColor = '#4fc3f7'; ctx.shadowBlur = open ? 12 : 0;
  ctx.beginPath(); ctx.arc(e.x, e.y, 9 * e.s, 0, 7); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(4,8,24,.95)';
  ctx.beginPath(); ctx.arc(e.x, e.y, 6.5 * e.s, 0, 7); ctx.fill();
}


function drawRollovers(now) {
  for (let i = 0; i < rollovers.length; i++) {
    const r = rollovers[i];
    const c = proj(r.x, r.y, 2);
    const rr = r.r * c.s;
    // лейн скилл-шота пульсирует
    if (skillShot && state === 'plunger' && i === skillShot.lane) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 120);
      ctx.strokeStyle = `rgba(255,80,80,${0.4 + 0.6 * pulse})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ff5252'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(c.x, c.y, rr + 3 + pulse * 2, 0, 7); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    if (r.lit) {
      ctx.fillStyle = '#ffe14d';
      ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = 'rgba(20,35,80,.9)';
      ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, 7); ctx.fill();
      ctx.strokeStyle = '#6f8fd0';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

function drawFlipper(f) {
  const tip = flipperTip(f);
  // основание
  const b0 = proj(f.px, f.py, 2), b1 = proj(tip.x, tip.y, 2);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5c3d00';
  ctx.lineWidth = (FLIP_R * 2 + 4) * b0.s;
  ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.stroke();
  // верх
  const t0 = proj(f.px, f.py, 10), t1 = proj(tip.x, tip.y, 10);
  const g = ctx.createLinearGradient(t0.x, t0.y, t1.x, t1.y);
  g.addColorStop(0, '#ffe14d');
  g.addColorStop(1, '#ff9d2e');
  ctx.strokeStyle = g;
  ctx.lineWidth = FLIP_R * 2 * t0.s;
  ctx.beginPath(); ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.stroke();
  const ax = proj(f.px, f.py, 12);
  ctx.fillStyle = '#8fa5d8';
  ctx.beginPath(); ctx.arc(ax.x, ax.y, 3.5 * ax.s, 0, 7); ctx.fill();
}

function drawPlunger() {
  const baseY = 788;
  const plateY = 775 + plungerPower * 12;
  // пружина
  ctx.strokeStyle = '#8899c0';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const coils = 6, wdt = 8;
  for (let i = 0; i <= coils; i++) {
    const y = baseY - (baseY - plateY) * (i / coils);
    const p = proj(375 + (i % 2 ? wdt : -wdt), y, 4);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  // платформа
  const p1 = proj(363, plateY, 6), p2 = proj(387, plateY, 6);
  ctx.strokeStyle = '#ef5350';
  ctx.lineWidth = 5 * p1.s;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  // шкала силы — у левого края стола, вдали от шара
  const barTop = proj(4, 470), barBot = proj(4, 660);
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.fillRect(barTop.x - 2, barTop.y, 4, barBot.y - barTop.y);
  const hp = (barBot.y - barTop.y) * plungerPower;
  ctx.fillStyle = plungerPower > 0.85 ? '#ff5252' : '#ffd740';
  ctx.shadowColor = '#ffd740'; ctx.shadowBlur = plungerPower > 0 ? 8 : 0;
  ctx.fillRect(barTop.x - 2, barBot.y - hp, 4, hp);
  ctx.shadowBlur = 0;
}

function drawBall() {
  if (state === 'over') return;
  // след
  for (let i = 0; i < trail.length; i++) {
    const t = trail[i];
    const p = proj(t.x, t.y, BALL_R);
    ctx.globalAlpha = (i / trail.length) * 0.22;
    ctx.fillStyle = '#bcd2ff';
    ctx.beginPath(); ctx.arc(p.x, p.y, BALL_R * p.s * (0.4 + 0.6 * i / trail.length), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // тень
  const sh = proj(ball.x + 4, ball.y + 5);
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath();
  ctx.ellipse(sh.x, sh.y, BALL_R * sh.s, BALL_R * sh.s * 0.55, 0, 0, 7);
  ctx.fill();
  // шар
  const p = proj(ball.x, ball.y, BALL_R);
  const r = BALL_R * p.s;
  const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, '#b9c4d6');
  g.addColorStop(1, '#3d4653');
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(255,255,255,.6)';
  ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
  ctx.shadowBlur = 0;
}

function drawPopups(now) {
  ctx.textAlign = 'center';
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    const age = now - p.t0;
    if (age > 900) { popups.splice(i, 1); continue; }
    const rise = (age / 900) * 26;
    const c = proj(p.x, p.y, 34);
    ctx.globalAlpha = 1 - age / 900;
    ctx.font = `bold ${Math.round(11 * c.s + 4)}px "Courier New", monospace`;
    ctx.fillStyle = '#ffe14d';
    ctx.shadowColor = '#ff9800'; ctx.shadowBlur = 8;
    ctx.fillText(p.text, c.x, c.y - rise);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

function drawMessages(now) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px "Courier New", monospace';
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const age = now - m.t0;
    if (age > m.dur) { messages.splice(i, 1); continue; }
    // всплытие вверх + угасание, как у очков
    const rise = Math.min(age / 900, 1) * 26;
    const fadeIn = Math.min(age / 150, 1);
    const fadeOut = age > m.dur - 500 ? Math.max(0, (m.dur - age) / 500) : 1;
    ctx.globalAlpha = fadeIn * fadeOut;
    ctx.fillStyle = m.color;
    ctx.shadowColor = m.color; ctx.shadowBlur = 12;
    ctx.fillText(m.text, W / 2, 108 + i * 20 - rise);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  if (paused) {
    ctx.fillStyle = 'rgba(3,6,20,.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#7fd0ff';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ПАУЗА', W / 2, H / 2);
  }
}

function drawApron() {
  const pts = [[58, 796], [172, 815], [228, 815], [342, 796], [342, 850], [58, 850]];
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const p = proj(x, y);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,14,38,.9)';
  ctx.fill();
  // подпись — под столом, вне игрового поля
  ctx.fillStyle = 'rgba(80,110,180,.55)';
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('КОСМИЧЕСКИЙ ДЕД · PINBALL', W / 2, H - 14);
}

// ---------------- Инициализация проекции ----------------
(function initFit() {
  const samples = [];
  for (const s of segs) { samples.push([s.x1, s.y1], [s.x2, s.y2]); }
  samples.push([200, 10], [10, 230], [390, 230], [58, 850], [342, 850]);
  fitProjection(samples);
})();

// ---------------- Главный цикл ----------------
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.05) dt = 0.05;
  if (!paused) stepPhysics(dt, now);

  ctx.setTransform(SS, 0, 0, SS, 0, 0);
  drawBackground(now);
  drawFloor(now);
  drawBoosters(now);
  drawLamps(now);
  drawWell(now);
  drawKickback(now);
  drawRollovers(now);
  drawApron();
  drawWalls(now);
  drawSling(SLING_L, 'slingL', now);
  drawSling(SLING_R, 'slingR', now);
  drawShields(now);
  drawTube(now);
  drawSpinners(now);
  for (const t of targets) drawCylinder(t, t.h, t.lit ? ['#fff', '#18ffff', '#0a5c66'] : ['#dfe9ff', '#3a5cb8', '#16265c'], '#1a2c5e', now, now - t.flash < 150);
  for (const p of pegs) drawCylinder(p, p.h, ['#ffffff', '#c0ccff', '#4a5a9e'], '#8fa0e0', now, now - p.flash < 100);
  for (const b of bumpers) drawCylinder(b, b.h, ['#ffffff', b.color, '#30060a'], b.color, now, now - b.flash < 120);
  drawFlipper(flipL);
  drawFlipper(flipR);
  drawPlunger();
  drawBall();
  drawPopups(now);
  drawMessages(now);
}

hud();
msg('УДЕРЖИВАЙ ПРОБЕЛ — ЗАПУСК', 2600);
requestAnimationFrame(frame);
})();
