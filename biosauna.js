/* Sala biosauna — le pietre calde, in 3D.
   La stanza è un parallelepipedo (2,6 × 3,3 m, alta 2,5), il lettino un box alto 1 m
   al centro, la stufa un box contro la parete sinistra. Una camera prospettica
   calibrata sulla foto proietta il mondo (metri) sui pixel della foto (941×1672).
   Le pietre sono sfere con gravità vera: lanciate dal lettino volano, cadono di un
   metro sul parquet, rimbalzano e rotolano fino ai muri. Nel cestello della stufa
   fanno vapore. Coordinate mondo: X destra, Y in profondità, Z in alto. */
window.Rooms = window.Rooms || {};
window.Rooms.biosauna = {
  photo: 'img/biosauna.webp',
  init: function (canvas, stage) {
    var IMG_W = 941, IMG_H = 1672;
    var ctx = canvas.getContext('2d');
    var DPR = Math.min(2, window.devicePixelRatio || 1);
    var scale = 1, offX = 0, offY = 0, W = 0, H = 0;
    var listeners = [], running = false;
    var DEBUG = /debug=1/.test(location.search);

    /* ---------- camera e geometria (metri) ---------- */
    var CAM = { hc: 2.087, th: 0.41, f: 936, cx: 470, cy: 579 };
    var ROOM = { w: 2.58, l: 3.29, h: 2.5, near: 0.25 };            // near: non si va dietro alla camera
    var BED = { x0: -0.28, x1: 0.28, y0: 0.3, y1: 1.85, top: 1.0 };
    var STOVE = { top: 0.85 };                                        // pianta calcolata dalla foto (sotto)
    var R = 0.045;                                                    // raggio pietra
    var G = 9.8, DT = 1 / 60;
    var COS = Math.cos(CAM.th), SIN = Math.sin(CAM.th);

    function proj(X, Y, Z) {
      var d = Y * COS - (Z - CAM.hc) * SIN, up = Y * SIN + (Z - CAM.hc) * COS;
      return { u: CAM.cx + CAM.f * X / d, v: CAM.cy - CAM.f * up / d, d: d };
    }
    // dal pixel al punto sul piano orizzontale Z
    function unproj(u, v, Z) {
      var a = (u - CAM.cx) / CAM.f, b = (CAM.cy - v) / CAM.f, z = Z - CAM.hc;
      var t = (-z * COS - z * SIN * SIN / COS) / (SIN / COS - b);
      var Y = (t + z * SIN) / COS;
      return { X: t * a, Y: Y };
    }
    // stufa: il cestello in foto (100..270, 650..700) proiettato sul piano del suo bordo
    (function () {
      var a = unproj(100, 700, STOVE.top), b = unproj(270, 700, STOVE.top), c = unproj(100, 650, STOVE.top), d = unproj(270, 650, STOVE.top);
      STOVE.x0 = Math.min(a.X, c.X); STOVE.x1 = Math.max(b.X, d.X);
      STOVE.y0 = Math.min(a.Y, b.Y); STOVE.y1 = Math.max(c.Y, d.Y);
      STOVE.mouth = proj((STOVE.x0 + STOVE.x1) / 2, (STOVE.y0 + STOVE.y1) / 2, STOVE.top);
    })();
    // foro per il viso: un vero buco nel lettino (ellisse in foto ≈ 430..520 × 1300..1440)
    var HOLE = (function () { var c = unproj(475, 1370, BED.top), a = unproj(430, 1370, BED.top); return { X: c.X, Y: c.Y, r: Math.abs(c.X - a.X) }; })();
    function inHole(X, Y) { return Math.hypot(X - HOLE.X, (Y - HOLE.Y) * 0.7) < HOLE.r; }
    function inBed(X, Y) { return X > BED.x0 - R && X < BED.x1 + R && Y > BED.y0 - R && Y < BED.y1 + R; }
    function inStove(X, Y) { return X > STOVE.x0 - 0.08 && X < STOVE.x1 + 0.08 && Y > STOVE.y0 - 0.08 && Y < STOVE.y1 + 0.12; }
    function nearStove(X, Y) { return X > STOVE.x0 - 0.3 && X < STOVE.x1 + 0.3 && Y > STOVE.y0 - 0.3 && Y < STOVE.y1 + 0.4; }
    function supportZ(X, Y) { return inBed(X, Y) ? BED.top : inStove(X, Y) ? STOVE.top : 0; }
    var EDGE = 34;   // pareti invisibili sul bordo della foto (px)

    /* ---------- foto di base: telo pulito, ritagli delle pietre ---------- */
    var STONES_PX = [[478, 960, 41, 23], [480, 1010, 42, 24], [478, 1068, 43, 25], [476, 1130, 44, 26]];
    var base = document.createElement('canvas'); base.width = IMG_W; base.height = IMG_H;
    var bctx = base.getContext('2d');
    var sprites = [], ready = false;
    var photo = new Image(); photo.src = 'img/biosauna.webp';
    photo.onload = function () {
      bctx.drawImage(photo, 0, 0, IMG_W, IMG_H);
      STONES_PX.forEach(function (s) {
        var c = document.createElement('canvas'), r = Math.ceil(s[2] * 1.15), q = Math.ceil(s[3] * 1.15);
        c.width = r * 2; c.height = q * 2;
        var x = c.getContext('2d');
        x.drawImage(photo, s[0] - r, s[1] - q, r * 2, q * 2, 0, 0, r * 2, q * 2);
        x.globalCompositeOperation = 'destination-in';
        x.save(); x.scale(r, q);
        var g = x.createRadialGradient(1, 1, 0, 1, 1, 1);
        g.addColorStop(0.8, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(0, 0, 2, 2); x.restore();
        var w = unproj(s[0], s[1], BED.top), d0 = proj(w.X, w.Y, BED.top).d;
        sprites.push({ img: c, rx: r, ry: q, d0: d0, X: w.X, Y: w.Y });
        // telo pulito: media del telo a destra e a sinistra, leggermente scurito (all'ombra
        // delle pietre il telo è più scuro) e con bordo sfumato, così la toppa non si vede
        var pw = s[2] * 2.5, ph = s[3] * 2.7, px0 = s[0] - pw / 2, py0 = s[1] - ph / 2 + 2;
        var pc = document.createElement('canvas'); pc.width = Math.ceil(pw); pc.height = Math.ceil(ph);
        var pk = pc.getContext('2d');
        pk.drawImage(photo, px0 + 110, py0, pw, ph, 0, 0, pw, ph);
        pk.globalAlpha = 0.5; pk.drawImage(photo, px0 - 110, py0, pw, ph, 0, 0, pw, ph); pk.globalAlpha = 1;
        pk.fillStyle = 'rgba(40,20,10,0.07)'; pk.fillRect(0, 0, pw, ph);
        pk.globalCompositeOperation = 'destination-in';
        pk.save(); pk.scale(pw / 2, ph / 2);
        var pg = pk.createRadialGradient(1, 1, 0, 1, 1, 1);
        pg.addColorStop(0.3, 'rgba(0,0,0,1)'); pg.addColorStop(1, 'rgba(0,0,0,0)');
        pk.fillStyle = pg; pk.fillRect(0, 0, 2, 2); pk.restore();
        bctx.drawImage(pc, px0, py0);
      });
      ready = true; seed(); render();
    };
    if (photo.complete && photo.naturalWidth) photo.onload();

    /* ---------- corpi ---------- */
    var stones = [], steam = [], held = null, onFloor = 0, fed = 0, inHoleCount = 0;
    function makeStone(X, Y, Z, sprite) {
      return { X: X, Y: Y, Z: Z, vx: 0, vy: 0, vz: 0, rot: (Math.random() - 0.5) * 0.3, spin: 0, sprite: sprite, inStove: false, onStove: false, inHole: false, asleep: false, wob: 0, wobT: 0, wasOnBed: true };
    }
    function seed() {
      stones = []; steam = []; held = null; onFloor = 0; fed = 0; inHoleCount = 0;
      sprites.forEach(function (sp) { stones.push(makeStone(sp.X, sp.Y, BED.top + R, sp)); });
    }

    function step() {
      var any = false;
      for (var i = 0; i < stones.length; i++) {
        var s = stones[i];
        if (s.wob > 0.002) { s.wobT += 0.35; s.wob *= 0.94; any = true; } else s.wob = 0;
        if (s === held || s.inStove || s.asleep) continue;
        any = true;
        if (s.inHole) {                                             // sta cadendo dentro il foro
          s.vz -= G * DT; s.Z += s.vz * DT;
          if (s.Z < BED.top - 0.35) { s.inStove = true; }             // sparita sotto il lettino
          continue;
        }
        s.vz -= G * DT;
        s.X += s.vx * DT; s.Y += s.vy * DT; s.Z += s.vz * DT;
        // superficie d'appoggio sotto la pietra
        var zs = supportZ(s.X, s.Y);
        if (zs === BED.top && inHole(s.X, s.Y) && s.Z < BED.top + R + 0.08 && s.vz <= 0.05) {
          s.inHole = true; s.X = HOLE.X; s.Y = HOLE.Y; s.vx = s.vy = 0; s.vz = -0.5; inHoleCount++;
          if (s.wasOnBed) { s.wasOnBed = false; }
          continue;
        }
        if (s.Z < zs + R) {
          s.Z = zs + R;
          if (zs === STOVE.top && !s.onStove) { s.onStove = true; fed++; burst(STOVE.mouth.u, STOVE.mouth.v, 90); s.wasOnBed = false; }
          if (s.vz < -0.6) { s.vz = -s.vz * 0.35; s.spin += (Math.random() - 0.5) * 0.2; }
          else { s.vz = 0; }
          s.vx *= (zs === 0 ? 0.86 : 0.8); s.vy *= (zs === 0 ? 0.86 : 0.8);   // attrito: parquet / telo
          if (zs === 0 && s.wasOnBed) { s.wasOnBed = false; onFloor++; }
        }
        if (zs !== STOVE.top) s.onStove = false;
        // bordo della foto: una pietra non esce mai dall'inquadratura
        var pe = proj(s.X, s.Y, s.Z);
        if (pe.u < EDGE) { s.X += (EDGE - pe.u) / CAM.f * pe.d; s.vx = Math.abs(s.vx) * 0.4; }
        if (pe.u > IMG_W - EDGE) { s.X -= (pe.u - (IMG_W - EDGE)) / CAM.f * pe.d; s.vx = -Math.abs(s.vx) * 0.4; }
        if (pe.v > IMG_H - EDGE) { s.Y += 0.05; s.vy = Math.abs(s.vy) * 0.4; }
        // pareti
        if (s.X < -ROOM.w / 2 + R) { s.X = -ROOM.w / 2 + R; s.vx = -s.vx * 0.45; }
        if (s.X > ROOM.w / 2 - R) { s.X = ROOM.w / 2 - R; s.vx = -s.vx * 0.45; }
        if (s.Y > ROOM.l - R) { s.Y = ROOM.l - R; s.vy = -s.vy * 0.45; }
        if (s.Y < ROOM.near) { s.Y = ROOM.near; s.vy = -s.vy * 0.45; }
        // fianchi della stufa: dal pavimento non si passa attraverso
        if (s.Z < STOVE.top && inStove(s.X, s.Y)) {
          var sl = s.X - STOVE.x0, sr = STOVE.x1 - s.X, sn = s.Y - STOVE.y0, sf = STOVE.y1 - s.Y, sm = Math.min(sl, sr, sn, sf);
          if (sm === sl) { s.X = STOVE.x0 - R; s.vx = -Math.abs(s.vx) * 0.4; }
          else if (sm === sr) { s.X = STOVE.x1 + R; s.vx = Math.abs(s.vx) * 0.4; }
          else if (sm === sn) { s.Y = STOVE.y0 - R; s.vy = -Math.abs(s.vy) * 0.4; }
          else { s.Y = STOVE.y1 + R; s.vy = Math.abs(s.vy) * 0.4; }
        }
        // fianco del lettino: dal pavimento non si passa attraverso
        if (s.Z < BED.top && inBed(s.X, s.Y)) {
          var dl = s.X - BED.x0, dr = BED.x1 - s.X, dn = s.Y - BED.y0, df = BED.y1 - s.Y, m = Math.min(dl, dr, dn, df);
          if (m === dl) { s.X = BED.x0 - R; s.vx = -Math.abs(s.vx) * 0.4; }
          else if (m === dr) { s.X = BED.x1 + R; s.vx = Math.abs(s.vx) * 0.4; }
          else if (m === dn) { s.Y = BED.y0 - R; s.vy = -Math.abs(s.vy) * 0.4; }
          else { s.Y = BED.y1 + R; s.vy = Math.abs(s.vy) * 0.4; }
        }
        s.rot += s.spin; s.spin *= 0.96;
        var sp = Math.hypot(s.vx, s.vy);
        if (sp < 0.02 && s.vz === 0) { s.vx = s.vy = 0; s.asleep = true; }
      }
      // urti tra pietre (sfere)
      for (var a = 0; a < stones.length; a++) for (var b = a + 1; b < stones.length; b++) {
        var A = stones[a], B = stones[b];
        if (A.inStove || B.inStove || A.inHole || B.inHole) continue;
        var dx = B.X - A.X, dy = B.Y - A.Y, dz = B.Z - A.Z, d = Math.hypot(dx, dy, dz);
        if (d > 0 && d < 2 * R) {
          var nx = dx / d, ny = dy / d, nz = dz / d, push = (2 * R - d) / 2;
          if (A !== held) { A.X -= nx * push; A.Y -= ny * push; A.asleep = false; }
          if (B !== held) { B.X += nx * push; B.Y += ny * push; B.asleep = false; }
          var rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny + (B.vz - A.vz) * nz;
          if (rv < 0) {
            var imp = -rv * 0.8;
            if (A !== held) { A.vx -= nx * imp / 2; A.vy -= ny * imp / 2; A.vz -= nz * imp / 2; A.spin += 0.05; }
            if (B !== held) { B.vx += nx * imp / 2; B.vy += ny * imp / 2; B.vz += nz * imp / 2; B.spin -= 0.05; }
          }
          any = true;
        }
      }
      for (var k = steam.length - 1; k >= 0; k--) {
        var p = steam[k];
        p.x += p.vx; p.y += p.vy; p.vy -= 0.015; p.vx += (Math.random() - 0.5) * 0.2; p.r += 0.35; p.a -= p.decay;
        if (p.a <= 0) steam.splice(k, 1);
      }
      if (steam.length) any = true;
      return any;
    }
    function burst(x, y, n) {
      for (var i = 0; i < n; i++) steam.push({ x: x + (Math.random() - 0.5) * 60, y: y, vx: (Math.random() - 0.5) * 2.2, vy: -1.5 - Math.random() * 3, r: 10 + Math.random() * 18, a: 0.14 + Math.random() * 0.12, decay: 0.0025 + Math.random() * 0.003 });
    }

    // lo scroll scuote la stanza: le pietre traballano e scivolano verso di te
    function jolt(dy) {
      var k = Math.min(1, Math.abs(dy) / 120);
      if (k < 0.05) return;
      stones.forEach(function (s) {
        if (s === held || s.inStove) return;
        s.asleep = false;
        s.vy += (dy > 0 ? -1 : 1) * (0.25 + 0.7 * k) * (0.7 + Math.random() * 0.6);
        s.vx += (Math.random() - 0.5) * 0.4 * k;
        s.spin += (Math.random() - 0.5) * 0.12 * k;
        s.wob = Math.max(s.wob, 0.25 * k); s.wobT = 0;
        if (k > 0.6) s.vz = 0.6 + 1.2 * k;
      });
    }
    var lastScroll = window.scrollY || 0;
    window.addEventListener('scroll', function () { var y = window.scrollY || 0; jolt(y - lastScroll); lastScroll = y; }, { passive: true });
    setInterval(function () {
      if (held || !running) return;
      var cand = stones.filter(function (s) { return !s.inStove; });
      if (!cand.length) return;
      var s = cand[(Math.random() * cand.length) | 0]; s.wob = 0.18; s.wobT = 0;
    }, 2600);

    /* ---------- rendering ---------- */
    function render() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(DPR * scale, 0, 0, DPR * scale, DPR * offX, DPR * offY);
      ctx.drawImage(ready ? base : photo, 0, 0, IMG_W, IMG_H);
      if (DEBUG) drawDebug();
      var order = stones.filter(function (s) { return !s.inStove; }).map(function (s) { return { s: s, p: proj(s.X, s.Y, s.Z) }; })
        .sort(function (a, b) { return b.p.d - a.p.d; });
      for (var i = 0; i < order.length; i++) {
        var s = order[i].s, p = order[i].p, sp = s.sprite, k = sp.d0 / p.d;
        // ombra sulla superficie sotto
        var zs = supportZ(s.X, s.Y), sh = proj(s.X, s.Y, zs), hgt = s.Z - R - zs;
        if (!s.inHole) { ctx.save(); ctx.translate(sh.u, sh.v + 3); ctx.scale(k, k * 0.5);
        ctx.fillStyle = 'rgba(20,10,5,' + Math.max(0.08, 0.45 - hgt * 0.5) + ')';
        ctx.beginPath(); ctx.ellipse(0, 0, sp.rx * (0.9 + hgt * 0.4), sp.rx * (0.9 + hgt * 0.4), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        ctx.save();
        if (s.inHole) { ctx.beginPath(); ctx.ellipse(475, 1370, 46, 72, 0, 0, Math.PI * 2); ctx.clip(); }
        if (s.Y > STOVE.y0 + 0.1 && s.Z < STOVE.top && s.X < STOVE.x1 + 0.3) {   // dietro la stufa: la stufa la copre
          var q0 = proj(STOVE.x0, STOVE.y0, 0), q1 = proj(STOVE.x1, STOVE.y0, 0), q2 = proj(STOVE.x1, STOVE.y0, STOVE.top), q3 = proj(STOVE.x1, STOVE.y1, STOVE.top), q4 = proj(STOVE.x0, STOVE.y1, STOVE.top), q5 = proj(STOVE.x0, STOVE.y0, STOVE.top);
          ctx.beginPath(); ctx.rect(-2000, -2000, IMG_W + 4000, IMG_H + 4000);
          ctx.moveTo(q0.u, q0.v); ctx.lineTo(q1.u, q1.v); ctx.lineTo(q2.u, q2.v); ctx.lineTo(q3.u, q3.v); ctx.lineTo(q4.u, q4.v); ctx.lineTo(q5.u, q5.v); ctx.closePath();
          ctx.clip('evenodd');
        }
        ctx.translate(p.u, p.v - Math.abs(Math.sin(s.wobT)) * s.wob * 14); ctx.scale(k, k); ctx.rotate(s.rot + Math.sin(s.wobT) * s.wob);
        if (s === held) { ctx.shadowColor = 'rgba(255,190,120,.8)'; ctx.shadowBlur = 18; }
        ctx.drawImage(sp.img, -sp.rx, -sp.ry); ctx.restore();
      }
      for (var j = 0; j < steam.length; j++) {
        var q = steam[j], g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r);
        g.addColorStop(0, 'rgba(255,235,215,' + q.a + ')'); g.addColorStop(1, 'rgba(255,235,215,0)');
        ctx.fillStyle = g; ctx.fillRect(q.x - q.r, q.y - q.r, q.r * 2, q.r * 2);
      }
    }
    function box(x0, x1, y0, y1, z0, z1, color) {
      var c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]].map(function (p) { return proj(p[0], p[1], p[2]); });
      var E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
      E.forEach(function (e) { ctx.moveTo(c[e[0]].u, c[e[0]].v); ctx.lineTo(c[e[1]].u, c[e[1]].v); }); ctx.stroke();
    }
    function drawDebug() {
      box(-ROOM.w / 2, ROOM.w / 2, ROOM.near, ROOM.l, 0, ROOM.h, 'rgba(80,200,255,.8)');
      box(BED.x0, BED.x1, BED.y0, BED.y1, 0, BED.top, 'rgba(255,230,80,.9)');
      box(STOVE.x0, STOVE.x1, STOVE.y0, STOVE.y1, 0, STOVE.top, 'rgba(255,90,90,.9)');
      ctx.strokeStyle = 'rgba(120,255,120,.9)'; ctx.beginPath(); ctx.ellipse(475, 1370, 46, 72, 0, 0, Math.PI * 2); ctx.stroke();
    }
    function resize() {
      W = stage.clientWidth; H = stage.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      scale = W / H < IMG_W / IMG_H ? W / IMG_W : H / IMG_H;
      offX = (W - IMG_W * scale) / 2; offY = (H - IMG_H * scale) / 2;
      stage.style.setProperty('--img-scale', scale); stage.style.setProperty('--img-x', offX + 'px'); stage.style.setProperty('--img-y', offY + 'px');
      render();
    }

    /* ---------- input ---------- */
    // la pietra si porta in giro sopra quello che c'è sotto il dito: lettino, stufa o pavimento
    function carryPoint(u, v) {
      var LIFT = 0.12, w;
      w = unproj(u, v, BED.top + LIFT); if (inBed(w.X, w.Y)) return { X: w.X, Y: w.Y, Z: BED.top + LIFT };
      w = unproj(u, v, STOVE.top + LIFT); if (nearStove(w.X, w.Y)) return { X: Math.max(STOVE.x0, Math.min(STOVE.x1, w.X)), Y: Math.max(STOVE.y0, Math.min(STOVE.y1, w.Y)), Z: STOVE.top + LIFT };
      w = unproj(u, v, LIFT); return { X: w.X, Y: w.Y, Z: LIFT };
    }
    function toImgPt(cx, cy) { var r = canvas.getBoundingClientRect(); return { x: (cx - r.left - offX) / scale, y: (cy - r.top - offY) / scale }; }
    function hit(p) {
      var best = null, bd = 1e9;
      for (var i = 0; i < stones.length; i++) {
        var s = stones[i]; if (s.inStove || s.inHole) continue;
        var q = proj(s.X, s.Y, s.Z), k = s.sprite.d0 / q.d;
        var dd = Math.hypot((p.x - q.u) / (s.sprite.rx * k * 1.4), (p.y - q.v) / (s.sprite.ry * k * 1.9));
        if (dd < 1 && q.d < bd) { best = s; bd = q.d; }
      }
      return best;
    }
    function overStove(p) { return p.x > 90 && p.x < 290 && p.y > 640 && p.y < 830; }
    var hist = [];
    canvas.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0], p = toImgPt(t.clientX, t.clientY);
      if (hit(p) || overStove(p)) e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('pointerdown', function (e) {
      var p = toImgPt(e.clientX, e.clientY), s = hit(p);
      if (!s && overStove(p) && stones.length < 40) {
        var w = unproj(p.x, p.y, STOVE.top + R);
        s = makeStone(w.X, w.Y, STOVE.top + R, sprites[(Math.random() * sprites.length) | 0]); s.wasOnBed = false; stones.push(s);
      }
      if (!s) return;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      held = s; s.asleep = false; s.vx = s.vy = s.vz = 0; s.inStove = false; s.onStove = false;
      var w2 = carryPoint(p.x, p.y); s.X = w2.X; s.Y = Math.max(ROOM.near, w2.Y); s.Z = w2.Z;
      hist = [{ X: s.X, Y: s.Y, t: performance.now() }];
      canvas.classList.add('dragging');
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!held) return;
      var p = toImgPt(e.clientX, e.clientY), w = carryPoint(p.x, p.y);
      held.X = Math.max(-ROOM.w / 2 + R, Math.min(ROOM.w / 2 - R, w.X)); held.Y = Math.max(ROOM.near, Math.min(ROOM.l - R, w.Y)); held.Z = w.Z;
      hist.push({ X: held.X, Y: held.Y, t: performance.now() }); if (hist.length > 6) hist.shift();
    });
    function release() {
      if (!held) return;
      var s = held; held = null; canvas.classList.remove('dragging');
      // velocità dal movimento degli ultimi istanti; se il dito si è fermato, la pietra si posa
      hist.push({ X: s.X, Y: s.Y, t: performance.now() });
      var now = performance.now(), recent = hist.filter(function (h) { return now - h.t < 120; });
      if (recent.length > 1) {
        var a = recent[0], b = recent[recent.length - 1], dt = Math.max(0.016, (b.t - a.t) / 1000);
        s.vx = (b.X - a.X) / dt * 0.9; s.vy = (b.Y - a.Y) / dt * 0.9;
        var v = Math.hypot(s.vx, s.vy); if (v > 5) { s.vx *= 5 / v; s.vy *= 5 / v; v = 5; }
        s.vz = v > 1.2 ? Math.min(1.4, v * 0.22) : 0;
        s.spin = (Math.random() - 0.5) * Math.min(0.3, v / 20);
      }
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    /* ---------- loop ---------- */
    var last = 0;
    function loop(now) {
      if (!running) return;
      requestAnimationFrame(loop);
      if (now - last < 15) return;
      last = now;
      var any = step();
      if (any || held) {
        render();
        var onStoveNow = 0, floorNow = 0;
        stones.forEach(function (s) { if (s.inStove || s.inHole) return; if (s.onStove) onStoveNow++; else if (s.Z < 0.12 && s.asleep) floorNow++; });
        var st = { mess: Math.min(1, (floorNow + inHoleCount) / 3), praise: onStoveNow >= 2 && floorNow + inHoleCount <= 1 ? 1 : 0 };
        for (var k = 0; k < listeners.length; k++) listeners[k](st);
      }
    }
    window.addEventListener('resize', resize);
    resize();

    return {
      reset: function () { seed(); render(); },
      onChange: function (f) { listeners.push(f); },
      stats: function () { return { running: running, held: !!held, stones: stones.length, onFloor: onFloor, fed: fed, inHole: inHoleCount, hole: HOLE, stove: STOVE, pos: stones.map(function (s) { return [s.X.toFixed(2), s.Y.toFixed(2), s.Z.toFixed(2), s.inStove]; }) }; },
      pause: function () { running = false; },
      resume: function () { if (!running) { running = true; requestAnimationFrame(loop); } }
    };
  }
};
