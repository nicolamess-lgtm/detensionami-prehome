/* «Torna alla tua pagina»: per il cliente che arriva su una sala dalla sua
   pagina personale (CRM-SMART, AGENTS.md §47). La pagina del cliente apre la
   sala nella stessa scheda con il segno #dalla-tua-pagina; qui il segno si
   toglie dall'indirizzo e in cima compare la striscia per tornare.

   - il sito non sa chi è il cliente: si torna con la cronologia del browser
     (history.back()), mai con un indirizzo. Il segreto della pagina non
     arriva qui e non deve arrivarci;
   - finché si gira per il sito, ogni link interno sostituisce la pagina
     invece di aggiungerne una: così «indietro», dalla striscia o dal
     browser, riporta sempre alla pagina del cliente, anche dopo tre sale;
   - il ricordo sta in sessionStorage (solo questa scheda) e dura due ore. */
(function () {
  var SEGNO = '#dalla-tua-pagina', CHIAVE = 'dalla-tua-pagina', DURATA = 2 * 3600 * 1000;
  function ricordo() { try { return Date.now() - Number(sessionStorage.getItem(CHIAVE) || 0) < DURATA; } catch (e) { return false; } }
  function ricorda(si) { try { si ? sessionStorage.setItem(CHIAVE, String(Date.now())) : sessionStorage.removeItem(CHIAVE); } catch (e) {} }

  var arrivo = location.hash === SEGNO;
  if (arrivo) {
    ricorda(true);
    // chi copia l'indirizzo da qui non si porta dietro la striscia
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
  }
  if (!arrivo && !ricordo()) return;
  // aperta da sola, senza una pagina prima: non c'è dove tornare
  if (history.length < 2) { ricorda(false); return; }

  var stile = document.createElement('style');
  stile.textContent =
    '.torna-bar{background:var(--espresso,#1B1714);color:var(--sand,#F6F1EA)}' +
    '.torna-bar button{display:flex;align-items:center;gap:10px;width:100%;height:44px;padding:0;border:0;background:none;color:inherit;' +
      'font:500 12px/1 var(--sans,sans-serif);letter-spacing:.18em;text-transform:uppercase;cursor:pointer;text-align:left}' +
    '.torna-bar button:hover,.torna-bar button:focus-visible{color:#fff}' +
    '.torna-bar .freccia{font-size:18px;letter-spacing:0}' +
    'body.dalla-tua-pagina [id]{scroll-margin-top:calc(var(--header-h,74px) + 52px)}';
  document.head.appendChild(stile);

  function mostra() {
    var testata = document.querySelector('.site-header');
    if (!testata || document.querySelector('.torna-bar')) return;
    var bar = document.createElement('div');
    bar.className = 'torna-bar';
    bar.innerHTML = '<div class="wrap"><button type="button"><span class="freccia" aria-hidden="true">←</span>Torna alla tua pagina</button></div>';
    bar.querySelector('button').addEventListener('click', function () { ricorda(false); history.back(); });
    testata.insertBefore(bar, testata.firstChild);
    document.body.classList.add('dalla-tua-pagina');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mostra); else mostra();

  // i link interni sostituiscono la pagina: la pagina del cliente resta un passo indietro
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin) return;
    e.preventDefault();
    ricorda(true);
    location.replace(u.href);
  });
})();
