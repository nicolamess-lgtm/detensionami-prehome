/* Modalità modifica del catalogo. Si apre dal gestionale con …/catalogo/?edit
   (lo stesso editor dei siti verticali, adattato al catalogo).
   - Testi: clicca e scrivi.
   - Foto: su ogni foto compaiono «Inquadratura» (trascini la foto per decidere
     quale parte si vede: si salva come object-position) e «Cambia foto».
   - Schede e voci di elenco: ⧉ duplica / ✕ elimina.
   - Salva → POST /api/save. In locale scrive il file; online la funzione
     Cloudflare fa il commit su GitHub e il sito si ripubblica da solo.
   Le foto nuove vanno in catalogo/…/img/, così non si toccano quelle del sito. */
(() => {
  const html = document.documentElement;
  html.classList.add('editing');

  const page = location.pathname.endsWith('/') ? location.pathname + 'index.html' : location.pathname;
  const dir = page.slice(0, page.lastIndexOf('/') + 1);      // /catalogo/ oppure /catalogo/2025/
  const file = page.replace(/^\//, '');
  const BLOCK = 'div,p,ul,ol,li,details,summary,figure,figcaption,img,svg,canvas,form,input,textarea,select,button,label,fieldset,output,h1,h2,h3,h4,h5,h6,section,article,nav,header,footer,table,video,iframe,blockquote';
  const SKIP = 'script,style,noscript,input,textarea,select,button,canvas,svg,.ed-tools,.ed-imgtools,.ed-bar';
  const REPEAT = '.k-card,.k-books li,.k-prices li,.k-facts li';
  const roots = () => [document.getElementById('copertina'), document.querySelector('main')].filter(Boolean);
  let dirty = false;

  /* ---------- barra ---------- */
  const bar = document.createElement('div');
  bar.className = 'ed-bar';
  bar.innerHTML = `
    <span class="ed-title">Modifica catalogo</span>
    <span class="ed-hint">Clicca su un testo per scrivere. Sulle foto: «Inquadratura» per centrarle, «Cambia foto» per sostituirle.</span>
    <button type="button" class="ed-btn ed-save">Salva e pubblica</button>
    <button type="button" class="ed-btn ed-undo">Annulla modifiche</button>
    <span class="ed-status" role="status"></span>`;
  document.body.appendChild(bar);
  const status = bar.querySelector('.ed-status');
  const say = (t, cls = '') => { status.textContent = t; status.className = 'ed-status ' + cls; };

  const css = document.createElement('style');
  css.textContent = `
    .editing [contenteditable="true"]{outline:1px dashed rgba(168,87,58,.55);outline-offset:3px;cursor:text;min-width:1ch}
    .editing [contenteditable="true"]:hover{outline-color:#A8573A;background:rgba(168,87,58,.07)}
    .editing [contenteditable="true"]:focus{outline:2px solid #A8573A;background:rgba(168,87,58,.1)}
    .editing .ed-rep{position:relative}
    .editing .ed-tools{position:absolute;top:6px;right:6px;z-index:5;display:flex;gap:4px;opacity:.15}
    .editing .ed-rep:hover > .ed-tools{opacity:1}
    .ed-tools button{width:28px;height:28px;border-radius:50%;border:0;background:#1B1714;color:#fff;font:14px/1 system-ui;display:grid;place-items:center;box-shadow:0 4px 12px rgba(0,0,0,.3);cursor:pointer}
    .ed-tools button.del{background:#A8573A}
    .ed-host{position:relative}
    .ed-imgtools{position:absolute;left:12px;top:12px;z-index:6;display:flex;gap:6px}
    .cover .ed-imgtools{top:auto;bottom:16px;left:auto;right:16px}
    .k-books .ed-imgtools{left:0;top:auto;bottom:22px}
    .k-books .ed-imgtools .ed-move{display:none}
    .k-books .ed-imgtools button{height:26px;padding:0 9px;font-size:11px}
    .ed-imgtools button, .ed-frame button{height:34px;padding:0 14px;border-radius:999px;border:0;background:#1B1714;color:#fff;font:600 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)}
    .ed-imgtools button + button{background:#A8573A}
    .ed-frame{position:fixed;z-index:99990;cursor:grab;outline:3px solid #A8573A;outline-offset:-3px;background:
      linear-gradient(rgba(255,255,255,.35),rgba(255,255,255,.35)) 33.3% 0/1px 100% no-repeat,
      linear-gradient(rgba(255,255,255,.35),rgba(255,255,255,.35)) 66.6% 0/1px 100% no-repeat,
      linear-gradient(rgba(255,255,255,.35),rgba(255,255,255,.35)) 0 33.3%/100% 1px no-repeat,
      linear-gradient(rgba(255,255,255,.35),rgba(255,255,255,.35)) 0 66.6%/100% 1px no-repeat;touch-action:none}
    .ed-frame:active{cursor:grabbing}
    .ed-frame .ed-frame-ui{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:8px;align-items:center;background:rgba(27,23,20,.85);color:#fff;padding:8px 8px 8px 14px;border-radius:999px;font:13px system-ui,sans-serif;white-space:nowrap}
    .ed-frame .ed-frame-ui button{box-shadow:none}
    .ed-frame .ed-ok{background:#A8573A}
    .ed-bar{position:fixed;left:12px;right:12px;bottom:12px;z-index:100000;display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 16px;border-radius:16px;background:#1B1714;color:#fff;font:14px/1.3 system-ui,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.4)}
    .ed-title{font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:12px;color:#E9C9B6}
    .ed-hint{opacity:.75;flex:1;min-width:200px;font-size:13px}
    .ed-btn{height:40px;padding:0 16px;border-radius:999px;background:#fff;color:#1B1714;font-weight:600;font-size:14px;display:inline-flex;align-items:center;cursor:pointer;border:0;text-decoration:none}
    .ed-save{background:#A8573A;color:#fff}
    .ed-save[disabled]{opacity:.5;cursor:default}
    .ed-status{width:100%;font-size:13px;opacity:.9;min-height:1em}
    .ed-status.ok{color:#8fd6a5}.ed-status.err{color:#f2a08a}
    .editing body{padding-bottom:150px}`;
  document.head.appendChild(css);

  /* ---------- testi modificabili ---------- */
  const editable = el => {
    el.contentEditable = 'true'; el.spellcheck = true;
    el.querySelectorAll('*').forEach(c => { if (!c.textContent.trim()) c.contentEditable = 'false'; });
  };
  const walk = el => {
    if (el.matches(SKIP)) return;
    if (el.closest('[contenteditable="true"]')) return;
    if (el.textContent.trim() && !el.querySelector(BLOCK)) { editable(el); return; }
    [...el.children].forEach(walk);
  };

  /* ---------- strumenti su foto e schede ---------- */
  const arm = () => {
    roots().forEach(root => {
      [...root.children].forEach(walk);
      root.querySelectorAll('img').forEach(img => {
        const host = img.parentElement;
        if (host.querySelector(':scope > .ed-imgtools')) return;
        host.classList.add('ed-host');
        const t = document.createElement('div'); t.className = 'ed-imgtools'; t.contentEditable = 'false';
        t.innerHTML = '<button type="button" class="ed-move">Inquadratura</button><button type="button" class="ed-pick">Cambia foto</button>';
        t._img = img;
        host.appendChild(t);
      });
      root.querySelectorAll(REPEAT).forEach(item => {
        if (item.querySelector(':scope > .ed-tools')) return;
        item.classList.add('ed-rep');
        const t = document.createElement('div'); t.className = 'ed-tools'; t.contentEditable = 'false';
        t.innerHTML = '<button type="button" class="dup" title="Duplica">⧉</button><button type="button" class="del" title="Elimina">✕</button>';
        item.appendChild(t);
      });
    });
  };
  arm();

  document.addEventListener('click', e => {
    if (e.target.closest('.ed-bar, .ed-frame')) return;
    const tools = e.target.closest('.ed-tools');
    if (tools) {
      const item = tools.parentElement;
      if (e.target.closest('.del')) { if (confirm('Eliminare questo elemento?')) { item.remove(); dirty = true; } }
      else if (e.target.closest('.dup')) { const c = item.cloneNode(true); c.querySelector(':scope > .ed-tools')?.remove(); c.querySelectorAll('[id]').forEach(n => n.removeAttribute('id')); if (c.id) c.removeAttribute('id'); item.after(c); arm(); dirty = true; }
      e.preventDefault(); return;
    }
    const it = e.target.closest('.ed-imgtools');
    if (it) {
      e.preventDefault();
      if (e.target.closest('.ed-move')) reframe(it._img);
      if (e.target.closest('.ed-pick')) pickImage(it._img);
      return;
    }
    if (e.target.closest('a,button,label')) e.preventDefault();
  }, true);

  document.addEventListener('input', e => {
    dirty = true;
    const ed = e.target.closest && e.target.closest('[contenteditable="true"]');
    if (!ed) return;
    ed.querySelectorAll('[style]').forEach(n => n.removeAttribute('style'));
    ed.querySelectorAll('span:not([class]),font').forEach(n => n.replaceWith(...n.childNodes));
  });
  addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('paste', e => {
    if (!e.target.closest('[contenteditable="true"]')) return;
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.closest('[contenteditable="true"]') && !e.shiftKey) { e.preventDefault(); document.execCommand('insertLineBreak'); }
  });

  /* ---------- inquadratura: trascini la foto ---------- */
  const posOf = img => {
    const v = getComputedStyle(img).objectPosition.split(' ');
    const n = s => s === 'left' || s === 'top' ? 0 : s === 'right' || s === 'bottom' ? 100 : s.endsWith('%') ? parseFloat(s) : 50;
    return [n(v[0] || '50%'), n(v[1] || '50%')];
  };
  function reframe(img) {
    const r = img.getBoundingClientRect();
    const box = document.createElement('div'); box.className = 'ed-frame';
    Object.assign(box.style, { left: r.left + 'px', top: Math.max(r.top, 0) + 'px', width: r.width + 'px', height: Math.min(r.height, innerHeight - Math.max(r.top, 0) - 120) + 'px' });
    box.innerHTML = '<div class="ed-frame-ui"><span>Trascina la foto</span><button type="button" class="ed-reset">Centro</button><button type="button" class="ed-ok">Fatto</button></div>';
    document.body.appendChild(box);
    const prima = img.style.objectPosition;
    let [x, y] = posOf(img), start = null;
    const set = () => { img.style.objectPosition = `${x.toFixed(1)}% ${y.toFixed(1)}%`; };
    // quanto si sposta la foto per ogni pixel trascinato: dipende da quanto «avanza» fuori dal riquadro
    const step = () => {
      const iw = img.naturalWidth || r.width, ih = img.naturalHeight || r.height;
      const s = Math.max(r.width / iw, r.height / ih);
      const extraX = iw * s - r.width, extraY = ih * s - r.height;
      return [extraX > 1 ? 100 / extraX : 0, extraY > 1 ? 100 / extraY : 0];
    };
    box.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      start = { px: e.clientX, py: e.clientY, x, y }; box.setPointerCapture(e.pointerId);
    });
    box.addEventListener('pointermove', e => {
      if (!start) return;
      const [kx, ky] = step();
      x = Math.min(100, Math.max(0, start.x - (e.clientX - start.px) * kx));
      y = Math.min(100, Math.max(0, start.y - (e.clientY - start.py) * ky));
      set();
    });
    box.addEventListener('pointerup', () => { start = null; });
    box.querySelector('.ed-reset').addEventListener('click', () => { x = 50; y = 50; set(); });
    box.querySelector('.ed-ok').addEventListener('click', () => {
      box.remove();
      if (img.style.objectPosition !== prima) { dirty = true; say('Inquadratura cambiata (non ancora pubblicata).'); }
    });
    const onScroll = () => { box.querySelector('.ed-ok').click(); removeEventListener('scroll', onScroll); };
    addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- foto nuova ---------- */
  const uploads = {};                       // percorso nel repo → base64
  function pickImage(img) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      say('Preparo la foto…');
      try {
        const b64 = await resize(f, 2400);
        const base = (f.name.replace(/\.[^.]+$/, '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'foto').slice(0, 40);
        const name = `${base}-${Date.now().toString(36)}.jpg`;
        uploads[(dir + 'img/' + name).replace(/^\//, '')] = b64;
        img.dataset.edSrc = 'img/' + name;
        img.src = 'data:image/jpeg;base64,' + b64;
        img.removeAttribute('srcset');
        img.style.objectPosition = '';
        dirty = true; say('Foto sostituita (non ancora pubblicata). Ora puoi sistemare l\'inquadratura.');
      } catch { say('Non riesco a leggere questa immagine.', 'err'); }
    };
    inp.click();
  }
  function resize(file, max) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file); const im = new Image();
      im.onload = () => {
        const s = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', .85).split(',')[1]); URL.revokeObjectURL(url);
      };
      im.onerror = rej; im.src = url;
    });
  }

  /* ---------- salvataggio ---------- */
  function cleanClone(root) {
    const c = root.cloneNode(true);
    c.querySelectorAll('.ed-tools,.ed-imgtools').forEach(n => n.remove());
    c.querySelectorAll('[contenteditable]').forEach(n => { n.removeAttribute('contenteditable'); n.removeAttribute('spellcheck'); });
    c.querySelectorAll('.ed-rep,.ed-host').forEach(n => { n.classList.remove('ed-rep', 'ed-host'); if (!n.classList.length) n.removeAttribute('class'); });
    c.querySelectorAll('[data-ed-src]').forEach(n => { n.setAttribute('src', n.dataset.edSrc); delete n.dataset.edSrc; });
    c.querySelectorAll('[style=""]').forEach(n => n.removeAttribute('style'));
    return c;
  }
  // sostituisce il contenuto dell'elemento che apre con `apertura` fino al primo </tag> dopo
  function swap(src, apertura, tag, inner) {
    const i = src.search(apertura); if (i < 0) throw new Error('Non trovo ' + tag + ' nel file.');
    const start = src.indexOf('>', i) + 1;
    const end = tag === 'main' ? src.lastIndexOf('</main>') : src.indexOf(`</${tag}>`, start);
    return src.slice(0, start) + inner + src.slice(end);
  }

  let password = sessionStorage.getItem('ed-pw') || '';
  async function post(body, retry = true) {
    const r = await fetch('/api/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) {
      sessionStorage.removeItem('ed-pw'); password = '';
      if (!retry) throw new Error('Password sbagliata.');
      password = prompt('Password di modifica:') || '';
      if (!password) throw new Error('Serve la password per pubblicare.');
      sessionStorage.setItem('ed-pw', password);
      return post(body, false);
    }
    if (!r.ok || !j.ok) throw new Error(j.error || ('Errore ' + r.status));
    return j;
  }
  bar.querySelector('.ed-undo').addEventListener('click', () => { if (!dirty || confirm('Scartare le modifiche non salvate?')) { dirty = false; location.reload(); } });
  bar.querySelector('.ed-save').addEventListener('click', async () => {
    const btn = bar.querySelector('.ed-save');
    btn.disabled = true;
    try {
      for (const [path, b64] of Object.entries(uploads)) {
        say('Carico la foto ' + path + '…');
        await post({ path, contentBase64: b64, message: 'Catalogo: foto nuova ' + path });
      }
      say('Preparo la pagina…');
      let src = await (await fetch(page + '?edit', { cache: 'no-store' })).text();
      if (!/<main>/.test(src)) throw new Error('Non riesco a leggere il file originale: ricarica e riprova.');
      const cover = document.getElementById('copertina');
      if (cover) src = swap(src, /<section[^>]*id="copertina"[^>]*>/, 'section', cleanClone(cover).innerHTML);
      src = swap(src, /<main>/, 'main', cleanClone(document.querySelector('main')).innerHTML);
      say('Pubblico ' + file + '…');
      const j = await post({ path: file, content: src, message: 'Catalogo: testi aggiornati (' + file + ')' });
      dirty = false; for (const k in uploads) delete uploads[k];
      say(j.local ? 'Salvato sul computer.' : 'Pubblicato. Il catalogo si aggiorna in un paio di minuti.', 'ok');
    } catch (err) { say(err.message, 'err'); }
    btn.disabled = false;
  });
})();
