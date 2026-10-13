/* «Porta un amico» (CRM-SMART, AGENTS.md §49).
   Chi arriva con ?da=<codice> è stato invitato da un cliente: si conta
   l'apertura (invito_apri, che risponde col solo nome di battesimo di chi
   invita e il nome dello studio), si mostra «Ti manda Davide» in alto, e
   ogni pulsante WhatsApp del sito porta già scritto «mi manda Davide ·
   invito davide-k7m2xq9p»: così quando scrive, lo studio sa da chi arriva.
   Il codice resta nella scheda (sessionStorage) finché si gira per il sito;
   una ricarica non conta due volte. Niente cookie, nessun dato di chi apre. */
(function () {
  var SUPABASE = 'https://rsqhmczqyqkcbgvygdrl.supabase.co';
  var CHIAVE = 'sb_publishable_JNi_HHIXLmR_V_Q45E_k2g_0ucSGtL2';   // chiave pubblica: apre solo invito_apri
  var CODICE = /^[a-z]{1,16}-[a-km-np-z2-9]{8}$/;
  var m = /[?&]da=([^&#]+)/.exec(location.search), codice = '';
  try { codice = m ? decodeURIComponent(m[1]).toLowerCase().trim() : ''; } catch (e) {}
  // la punteggiatura che un messaggio attacca in fondo al link si lascia: conta il codice all'inizio
  var inizio = /^[a-z]{1,16}-[a-km-np-z2-9]{8}/.exec(codice); if (inizio) codice = inizio[0];
  var ricordo = null;
  try { ricordo = JSON.parse(sessionStorage.getItem('da') || 'null'); } catch (e) {}
  function ricorda(d) { try { sessionStorage.setItem('da', JSON.stringify(d)); } catch (e) {} }
  function pronto(f) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', f); else f(); }

  function mostra(d) {
    pronto(function () {
      if (document.querySelector('.da-fascia')) return;
      var st = document.createElement('style');
      st.textContent = '.da-fascia{position:sticky;top:0;z-index:60;background:#A8573A;color:#fff;font:400 14px/1.45 Inter,system-ui,sans-serif;text-align:center;padding:12px 18px}' +
        '.da-fascia b{font-weight:600}.da-fascia a{color:#fff;text-decoration:underline;text-underline-offset:3px;margin-left:8px;white-space:nowrap}';
      document.head.appendChild(st);
      var f = document.createElement('div'); f.className = 'da-fascia';
      var nome = document.createElement('b'); nome.textContent = d.nome;
      f.appendChild(document.createTextNode('Ti manda '));
      f.appendChild(nome);
      f.appendChild(document.createTextNode('. Benvenuto: guarda le sale con calma e, quando vuoi, scrivimi.'));
      document.body.insertBefore(f, document.body.firstChild);
      // i pulsanti WhatsApp: il messaggio parte già con chi ti manda e il codice
      var tutti = document.querySelectorAll('a[href*="wa.me/"]');
      for (var i = 0; i < tutti.length; i++) {
        try {
          var u = new URL(tutti[i].href);
          var testo = (u.searchParams.get('text') || '').replace(/^Ciao(\s+Nicola)?[,!.]?\s*/i, '').trim();
          if (!testo) testo = 'vorrei qualche informazione.';
          u.searchParams.set('text', 'Ciao Nicola, mi manda ' + d.nome + ' · invito ' + d.codice + '. ' + testo.charAt(0).toUpperCase() + testo.slice(1));
          tutti[i].href = u.toString();
        } catch (e) {}
      }
    });
  }

  if (codice && CODICE.test(codice)) {
    // il codice esce dall'indirizzo: resta nella scheda, e un indirizzo copiato da qui non lo porta con sé
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
    if (ricordo && ricordo.codice === codice) return mostra(ricordo);
    fetch(SUPABASE + '/rest/v1/rpc/invito_apri', {
      method: 'POST', body: JSON.stringify({ p_codice: codice }),
      headers: { 'apikey': CHIAVE, 'Authorization': 'Bearer ' + CHIAVE, 'Content-Type': 'application/json' }
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.nome) return;
      var dati = { codice: codice, nome: String(d.nome).slice(0, 40) };
      ricorda(dati); mostra(dati);
    }).catch(function () {});
  } else if (ricordo && ricordo.codice && CODICE.test(ricordo.codice)) mostra(ricordo);
})();
