/* Le letture del catalogo (CRM-SMART, AGENTS.md §69).
   Il catalogo si apre solo con un link personale, ?c=<codice> (lo controlla
   functions/catalogo/_middleware.js). Questo script racconta allo studio come
   è stato letto: per quanto (solo con la pagina davanti e usata da meno di
   due minuti), fin dove (la sezione più lontana, l'ultima, la percentuale),
   quanto su ogni sezione (section.chapter[id]) e cosa ha cliccato
   (WhatsApp, «Copia link» o «Condividi», l'indice, le sale, il sito, i link
   esterni). Manda tutto a catalogo_traccia, con la sola chiave pubblica.

   Niente cookie: lo stato della lettura sta nella scheda (sessionStorage),
   così una ricarica entro un'ora continua la stessa lettura. Nessun dato di
   chi legge oltre al codice del link: niente IP, niente dispositivo.
   Con &prova nell'indirizzo (il pulsante «Prova» del gestionale) o con ?edit
   (l'editor) non manda nulla. La versione la dice la pagina: <meta name="catalogo" content="B">. */
(function () {
  var SUPABASE = 'https://rsqhmczqyqkcbgvygdrl.supabase.co';
  var CHIAVE = 'sb_publishable_JNi_HHIXLmR_V_Q45E_k2g_0ucSGtL2';   // chiave pubblica: scrive solo le letture di un codice valido
  // text/plain e la chiave nell'indirizzo: è una richiesta «semplice», che sendBeacon sa mandare
  var INDIRIZZO = SUPABASE + '/rest/v1/rpc/catalogo_traccia?apikey=' + CHIAVE;
  var CODICE = /^[a-km-np-z2-9]{8}$/;
  var ORA = 3600000, INATTIVO = 120000, OGNI = 20000;

  var m = /[?&]c=([^&#]+)/.exec(location.search), codice = '';
  try { codice = m ? decodeURIComponent(m[1]).toLowerCase().trim() : ''; } catch (e) {}
  // &prova (dal gestionale) e ?edit (l'editor del catalogo) non contano
  if (!CODICE.test(codice) || /[?&](prova|edit)(=|&|$)/.test(location.search)) return;

  var meta = document.querySelector('meta[name="catalogo"]');
  var versione = meta ? String(meta.getAttribute('content') || '').trim().toUpperCase() : '';
  var chiave = 'catalogo-lettura-' + codice;

  function nuovoId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  // la lettura in corso: la stessa se nella scheda c'era da meno di un'ora
  var st = null;
  try { st = JSON.parse(sessionStorage.getItem(chiave) || 'null'); } catch (e) {}
  if (!st || !st.l || Date.now() - (st.t || 0) > ORA) st = { l: nuovoId(), t0: Date.now(), s: 0, p: 0, f: '', u: '', z: {}, k: [] };
  function ricorda() { st.t = Date.now(); try { sessionStorage.setItem(chiave, JSON.stringify(st)); } catch (e) {} }

  function corpo() {
    return JSON.stringify({ c: codice, l: st.l, v: versione, s: st.s, p: st.p, f: st.f || undefined, u: st.u || undefined, z: st.z, k: st.k });
  }
  var mandato = '';
  function invia(uscita) {
    var b = corpo();
    if (b === mandato) return;
    mandato = b;
    if (uscita && navigator.sendBeacon) {
      try { if (navigator.sendBeacon(INDIRIZZO, new Blob([b], { type: 'text/plain' }))) return; } catch (e) {}
    }
    try {
      fetch(INDIRIZZO, { method: 'POST', body: b, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(function () { mandato = ''; });
    } catch (e) { mandato = ''; }
  }

  function pronto(f) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', f); else f(); }
  pronto(function () {
    var sezioni = Array.prototype.slice.call(document.querySelectorAll('section.chapter[id]'));
    var ordine = {};
    sezioni.forEach(function (s, i) { ordine[s.id] = i; });

    // la sezione che si sta leggendo: quella che passa al 40% dello schermo, come l'indice
    function corrente() {
      var y = innerHeight * 0.4;
      for (var i = 0; i < sezioni.length; i++) {
        var r = sezioni[i].getBoundingClientRect();
        if (r.top <= y && r.bottom > y) return sezioni[i].id;
      }
      return '';
    }
    function percentuale() {
      var alto = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      return alto ? Math.min(100, Math.round((scrollY + innerHeight) / alto * 100)) : 0;
    }

    var uso = Date.now();
    function usa() { uso = Date.now(); }
    ['scroll', 'pointerdown', 'keydown', 'touchstart', 'wheel', 'mousemove'].forEach(function (ev) {
      addEventListener(ev, usa, { passive: true, capture: true });
    });

    // ogni secondo: se la pagina è davanti e usata da poco, il secondo conta (anche per la sezione)
    setInterval(function () {
      st.p = Math.max(st.p, percentuale());
      var qui = corrente();
      if (qui) {
        st.u = qui;
        if (!st.f || ordine[qui] > (ordine[st.f] === undefined ? -1 : ordine[st.f])) st.f = qui;
      }
      if (document.visibilityState !== 'visible' || Date.now() - uso > INATTIVO) return;
      st.s++;
      if (qui) st.z[qui] = (st.z[qui] || 0) + 1;
      if (st.s % 5 === 0) ricorda();
    }, 1000);

    // i clic: WhatsApp, «Copia link»/«Condividi», l'indice, le sale, il sito, i link esterni
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target : null; if (!t) return;
      var sez = t.closest('section.chapter[id]'), voce = null;
      var b = t.closest('button.share');
      if (b) {
        voce = { cosa: /condividi/i.test(b.textContent) ? 'condividi' : 'copia', d: sez ? sez.id : '' };
      } else {
        var a = t.closest('a[href]'); if (!a) return;
        var u; try { u = new URL(a.href, location.href); } catch (er) { return; }
        if (/(^|\.)wa\.me$/.test(u.hostname) || /whatsapp/.test(u.hostname)) {
          voce = { cosa: 'whatsapp', d: (u.searchParams.get('text') || '').slice(0, 120) };
        } else if (a.closest('.toc')) {
          voce = { cosa: 'indice', d: u.hash.slice(1) };
        } else if (u.origin === location.origin && u.pathname === location.pathname) {
          return;   // un salto dentro la pagina: lo dicono già le sezioni
        } else if (u.origin === location.origin && /\/studio\/sale\//.test(u.pathname)) {
          voce = { cosa: 'sala', d: u.pathname.split('/').pop().replace(/\.html$/, '') };
        } else if (u.origin === location.origin) {
          voce = { cosa: 'sito', d: (u.pathname + u.hash).slice(0, 120) };
        } else {
          voce = { cosa: 'esterno', d: (u.hostname + u.pathname).replace(/\/$/, '').slice(0, 120) };
        }
      }
      if (st.k.length >= 100) return;
      voce.q = Math.round((Date.now() - st.t0) / 1000);
      if (sez) voce.z = sez.id;
      st.k.push(voce); ricorda();
      // un link porta via dalla pagina: si manda subito, col beacon
      invia(true);
    }, true);

    ricorda();
    invia(false);
    setInterval(function () { if (document.visibilityState === 'visible') invia(false); }, OGNI);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { ricorda(); invia(true); } });
    addEventListener('pagehide', function () { ricorda(); invia(true); });
  });
})();
