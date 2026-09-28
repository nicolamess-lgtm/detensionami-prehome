/* Sale rosa dinamico — vasca 3D.
   Il sale è una mappa di altezze (COLS×ROWS) distesa sul trapezio della vasca
   nella prospettiva della foto. Il pollice sposta massa davanti a sé, il sale
   frana secondo l'angolo di riposo, le pareti lo trattengono: esce solo se viene
   spinto oltre il bordo, e allora cade sul pavimento come chicchi.
   Lo scroll della pagina inclina il vassoio: il sale scivola verso il bordo davanti.
   Coordinate di lavoro = pixel della foto (941×1671). */
window.Rooms = window.Rooms || {};
window.Rooms.emozionale = {
  photo: 'img/lettino-vuoto.webp',
  init: function (canvas, stage) {
  var IMG_W = 941, IMG_H = 1671;
  // bordo interno della vasca: (TOP: x 343→598) … (BOT: x 48→895)
  var TOP = 838, BOT = 1170, XL0 = 335, XR0 = 605, XL1 = 50, XR1 = 890;
  var COLS = 200, ROWS = 260;
  var WALL = 2.3;           // altezza della parete (oltre → trabocca)
  var SLOPE = 0.06;         // angolo di riposo (dislivello massimo tra celle)
  var THUMB_R = 62;         // raggio del pollice in px foto
  var FLOOR_MIN = 1000, FLOOR_MAX = 1660, FRONT_FLOOR_MIN = 1440;
  var GRAV = 0.55, FLOOR_BOUNCE = 0.25, FLOOR_FRICTION = 0.82;
  var MAXP = 7000;          // chicchi caduti fuori

  var ctx = canvas.getContext('2d');
  var DPR = Math.min(2, window.devicePixelRatio || 1);
  var scale = 1, offX = 0, offY = 0, W = 0, H = 0;

  /* ---------- geometria vasca ---------- */
  function edges(v) { return [XL0 + (XL1 - XL0) * v, XR0 + (XR1 - XR0) * v]; }
  function toImg(u, v) { var e = edges(v); return { x: e[0] + u * (e[1] - e[0]), y: TOP + v * (BOT - TOP) }; }
  function toGrid(x, y) { var v = (y - TOP) / (BOT - TOP), e = edges(v); return { u: (x - e[0]) / (e[1] - e[0]), v: v }; }
  function inBasin(x, y) { var g = toGrid(x, y); return g.u >= 0 && g.u <= 1 && g.v >= 0 && g.v <= 1; }

  /* ---------- mappa di altezze ---------- */
  var h = new Float32Array(COLS * ROWS), noise = new Float32Array(COLS * ROWS);
  var massTotal = 0, massOut = 0, active = 0, listeners = [];
  for (var i = 0; i < noise.length; i++) noise[i] = Math.random() - 0.5;

  function seed() {
    massTotal = 0; massOut = 0; P = 0; active = 60; spillAcc = 0;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var u = c / (COLS - 1), v = r / (ROWS - 1);
      // cumulo: più alto al centro, dolce verso i bordi, con qualche onda
      var m = Math.pow(Math.sin(Math.PI * u), 0.7);
      var wave = 0.05 * Math.sin(u * 23 + v * 7) * Math.sin(v * 31 + u * 3);
      var hh = 1.25 + 0.75 * m + wave * 1.6 + noise[r * COLS + c] * 0.05;
      h[r * COLS + c] = Math.min(WALL - 0.12, Math.max(0.8, hh));
      massTotal += h[r * COLS + c];
    }
    massPerGrain = massTotal / MAXP;
    render();
  }

  // il sale frana finché il dislivello tra celle vicine supera l'angolo di riposo
  function relax() {
    var moved = 0, i, d, f;
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        i = r * COLS + c;
        if (c < COLS - 1) {
          d = h[i] - h[i + 1];
          if (d > SLOPE) { f = (d - SLOPE) * 0.24; h[i] -= f; h[i + 1] += f; moved += f; }
          else if (d < -SLOPE) { f = (-d - SLOPE) * 0.24; h[i] += f; h[i + 1] -= f; moved += f; }
        }
        if (r < ROWS - 1) {
          d = h[i] - h[i + COLS];
          if (d > SLOPE) { f = (d - SLOPE) * 0.24; h[i] -= f; h[i + COLS] += f; moved += f; }
          else if (d < -SLOPE) { f = (-d - SLOPE) * 0.24; h[i] += f; h[i + COLS] -= f; moved += f; }
        }
      }
    }
    // un velo sottilissimo non regge: sparisce (conta come uscito)
    for (var q = 0; q < h.length; q++) if (h[q] > 0 && h[q] < 0.03) { massOut += h[q]; h[q] = 0; }
    // pareti: quello che supera il bordo trabocca
    for (var c2 = 0; c2 < COLS; c2++) { overflow(c2, 0); overflow(c2, ROWS - 1); }
    for (var r2 = 1; r2 < ROWS - 1; r2++) { overflow(0, r2); overflow(COLS - 1, r2); }
    return moved;
  }
  function overflow(c, r) {
    var i = r * COLS + c;
    if (h[i] > WALL) { var a = h[i] - WALL; h[i] = WALL; spill(a, c, r, c === 0 ? -1 : c === COLS - 1 ? 1 : 0, r === 0 ? -1 : r === ROWS - 1 ? 1 : 0); }
  }

  // scroll della pagina = il vassoio si inclina: il sale scivola in avanti (o indietro) con inerzia
  var flow = 0;
  function tilt(dy) { flow += dy * 0.014; if (flow > 6) flow = 6; if (flow < -6) flow = -6; active = 90; }
  function slide() {
    if (Math.abs(flow) < 0.03) { flow = 0; return false; }
    var f = Math.min(0.85, Math.abs(flow));
    if (flow > 0) {
      for (var r = ROWS - 2; r >= 0; r--) for (var c = 0; c < COLS; c++) {
        var i = r * COLS + c, a = h[i] * f; h[i] -= a; h[i + COLS] += a;
      }
    } else {
      for (var r2 = 1; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) {
        var i2 = r2 * COLS + c2, a2 = h[i2] * f; h[i2] -= a2; h[i2 - COLS] += a2;
      }
    }
    flow *= 0.86;
    return true;
  }

  /* ---------- chicchi fuori dalla vasca ---------- */
  var P = 0;
  var px = new Float32Array(MAXP), py = new Float32Array(MAXP), pvx = new Float32Array(MAXP), pvy = new Float32Array(MAXP);
  var pfloor = new Float32Array(MAXP), psize = new Float32Array(MAXP), ptint = new Uint8Array(MAXP), pawake = new Uint8Array(MAXP);
  var TINTS = ['#F3D8C6', '#EFC7AE', '#F8E6D8', '#E8B497', '#FBEFE6', '#E39F7E'];
  var massPerGrain = 0, spillAcc = 0;

  function spill(amount, c, r, dirU, dirV) {
    massOut += amount;
    spillAcc += amount / massPerGrain;
    var n = Math.floor(spillAcc); spillAcc -= n;
    var p = toImg(c / (COLS - 1), r / (ROWS - 1));
    for (var k = 0; k < n && P < MAXP; k++, P++) {
      px[P] = p.x + (Math.random() - 0.5) * 10; py[P] = p.y + (Math.random() - 0.5) * 6;
      pvx[P] = dirU * (2 + Math.random() * 5) + (Math.random() - 0.5) * 3;
      pvy[P] = -1 - Math.random() * 4 + dirV * 2;
      var front = dirV > 0;
      pfloor[P] = front ? FRONT_FLOOR_MIN + Math.random() * (FLOOR_MAX - FRONT_FLOOR_MIN)
        : Math.max(p.y + 40, FLOOR_MIN + Math.random() * (FLOOR_MAX - FLOOR_MIN));
      psize[P] = 3.5 + Math.random() * 2.5; ptint[P] = (Math.random() * TINTS.length) | 0; pawake[P] = 1;
    }
  }
  function stepGrains() {
    var any = false;
    for (var i = 0; i < P; i++) {
      if (!pawake[i]) continue;
      any = true;
      pvy[i] += GRAV; pvx[i] *= 0.995;
      px[i] += pvx[i]; py[i] += pvy[i];
      if (py[i] >= pfloor[i]) {
        py[i] = pfloor[i]; pvy[i] = -pvy[i] * FLOOR_BOUNCE; pvx[i] *= FLOOR_FRICTION;
        if (Math.abs(pvy[i]) < 0.6) pvy[i] = 0;
        if (Math.abs(pvx[i]) < 0.08 && pvy[i] === 0) { pawake[i] = 0; pvx[i] = 0; }
      }
      if (px[i] < -200 || px[i] > IMG_W + 200 || py[i] > IMG_H + 100) pawake[i] = 0;
    }
    return any;
  }

  /* ---------- pollice ---------- */
  var thumbs = {};
  function push(t) {
    var mx = t.x - t.px, my = t.y - t.py;
    var dl = Math.hypot(mx, my);
    t.px = t.x; t.py = t.y;
    if (dl < 0.4) return;
    var g = toGrid(t.x, t.y);
    if (g.u < -0.15 || g.u > 1.15 || g.v < -0.15 || g.v > 1.15) return;
    var e = edges(Math.min(1, Math.max(0, g.v)));
    var ru = THUMB_R / (e[1] - e[0]) * COLS, rv = THUMB_R / (BOT - TOP) * ROWS;
    var cu = g.u * COLS, cv = g.v * ROWS;
    var gm = toGrid(t.x + mx, t.y + my);
    var du = (gm.u - g.u) * COLS, dv = (gm.v - g.v) * ROWS, dn = Math.hypot(du, dv);
    du /= dn; dv /= dn;
    var strength = Math.min(1, dl / 5);
    var r0 = Math.max(0, Math.floor(cv - rv)), r1 = Math.min(ROWS - 1, Math.ceil(cv + rv));
    var c0 = Math.max(0, Math.floor(cu - ru)), c1 = Math.min(COLS - 1, Math.ceil(cu + ru));
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var d = ((c - cu) / ru) * ((c - cu) / ru) + ((r - cv) / rv) * ((r - cv) / rv);
      if (d >= 1) continue;
      var i = r * COLS + c, k = 1 - d;
      var a = h[i] < 0.25 ? h[i] * Math.min(1, k * 1.6) : h[i] * 0.3 * k * strength;
      if (a < 0.001) continue;
      h[i] -= a;
      var tc = Math.round(c + du * ru * 1.15), tr = Math.round(r + dv * rv * 1.15);
      if (tc >= 0 && tc < COLS && tr >= 0 && tr < ROWS) {
        var j = tr * COLS + tc;
        if (h[j] + a > WALL && (tc < 2 || tc > COLS - 3 || tr < 2 || tr > ROWS - 3)) {
          // spinto contro il bordo: scavalca
          var over = h[j] + a - WALL; h[j] = WALL;
          spill(over, tc, tr, tc < 2 ? -1 : tc > COLS - 3 ? 1 : 0, tr < 2 ? -1 : tr > ROWS - 3 ? 1 : 0);
        } else h[j] += a;
      } else {
        spill(a, Math.min(COLS - 1, Math.max(0, tc)), Math.min(ROWS - 1, Math.max(0, tr)),
          tc < 0 ? -1 : tc >= COLS ? 1 : 0, tr < 0 ? -1 : tr >= ROWS ? 1 : 0);
      }
    }
    active = 90;
  }

  /* ---------- rendering ---------- */
  var off = document.createElement('canvas'); off.width = COLS; off.height = ROWS;
  var octx = off.getContext('2d');
  var img = octx.createImageData(COLS, ROWS), data = img.data;
  // texture: il colore vero del sale, campionato dalla foto del lettino pieno cella per cella
  var tex = new Uint8ClampedArray(COLS * ROWS * 3), texReady = false;
  var full = new Image(); full.src = 'img/lettino-sale.webp';
  full.onload = function () {
    var fc = document.createElement('canvas'); fc.width = IMG_W; fc.height = IMG_H;
    var fx = fc.getContext('2d'); fx.drawImage(full, 0, 0, IMG_W, IMG_H);
    var d = fx.getImageData(0, 0, IMG_W, IMG_H).data;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var p = toImg(c / (COLS - 1) * 0.9 + 0.05, r / (ROWS - 1) * 0.86 + 0.03), o = ((p.y | 0) * IMG_W + (p.x | 0)) * 4, i = (r * COLS + c) * 3;
      tex[i] = d[o]; tex[i + 1] = d[o + 1]; tex[i + 2] = d[o + 2];
    }
    texReady = true; render();
  };

  function shadeField() {
    for (var r = 0; r < ROWS; r++) {
      var v = r / (ROWS - 1);
      for (var c = 0; c < COLS; c++) {
        var i = r * COLS + c, hh = h[i], o = i * 4;
        if (hh <= 0.03) { data[o + 3] = 0; continue; }
        var l = h[c > 0 ? i - 1 : i], rr = h[c < COLS - 1 ? i + 1 : i];
        var up = h[r > 0 ? i - COLS : i], dn = h[r < ROWS - 1 ? i + COLS : i];
        var nx = (l - rr), nv = (up - dn);
        // rilievo: luce calda dal fondo (dietro) e dai LED del bordo; il davanti è più chiaro
        var s = 1.0 + nx * 1.1 + nv * 1.9 + (hh - 1.6) * 0.16 + noise[i] * 0.14;
        if (s < 0.35) s = 0.35; if (s > 1.35) s = 1.35;
        if (texReady) {
          var q = i * 3;
          data[o] = Math.min(255, tex[q] * s); data[o + 1] = Math.min(255, tex[q + 1] * s); data[o + 2] = Math.min(255, tex[q + 2] * s);
        } else {
          var red = 1 - v * 0.6;
          data[o] = Math.min(255, (236 + 15 * red) * s * 0.9); data[o + 1] = Math.min(255, (200 - 18 * red) * s * 0.9); data[o + 2] = Math.min(255, (182 - 28 * red) * s * 0.9);
        }
        data[o + 3] = hh < 0.25 ? ((hh - 0.03) / 0.22) * 255 : 255;
      }
    }
    octx.putImageData(img, 0, 0);
  }

  function render() {
    shadeField();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(DPR * scale, 0, 0, DPR * scale, DPR * offX, DPR * offY);
    ctx.imageSmoothingEnabled = true;
    var rowH = (BOT - TOP) / ROWS;
    for (var r = 0; r < ROWS; r++) {
      var y = TOP + r * rowH, e = edges(r / ROWS);
      ctx.drawImage(off, 0, r, COLS, 1, e[0] - 1, y, e[1] - e[0] + 2, rowH + 1);
    }
    // chicchi caduti fuori
    ctx.fillStyle = 'rgba(90,40,25,0.5)';
    for (var i = 0; i < P; i++) ctx.fillRect(px[i] - psize[i] * 0.5 + 0.8, py[i] - psize[i] * 0.5 + 1.1, psize[i], psize[i] * 0.8);
    for (var t = 0; t < TINTS.length; t++) {
      ctx.fillStyle = TINTS[t];
      for (var j = t; j < P; j += TINTS.length) ctx.fillRect(px[j] - psize[j] * 0.5, py[j] - psize[j] * 0.5, psize[j], psize[j] * 0.8);
    }
  }

  function resize() {
    W = stage.clientWidth; H = stage.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    scale = W / H < IMG_W / IMG_H ? W / IMG_W : H / IMG_H;   // ritratto: larghezza piena; orizzontale: altezza piena
    offX = (W - IMG_W * scale) / 2; offY = (H - IMG_H * scale) / 2;
    stage.style.setProperty('--img-scale', scale);
    stage.style.setProperty('--img-x', offX + 'px');
    stage.style.setProperty('--img-y', offY + 'px');
    render();
  }

  /* ---------- loop ---------- */
  var running = false, last = 0;
  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    if (now - last < 15) return;
    last = now;
    var any = false;
    for (var id in thumbs) { push(thumbs[id]); any = true; }
    if (slide()) any = true;
    if (active > 0) { active--; if (relax() < 0.02 && !any) active = 0; any = true; }
    if (stepGrains()) any = true;
    if (any) {
      render();
      var f = massOut / massTotal;
      for (var k = 0; k < listeners.length; k++) listeners[k](f);
    }
  }

  /* ---------- input ---------- */
  function toImgPt(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left - offX) / scale, y: (clientY - r.top - offY) / scale };
  }
  // il dito sul sale gioca (niente scroll); altrove la pagina scorre
  canvas.addEventListener('touchstart', function (e) {
    var t = e.changedTouches[0], p = toImgPt(t.clientX, t.clientY);
    if (inBasin(p.x, p.y)) e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('pointerdown', function (e) {
    var p = toImgPt(e.clientX, e.clientY); thumbs[e.pointerId] = { x: p.x, y: p.y, px: p.x, py: p.y };
  });
  canvas.addEventListener('pointermove', function (e) {
    var p = toImgPt(e.clientX, e.clientY), t = thumbs[e.pointerId];
    if (t) { t.x = p.x; t.y = p.y; }
    else if (e.pointerType === 'mouse') {
      if (!thumbs.hover) thumbs.hover = { x: p.x, y: p.y, px: p.x, py: p.y };
      else { thumbs.hover.x = p.x; thumbs.hover.y = p.y; }
    }
  });
  function up(e) { delete thumbs[e.pointerId]; }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', function () { delete thumbs.hover; });
  // anche mentre la pagina scorre, il pollice sposta il sale
  window.addEventListener('touchmove', function (e) {
    for (var k = 0; k < e.touches.length; k++) {
      var t = e.touches[k], p = toImgPt(t.clientX, t.clientY), id = 't' + t.identifier;
      if (!thumbs[id]) thumbs[id] = { x: p.x, y: p.y, px: p.x, py: p.y };
      else { thumbs[id].x = p.x; thumbs[id].y = p.y; }
    }
  }, { passive: true });
  window.addEventListener('touchend', function (e) {
    for (var k = 0; k < e.changedTouches.length; k++) delete thumbs['t' + e.changedTouches[k].identifier];
  }, { passive: true });
  // lo scroll inclina il vassoio
  var lastScroll = window.scrollY || 0;
  window.addEventListener('scroll', function () {
    var y = window.scrollY || 0; tilt(y - lastScroll); lastScroll = y;
  }, { passive: true });

  window.addEventListener('resize', resize);
  resize(); seed();

  return {
    reset: seed,
    onChange: function (f) { listeners.push(f); },
    stats: function () { return { fractionOut: massOut / massTotal, grains: P }; },
    pause: function () { running = false; },
    resume: function () { if (!running) { running = true; requestAnimationFrame(loop); } }
  };
  }
};
