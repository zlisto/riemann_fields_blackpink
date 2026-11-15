// Shared engine for the math explainer videos: drawing helpers, a small 3D
// surface renderer, browser text-to-speech narration, and the player UI.
// A video page defines its scenes and calls startVideo({ title, subtitle, scenes }).

// ───────────────────────── the course ─────────────────────────
// Order of the series. `ready: false` shows as "coming soon" on the course page.
const COURSE = [
  { slug: 'elliptic-curve-torus', title: 'An elliptic curve is a torus', blurb: 'Why y² = x³ + ax + b over the complex numbers is secretly a donut: two sheets, branch cuts, and Weierstrass’s lattice.', ready: true },
  { slug: 'homology-counting-holes', title: 'Homology: counting holes', blurb: 'Loops modulo boundaries. Why the torus has H₁ = ℤ², and why a surface with g holes has 2g independent loops.', ready: true },
  { slug: 'cohomology-measuring-loops', title: 'Cohomology: measuring loops', blurb: 'Walls that count crossings, cup products, and the Lefschetz formula that counts fixed points with traces.', ready: true },
  { slug: 'counting-points-mod-p', title: 'Counting points mod p', blurb: 'Solve the curve in clock arithmetic and count. The answer is always p + 1, give or take 2√p. Why 2?', ready: true },
  { slug: 'weil-conjectures', title: 'The Weil conjectures', blurb: 'Pack every count into a zeta function. It is a fraction whose shape is the cohomology, and whose zeros obey a Riemann hypothesis.', ready: true },
  { slug: 'frobenius-lefschetz', title: 'Frobenius & Lefschetz', blurb: 'Points mod p are the fixed points of x ↦ xᵖ. Lefschetz turns counting them into traces on H⁰, H¹, H².', ready: true },
  { slug: 'etale-cohomology', title: 'Étale cohomology', blurb: 'Grothendieck’s machine: a cohomology for equations mod p, built without any ordinary geometry.', ready: true },
  { slug: 'deligne-proof', title: 'Deligne’s proof', blurb: 'How Deligne proved the Riemann hypothesis over finite fields in 1974, and won the Fields Medal.', ready: true },
];

// ───────────────────────── canvas + helpers ─────────────────────────
const W = 1280, H = 720;
let ctx = null;

const COL = {
  bg: '#07040a', pink: '#ff4fa3', soft: '#ff9ccf', white: '#fbeef5',
  dim: '#7a5a6e', lav: '#c9a2ff',
};
const MATH = '"Cambria Math","STIX Two Math","Times New Roman",serif';
const SANS = '"Segoe UI",system-ui,-apple-system,sans-serif';
const TAU = Math.PI * 2;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const ease = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const lerp = (a, b, k) => a + (b - a) * k;
// fade in over [a, b], fade out over [c, d]
const fade = (p, a, b, c = 2, d = 3) => ease(seg(p, a, b)) * (1 - ease(seg(p, c, d)));

function txt(s, x, y, o = {}) {
  const a = o.alpha ?? 1;
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = o.color || COL.white;
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${o.size || 30}px ${o.font || SANS}`;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = 'middle';
  if (o.glow) { ctx.shadowColor = o.color || COL.pink; ctx.shadowBlur = o.glow; }
  ctx.fillText(s, x, y);
  ctx.restore();
}
function line(x1, y1, x2, y2, c, w = 2, a = 1) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}
// mid = 0: arrowhead at the end; mid = 1 or 2: one or two heads at the midpoint.
function arrow(x1, y1, x2, y2, c, w = 2.5, a = 1, mid = 0) {
  if (a <= 0) return;
  line(x1, y1, x2, y2, c, w, a);
  const ang = Math.atan2(y2 - y1, x2 - x1), ca = Math.cos(ang), sa = Math.sin(ang);
  ctx.save();
  ctx.globalAlpha = a; ctx.fillStyle = c;
  const head = (px, py) => {
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - 14 * Math.cos(ang - 0.42), py - 14 * Math.sin(ang - 0.42));
    ctx.lineTo(px - 14 * Math.cos(ang + 0.42), py - 14 * Math.sin(ang + 0.42));
    ctx.closePath(); ctx.fill();
  };
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  if (mid === 0) head(x2, y2);
  if (mid === 1) head(mx + 7 * ca, my + 7 * sa);
  if (mid === 2) { head(mx + 1 * ca, my + 1 * sa); head(mx + 13 * ca, my + 13 * sa); }
  ctx.restore();
}
function dot(x, y, r, c, a = 1, glow = 0) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a; ctx.fillStyle = c;
  if (glow) { ctx.shadowColor = c; ctx.shadowBlur = glow; }
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}
function ring(x, y, r, c, a = 1, w = 2) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = w;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.restore();
}
function polyline(pts, c, w = 3, a = 1, glow = 0, closed = false) {
  if (pts.length < 2 || a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = w;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (glow) { ctx.shadowColor = c; ctx.shadowBlur = glow; }
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
  if (closed) ctx.closePath();
  ctx.stroke();
  ctx.restore();
}
function rr(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}
function panel(x, y, w, h, title, a) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(255,79,163,0.04)'; ctx.strokeStyle = 'rgba(255,79,163,0.28)'; ctx.lineWidth = 1.2;
  rr(x, y, w, h, 14); ctx.fill(); ctx.stroke();
  ctx.restore();
  if (title) txt(title, x + 20, y + 26, { align: 'left', size: 18, color: COL.soft, alpha: a });
}
// Fill a closed polygon; an optional second polygon is cut out as a hole.
function fillPath(pts, color, a, holePts = null) {
  if (a <= 0 || pts.length < 3) return;
  ctx.save();
  ctx.globalAlpha = a; ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...pts[0]); for (const p of pts) ctx.lineTo(...p); ctx.closePath();
  if (holePts) { ctx.moveTo(...holePts[0]); for (const p of holePts) ctx.lineTo(...p); ctx.closePath(); }
  ctx.fill('evenodd');
  ctx.restore();
}
// A shaded 2D ball (a sphere drawn flat).
function ball(cx, cy, r, a) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#ff8cc6'); g.addColorStop(0.45, '#c92a78'); g.addColorStop(1, '#2a0718');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,180,220,0.3)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.28, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}
function bg() {
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 40, W * 0.5, H * 0.45, W * 0.75);
  g.addColorStop(0, 'rgba(255,45,138,0.10)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function chapterLabel(n, s) {
  txt(`${String(n).padStart(2, '0')} · ${s.toUpperCase()}`, 48, 40, { size: 16, color: COL.pink, align: 'left', weight: 600 });
}

// complex numbers as [re, im]
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const csqrt = (a) => {
  const r = Math.hypot(a[0], a[1]);
  const re = Math.sqrt((r + a[0]) / 2);
  let im = Math.sqrt(Math.max(0, (r - a[0]) / 2));
  if (a[1] < 0) im = -im;
  return [re, im];
};

// ─────────────────────── 3D surfaces ───────────────────────
// Default surface: a rectangle (u along ω₁, v along ω₂) rolled in v (t1: 0→1 gives a
// cylinder), then bent in u (t2: 0→1 gives a torus). u = around the hole, v = around the tube.
const NU = 48, NV = 22, TUBE = 0.42;
const WD = TAU, HD = TAU * TUBE;

function bend(s, L, t) {
  if (t < 1e-4) return [L * (s - 0.5), 0, 0];
  const R = L / (TAU * t), ph = (s - 0.5) * TAU * t;
  return [R * Math.sin(ph), R * (1 - Math.cos(ph)), ph];
}
function surfPoint(u, v, t1, t2, sh) {
  const [yy, zz] = bend(v, HD, t1);
  const x = WD * (u - 0.5) + sh * HD * (v - 0.5);
  if (t2 < 1e-4) return [x, yy, zz];
  const r = HD / TAU;               // cylinder radius (t1 is 1 by now)
  const oz = zz - r;
  const [bx, bz, ps] = bend(u, WD, t2);
  return [bx - oz * Math.sin(ps), yy, r + bz + oz * Math.cos(ps)];
}
// Unit sphere: v = 0 is the north pole (top), v = 1 the south pole.
const spherePoint = (u, v) => {
  const th = Math.PI * v, ph = TAU * u;
  return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
};

const mixRGB = (a, b, k) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
const LIGHT = (() => { const l = [-0.45, 0.65, -0.6], n = Math.hypot(...l); return l.map((v) => v / n); })();

// Draws a shaded surface with painter's-algorithm depth sorting.
//   fn(u, v) → [x, y, z]  (defaults to the rectangle→cylinder→torus morph)
//   hu / hv: highlighted parameter lines [{ i | j, c, w }]
//   curves: [{ pts: [[u, v], ...], c, w }] drawn on the surface, depth-sorted with it
function drawSurface(o) {
  const {
    t1 = 1, t2 = 1, sh = 0, fn = null, yaw = 0, pitch = 0, cx = W / 2, cy = H / 2, scale = 130,
    alpha = 1, hu = [], hv = [], curves = [], nu = NU, nv = NV, center = true,
  } = o;
  if (alpha <= 0) return;
  const F = fn || ((u, v) => surfPoint(u, v, t1, t2, sh));
  const D = 9, f = scale * D;
  const P = [];
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const p = F(i / nu, j / nv);
    P.push(p);
    for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
  }
  const c0 = center ? [0, 1, 2].map((k) => (mn[k] + mx[k]) / 2) : [0, 0, 0];
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const view = ([x, y, z]) => {
    x -= c0[0]; y -= c0[1]; z -= c0[2];
    const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
    const y2 = y * cp + z1 * sp, z2 = -y * sp + z1 * cp;
    return [x1, y2, z2, cx + (f * x1) / (D + z2), cy - (f * y2) / (D + z2)];
  };
  const Q = P.map(view);
  const at = (i, j) => Q[i * (nv + 1) + j];
  const items = [];
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    items.push({ i, j, a, b, c, d, z: (a[2] + b[2] + c[2] + d[2]) / 4 });
  }
  for (const cv of curves) {
    const pts = cv.pts.map(([u, v]) => view(F(u, v)));
    for (let k = 0; k + 1 < pts.length; k++) {
      items.push({ line: true, p: pts[k], q: pts[k + 1], c: cv.c, w: cv.w || 4, z: (pts[k][2] + pts[k + 1][2]) / 2 - 0.04 });
    }
  }
  items.sort((p, q) => q.z - p.z);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const edge = (p, q, color, w) => {
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(p[3], p[4]); ctx.lineTo(q[3], q[4]); ctx.stroke();
  };
  for (const q of items) {
    if (q.line) { edge(q.p, q.q, q.c, q.w); continue; }
    const { a, b, c, d } = q;
    // normal from the diagonals (robust where a quad collapses to a triangle, e.g. at a pole)
    const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const e2 = [d[0] - b[0], d[1] - b[1], d[2] - b[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const nl = Math.hypot(...n) || 1;
    n = n.map((v) => v / nl);
    const front = n[0] * -a[0] + n[1] * -a[1] + n[2] * (-D - a[2]) > 0;
    const k = 0.22 + 0.78 * Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    const col = front ? mixRGB([58, 8, 36], [255, 95, 174], k) : mixRGB([26, 6, 18], [170, 40, 110], k);
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(a[3], a[4]); ctx.lineTo(b[3], b[4]); ctx.lineTo(c[3], c[4]); ctx.lineTo(d[3], d[4]);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (q.i % 4 === 0) edge(a, d, 'rgba(10,0,6,0.35)', 0.7);
    if (q.j % 4 === 0) edge(a, b, 'rgba(10,0,6,0.35)', 0.7);
    for (const h of hv) {
      if (h.j < nv && q.j === h.j) edge(a, b, h.c, h.w || 3);
      else if (h.j === nv && q.j === nv - 1) edge(d, c, h.c, h.w || 3);
    }
    for (const h of hu) {
      if (h.i < nu && q.i === h.i) edge(a, d, h.c, h.w || 3);
      else if (h.i === nu && q.i === nu - 1) edge(b, c, h.c, h.w || 3);
    }
  }
  ctx.restore();
}

// ───────────────────────────── player ─────────────────────────────
function startVideo({ title, subtitle, scenes: S }) {
  document.body.innerHTML = `
  <main>
    <header>
      <nav class="course-nav" id="course-nav"></nav>
      <h1></h1>
      <p></p>
    </header>
    <div class="player" id="player">
      <canvas id="cv" width="1280" height="720" aria-label="Animation"></canvas>
      <div class="caption" id="caption" aria-live="polite"></div>
      <button class="start" id="start" type="button">
        <div class="disc"><svg width="34" height="34" viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z" fill="#1a0610"/></svg></div>
        <span>Play with narration</span>
      </button>
      <div class="endcard" id="endcard" hidden></div>
    </div>
    <div class="controls">
      <button id="prev" type="button" title="Previous chapter (←)">⏮</button>
      <button id="play" type="button" title="Play / pause (space)">▶</button>
      <button id="next" type="button" title="Next chapter (→)">⏭</button>
      <span class="time" id="time">0:00 / 0:00</span>
      <div class="bar" id="bar"></div>
      <button id="audio" type="button" aria-pressed="true" title="Narration (m)">🔊 Voice</button>
      <button id="cc" type="button" aria-pressed="true" title="Captions (c)">CC</button>
      <button id="fs" type="button" title="Fullscreen (f)">⛶</button>
    </div>
    <ol class="chapters" id="chapters"></ol>
    <p class="hint">Narration uses your browser's built-in voices, so the voice depends on your browser and OS. Edge and Chrome have the most natural-sounding ones.</p>
  </main>`;
  const $ = (id) => document.getElementById(id);
  document.querySelector('header h1').textContent = title;
  document.querySelector('header p').textContent = subtitle || 'An animated explainer with narration. Space plays or pauses; the arrow keys skip chapters.';
  const parts = location.pathname.split('/').filter(Boolean);
  const slug = parts[parts.length - 1] === 'index.html' ? parts[parts.length - 2] : parts[parts.length - 1];
  {
    const i = COURSE.findIndex((c) => c.slug === slug);
    const nav = $('course-nav');
    const a = (href, text, cls = '') => { const el = document.createElement('a'); el.href = href; el.textContent = text; el.className = cls; nav.appendChild(el); };
    a('../contents.html', '← Contents');
    if (i >= 0) {
      const tag = document.createElement('span');
      tag.textContent = `Video ${i + 1} of ${COURSE.length}`;
      nav.appendChild(tag);
      const nx = COURSE[i + 1];
      if (nx && nx.ready) a(`../${nx.slug}/index.html`, `Next: ${nx.title} →`, 'next');
    }
  }

  // ── end card: shown when the last chapter finishes ──
  const courseIdx = COURSE.findIndex((c) => c.slug === slug);
  const nextVid = courseIdx >= 0 ? COURSE[courseIdx + 1] : null;
  let endTimer = null;
  const hideEnd = () => { clearInterval(endTimer); endTimer = null; $('endcard').hidden = true; };
  const showEnd = () => {
    const ec = $('endcard');
    if (nextVid && nextVid.ready) {
      const href = `../${nextVid.slug}/index.html`;
      ec.innerHTML = `<div class="ec-kicker">Up next · Video ${courseIdx + 2} of ${COURSE.length}</div>
        <a class="ec-next" href="${href}"><span class="ec-play">▶</span><span><b>${nextVid.title}</b><small>${nextVid.blurb}</small></span></a>
        <div class="ec-count" id="ec-count"></div>
        <div class="ec-row"><button type="button" id="ec-replay">↺ Replay</button><button type="button" id="ec-stay">Stay here</button><a href="../contents.html">Contents</a></div>`;
      let n = 10;
      const upd = () => { const el = $('ec-count'); if (el) el.textContent = `Playing next in ${n}s`; };
      upd();
      endTimer = setInterval(() => { n--; upd(); if (n <= 0) { clearInterval(endTimer); location.href = href; } }, 1000);
      $('ec-stay').addEventListener('click', () => { clearInterval(endTimer); endTimer = null; $('ec-count').textContent = ''; });
    } else {
      ec.innerHTML = `<div class="ec-kicker">Course complete</div>
        <div class="ec-done">♥ You made it all the way to Deligne’s proof.</div>
        <div class="ec-row"><button type="button" id="ec-replay">↺ Replay</button><a href="../contents.html">Contents</a><a href="../index.html">Home</a></div>`;
    }
    $('ec-replay').addEventListener('click', () => { hideEnd(); goto(0, 0); play(); });
    ec.hidden = false;
  };

  const cv = $('cv');
  ctx = cv.getContext('2d');
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);

  // Durations follow the narration length (~2.5 words/sec) plus a little breathing room.
  for (const s of S) {
    s.sentences = s.text.match(/[^.!?]+[.!?]+/g).map((x) => x.trim());
    s.est = s.text.split(/\s+/).length / 2.5;
    s.dur = s.est + 2;
    let acc = 0;
    const total = s.sentences.reduce((n, x) => n + x.length, 0);
    s.starts = s.sentences.map((x) => { const v = (acc / total) * s.est; acc += x.length; return v; });
  }
  const TOTAL = S.reduce((n, s) => n + s.dur, 0);

  // ── narration ──
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voice = null, audioOn = !!synth, captionsOn = true;
  let speechToken = 0, speechActive = false, capIdx = -1;

  const pickVoice = () => {
    if (!synth) return;
    const vs = synth.getVoices().filter((v) => /^en/i.test(v.lang));
    for (const re of [/Natural/i, /Google US English/i, /Aria|Jenny|Guy|Samantha|Zira/i, /en-US/i]) {
      const v = vs.find((x) => re.test(x.name) || re.test(x.lang));
      if (v) { voice = v; return; }
    }
    voice = vs[0] || null;
  };
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }

  const stopSpeech = () => {
    speechToken++;
    speechActive = false;
    if (synth) synth.cancel();
  };
  const sentenceAt = (s, t) => {
    if (t > s.est + 0.5) return s.sentences.length;
    let k = 0;
    while (k + 1 < s.starts.length && s.starts[k + 1] <= t) k++;
    return k;
  };
  const speakFrom = (s, k) => {
    stopSpeech();
    if (!audioOn || !synth || k >= s.sentences.length) return;
    const tok = speechToken;
    speechActive = true;
    capIdx = k;
    // Small delay: Chrome sometimes drops an utterance queued right after cancel().
    setTimeout(() => {
      if (tok !== speechToken) return;
      if (!voice) pickVoice();
      const list = s.sentences.slice(k);
      list.forEach((sentence, n) => {
        const u = new SpeechSynthesisUtterance(sentence);
        if (voice) u.voice = voice;
        u.rate = 1; u.pitch = 1;
        u.onstart = () => { if (tok === speechToken) capIdx = k + n; };
        if (n === list.length - 1) u.onend = u.onerror = () => { if (tok === speechToken) speechActive = false; };
        synth.speak(u);
      });
    }, 60);
  };

  // ── playback ──
  let idx = 0, st = 0, playing = false, holdT = 0, last = performance.now(), markedSeen = false;
  const goto = (i, t = 0) => {
    hideEnd();
    idx = Math.max(0, Math.min(S.length - 1, i));
    st = t; holdT = 0;
    if (playing) speakFrom(S[idx], sentenceAt(S[idx], st)); else stopSpeech();
  };
  const play = () => {
    if (typeof hideEnd === 'function') hideEnd();
    if (idx === S.length - 1 && st >= S[idx].dur) { idx = 0; st = 0; }
    playing = true;
    $('start').hidden = true;
    speakFrom(S[idx], sentenceAt(S[idx], st));
  };
  const pause = () => { playing = false; stopSpeech(); };
  const toggle = () => (playing ? pause() : play());

  // ── UI ──
  const fills = [], chapButtons = [];
  S.forEach((s, i) => {
    const w = document.createElement('div');
    w.className = 'segw'; w.style.flexGrow = s.dur; w.title = s.title;
    w.innerHTML = '<div class="seg"><i></i></div>';
    w.addEventListener('click', (e) => {
      const r = w.getBoundingClientRect();
      goto(i, clamp01((e.clientX - r.left) / r.width) * s.dur);
    });
    $('bar').appendChild(w);
    fills.push(w.querySelector('i'));

    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b>`;
    b.append(s.title);
    b.addEventListener('click', () => goto(i, 0));
    li.appendChild(b); $('chapters').appendChild(li);
    chapButtons.push(b);
  });

  const fmt = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
  let lastIdx = -1;
  const updateUI = () => {
    fills.forEach((f, i) => { f.style.width = (i < idx ? 100 : i > idx ? 0 : (100 * st) / S[i].dur) + '%'; });
    const elapsed = S.slice(0, idx).reduce((n, s) => n + s.dur, 0) + st;
    $('time').textContent = `${fmt(elapsed)} / ${fmt(TOTAL)}`;
    $('play').textContent = playing ? '❚❚' : '▶';
    if (lastIdx !== idx) { chapButtons.forEach((b, i) => b.classList.toggle('on', i === idx)); lastIdx = idx; }
    const s = S[idx];
    let cap = '';
    if (captionsOn) {
      if (audioOn && speechActive) cap = s.sentences[capIdx] || '';
      else if (st <= s.est + 0.5) cap = s.sentences[sentenceAt(s, st)] || '';
    }
    const el = $('caption');
    if (el.textContent !== cap) el.textContent = cap;
  };
  const render = () => {
    const s = S[idx];
    bg();
    ctx.save();
    s.draw(clamp01(st / s.dur), st, s.dur);
    ctx.restore();
    if (idx > 0) chapterLabel(idx + 1, s.title);
    updateUI();
  };
  const tick = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) {
      const s = S[idx];
      if (st < s.dur) st = Math.min(s.dur, st + dt);
      else if (audioOn && speechActive && holdT < 12) holdT += dt; // let the voice finish
      else if (idx < S.length - 1) goto(idx + 1, 0);
      else { pause(); showEnd(); }
      if (idx === S.length - 1 && !markedSeen) {   // reached the last chapter: remember for the course page
        markedSeen = true;
        try {
          const seen = JSON.parse(localStorage.getItem('course-seen') || '{}');
          seen[slug] = true;
          localStorage.setItem('course-seen', JSON.stringify(seen));
        } catch (e) { /* storage unavailable: fine */ }
      }
    }
    render();
    requestAnimationFrame(tick);
  };

  $('start').addEventListener('click', play);
  $('play').addEventListener('click', toggle);
  $('prev').addEventListener('click', () => goto(st > 2 ? idx : idx - 1, 0));
  $('next').addEventListener('click', () => goto(idx + 1, 0));
  $('audio').disabled = !synth;
  $('audio').setAttribute('aria-pressed', String(audioOn));
  const toggleAudio = () => {
    if (!synth) return;
    audioOn = !audioOn;
    $('audio').setAttribute('aria-pressed', String(audioOn));
    $('audio').textContent = audioOn ? '🔊 Voice' : '🔇 Voice';
    if (audioOn && playing) speakFrom(S[idx], sentenceAt(S[idx], st)); else stopSpeech();
  };
  const toggleCaptions = () => {
    captionsOn = !captionsOn;
    $('cc').setAttribute('aria-pressed', String(captionsOn));
  };
  $('audio').addEventListener('click', toggleAudio);
  $('cc').addEventListener('click', toggleCaptions);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else $('player').requestFullscreen?.();
  };
  $('fs').addEventListener('click', toggleFullscreen);
  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight') goto(idx + 1, 0);
    else if (e.key === 'ArrowLeft') goto(st > 2 ? idx : idx - 1, 0);
    else if (e.key === 'm') toggleAudio();
    else if (e.key === 'c') toggleCaptions();
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
  });
  addEventListener('beforeunload', () => synth && synth.cancel());

  // Hook for previewing a frame from the console: __video.goto(chapterIndex, seconds)
  window.__video = { scenes: S, goto: (i, t) => { goto(i, t); $('start').hidden = true; } };
  requestAnimationFrame(tick);
}
