/* Sala biosauna — le pietre calde.
   Quattro pietre ritagliate dalla foto (e altre prese dal cestello della stufa)
   sono corpi che rotolano sul piano della stanza visto in prospettiva: si prendono,
   si lanciano, rimbalzano sulle pareti e tra loro, cadono dal lettino al parquet.
   Una pietra lanciata nel cestello della stufa scatena una nuvola di vapore.
   Coordinate di lavoro = pixel della foto (941×1672). */
window.Rooms = window.Rooms || {};
window.Rooms.biosauna = {
  photo: 'img/biosauna.webp',
  init: function (canvas, stage) {
    var IMG_W = 941, IMG_H = 1672;
    var ctx = canvas.getContext('2d');
    var DPR = Math.min(2, window.devicePixelRatio || 1);
    var scale = 1, offX = 0, offY = 0, W = 0, H = 0;
    var listeners = [], running = false;

    // pietre in foto: centro e semiassi (px foto)
    var STONES = [[478, 960, 41, 23], [480, 1010, 42, 24], [478, 1068, 43, 25], [476, 1130, 44, 26]];
    // lettino (pianale rialzato) e pavimento della stanza: poligoni in px foto
    var BED = [[335, 700], [610, 700], [700, 1100], [760, 1672], [180, 1672], [240, 1100]];
    var ROOM = [[0, 640], [941, 640], [941, 1672], [0, 1672]];
    var STOVE = { x: 95, y: 650, w: 195, h: 150, mouth: [180, 690] };   // cestello della stufa

    /* ---------- foto di base: telo pulito, senza pietre ---------- */
    var base = document.createElement('canvas'); base.width = IMG_W; base.height = IMG_H;
    var bctx = base.getContext('2d');
    var sprites = [];                       // ritagli delle pietre
    var photo = new Image(); photo.src = 'img/biosauna.webp';
    var ready = false;
    photo.onload = function () {
      bctx.drawImage(photo, 0, 0, IMG_W, IMG_H);
      STONES.forEach(function (s) {
        // ritaglio ellittico sfumato della pietra
        var c = document.createElement('canvas'), r = Math.ceil(s[2] * 1.15), q = Math.ceil(s[3] * 1.15);
        c.width = r * 2; c.height = q * 2;
        var x = c.getContext('2d');
        x.drawImage(photo, s[0] - r, s[1] - q, r * 2, q * 2, 0, 0, r * 2, q * 2);
        x.globalCompositeOperation = 'destination-in';
        x.save(); x.scale(r, q);
        var g = x.createRadialGradient(1, 1, 0, 1, 1, 1);
        g.addColorStop(0.8, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(0, 0, 2, 2); x.restore();
        sprites.push({ img: c, rx: r, ry: q });
        // telo pulito: copio la stessa fascia di telo poco più a destra, con bordo morbido
        var pw = s[2] * 2.7, ph = s[3] * 2.9, px0 = s[0] - pw / 2, py0 = s[1] - ph / 2 + 2;
        bctx.save(); bctx.beginPath(); bctx.ellipse(s[0], s[1] + 2, pw / 2, ph / 2, 0, 0, Math.PI * 2); bctx.clip();
        bctx.drawImage(photo, px0 + 105, py0, pw, ph, px0, py0, pw, ph);          // telo a destra (più chiaro)
        bctx.globalAlpha = 0.55;
        bctx.drawImage(photo, px0 - 105, py0, pw, ph, px0, py0, pw, ph);          // telo a sinistra (più scuro): media
        bctx.globalAlpha = 1;
        bctx.restore();
      });
      ready = true;
      seed(); render();
    };

    /* ---------- corpi ---------- */
    var stones = [], steam = [], held = null, onBedCount = 0, thrownOff = 0, fed = 0;
    function makeStone(x, y, sprite, onBed) {
      return { x: x, y: y, vx: 0, vy: 0, rot: (Math.random() - 0.5) * 0.3, spin: 0, sprite: sprite, onBed: onBed, z: 0, vz: 0, inStove: false, asleep: false };
    }
    function seed() {
      stones = []; steam = []; held = null; thrownOff = 0; fed = 0;
      STONES.forEach(function (s, i) { stones.push(makeStone(s[0], s[1], sprites[i], true)); });
    }
    function inPoly(p, x, y) {
      var c = false;
      for (var i = 0, j = p.length - 1; i < p.length; j = i++) {
        if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
      }
      return c;
    }
    function depth(y) { return 0.62 + 0.38 * Math.max(0, Math.min(1, (y - 640) / (IMG_H - 640))); }

    function step() {
      var any = false;
      for (var i = 0; i < stones.length; i++) {
        var s = stones[i];
        if (s === held || s.inStove) continue;
        if (s.asleep) continue;
        any = true;
        // volo (dopo una caduta dal lettino) e rotolamento con attrito
        s.vz -= 1.6; s.z += s.vz;
        if (s.z <= 0) { s.z = 0; if (s.vz < -3) { s.vz = -s.vz * 0.35; } else s.vz = 0; }
        s.x += s.vx; s.y += s.vy;
        var fr = s.z > 0 ? 0.995 : 0.955;
        s.vx *= fr; s.vy *= fr;
        s.rot += s.spin; s.spin *= 0.96;
        // pareti della stanza
        if (s.x < 40) { s.x = 40; s.vx = -s.vx * 0.5; }
        if (s.x > IMG_W - 40) { s.x = IMG_W - 40; s.vx = -s.vx * 0.5; }
        if (s.y < 660) { s.y = 660; s.vy = -s.vy * 0.5; }
        if (s.y > IMG_H - 30) { s.y = IMG_H - 30; s.vy = -s.vy * 0.5; }
        // dal lettino al pavimento
        if (s.onBed && !inPoly(BED, s.x, s.y)) { s.onBed = false; s.vz = 6; thrownOff++; }
        // dal pavimento non si risale sul lettino: il bordo lo respinge
        if (!s.onBed && s.z === 0 && inPoly(BED, s.x, s.y)) { s.x -= s.vx * 1.5; s.y -= s.vy * 1.5; s.vx = -s.vx * 0.4; s.vy = -s.vy * 0.4; }
        // nella stufa
        if (!s.onBed && s.x > STOVE.x && s.x < STOVE.x + STOVE.w && s.y > STOVE.y && s.y < STOVE.y + STOVE.h) {
          s.inStove = true; s.x = STOVE.mouth[0] + (Math.random() - 0.5) * 90; s.y = STOVE.mouth[1] + (Math.random() - 0.5) * 30; fed++;
          burst(s.x, s.y, 90);
        }
        if (Math.abs(s.vx) + Math.abs(s.vy) < 0.15 && s.z === 0) { s.vx = s.vy = 0; s.asleep = true; }
      }
      // urti tra pietre
      for (var a = 0; a < stones.length; a++) for (var b = a + 1; b < stones.length; b++) {
        var A = stones[a], B = stones[b];
        if (A.inStove || B.inStove) continue;
        var dx = B.x - A.x, dy = (B.y - A.y) * 1.7, d = Math.hypot(dx, dy), min = (A.sprite.rx + B.sprite.rx) * 0.85;
        if (d > 0 && d < min) {
          var nx = dx / d, ny = dy / d, push = (min - d) / 2;
          if (A !== held) { A.x -= nx * push; A.y -= ny * push / 1.7; A.asleep = false; }
          if (B !== held) { B.x += nx * push; B.y += ny * push / 1.7; B.asleep = false; }
          var rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
          if (rv < 0) {
            var imp = -rv * 0.9;
            if (A !== held) { A.vx -= nx * imp / 2; A.vy -= ny * imp / 2; A.spin += (Math.random() - 0.5) * 0.1; }
            if (B !== held) { B.vx += nx * imp / 2; B.vy += ny * imp / 2; B.spin += (Math.random() - 0.5) * 0.1; }
          }
          any = true;
        }
      }
      // vapore
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

    /* ---------- rendering ---------- */
    function render() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(DPR * scale, 0, 0, DPR * scale, DPR * offX, DPR * offY);
      ctx.drawImage(ready ? base : photo, 0, 0, IMG_W, IMG_H);
      var order = stones.slice().sort(function (a, b) { return (a.y + a.z * 0) - (b.y + b.z * 0); });
      for (var i = 0; i < order.length; i++) {
        var s = order[i], sp = s.sprite, k = depth(s.y);
        // ombra
        ctx.save(); ctx.translate(s.x, s.y + 6); ctx.scale(k, k * 0.55);
        ctx.fillStyle = 'rgba(20,10,5,' + (s.z > 0 ? 0.25 : 0.45) + ')';
        ctx.beginPath(); ctx.ellipse(0, 0, sp.rx * 0.9, sp.rx * 0.9, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        // pietra
        ctx.save(); ctx.translate(s.x, s.y - s.z); ctx.scale(k, k); ctx.rotate(s.rot);
        if (s === held) { ctx.shadowColor = 'rgba(255,190,120,.8)'; ctx.shadowBlur = 18; }
        ctx.drawImage(sp.img, -sp.rx, -sp.ry); ctx.restore();
      }
      for (var j = 0; j < steam.length; j++) {
        var p = steam[j];
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(255,235,215,' + p.a + ')'); g.addColorStop(1, 'rgba(255,235,215,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
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
    function toImgPt(cx, cy) { var r = canvas.getBoundingClientRect(); return { x: (cx - r.left - offX) / scale, y: (cy - r.top - offY) / scale }; }
    function hit(p) {
      for (var i = stones.length - 1; i >= 0; i--) {
        var s = stones[i]; if (s.inStove) continue;
        if (Math.hypot((p.x - s.x) / (s.sprite.rx * 1.3), (p.y - s.y) / (s.sprite.ry * 1.8)) < 1) return s;
      }
      return null;
    }
    var hist = [];
    canvas.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0], p = toImgPt(t.clientX, t.clientY);
      if (hit(p) || (p.x > STOVE.x && p.x < STOVE.x + STOVE.w && p.y > STOVE.y && p.y < STOVE.y + STOVE.h)) e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('pointerdown', function (e) {
      var p = toImgPt(e.clientX, e.clientY), s = hit(p);
      if (!s && p.x > STOVE.x && p.x < STOVE.x + STOVE.w && p.y > STOVE.y && p.y < STOVE.y + STOVE.h && stones.length < 40) {
        // una pietra nuova dal cestello della stufa
        s = makeStone(p.x, p.y, sprites[(Math.random() * sprites.length) | 0], false); stones.push(s);
      }
      if (!s) return;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      held = s; s.asleep = false; s.vx = s.vy = 0; s.z = 0; s.vz = 0; s.inStove = false;
      hist = [{ x: p.x, y: p.y, t: performance.now() }];
      canvas.classList.add('dragging');
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!held) return;
      var p = toImgPt(e.clientX, e.clientY);
      held.x = p.x; held.y = p.y;
      hist.push({ x: p.x, y: p.y, t: performance.now() }); if (hist.length > 6) hist.shift();
    });
    function release() {
      if (!held) return;
      var s = held; held = null; canvas.classList.remove('dragging');
      if (hist.length > 1) {
        var a = hist[0], b = hist[hist.length - 1], dt = Math.max(16, b.t - a.t);
        s.vx = (b.x - a.x) / dt * 14; s.vy = (b.y - a.y) / dt * 14;
        var v = Math.hypot(s.vx, s.vy); if (v > 60) { s.vx *= 60 / v; s.vy *= 60 / v; }
        s.spin = (Math.random() - 0.5) * Math.min(0.3, v / 80);
        if (v > 8) s.vz = Math.min(14, v * 0.25);           // un lancio forte parte in aria
      }
      var was = s.onBed; s.onBed = inPoly(BED, s.x, s.y) && s.z === 0;
      if (was && !s.onBed) thrownOff++;
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
        // "casino": pietre sparse per la stanza rispetto a quelle disponibili sul lettino
        var mess = Math.min(1, thrownOff / 4 * 0.6 + Math.max(0, stones.length - 4) / 10 * 0.4);
        for (var k = 0; k < listeners.length; k++) listeners[k](mess);
      }
    }
    window.addEventListener('resize', resize);
    resize();

    return {
      reset: function () { seed(); render(); },
      onChange: function (f) { listeners.push(f); },
      stats: function () { return { stones: stones.length, thrownOff: thrownOff, fed: fed }; },
      pause: function () { running = false; },
      resume: function () { if (!running) { running = true; requestAnimationFrame(loop); } }
    };
  }
};
