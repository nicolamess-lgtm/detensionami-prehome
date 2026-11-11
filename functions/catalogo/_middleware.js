// Il catalogo si apre solo con un link personale (CRM-SMART, AGENTS.md §69):
// www.detensionami.it/catalogo/?c=k7m2xq9p. Chi scrive /catalogo/ a mano, o
// ha un link revocato, vede «Catalogo riservato». Funziona solo su Cloudflare
// Pages: GitHub Pages non esegue questo file.
//
// Il codice lo controlla catalogo_percorso() su Supabase, con la chiave
// pubblica: risponde col solo percorso della versione del link (/catalogo/,
// /catalogo/2025/…). Se il link è di un'altra versione, si va lì.
// Fogli di stile, immagini e script passano: si guardano solo le pagine.
//
// I prezzi (§69, dal 15/01): se la versione ha un listino nel gestionale,
// catalogo_apri() li manda col percorso, e qui si scrivono nella pagina al
// posto di quelli segnati con data-prezzo:
//   durata:60                  → prezzo per durata del listino
//   pacchetto:5x60             → prezzo pieno del pacchetto 5 × 60 minuti
//   pacchetto:5x60:anticipato  → prezzo anticipato dello stesso pacchetto
//   risparmio:52x60            → pieno meno anticipato
//   altro:<nome>               → «Altri prezzi del catalogo» del listino, per nome
// Un prezzo che il listino non ha resta quello scritto. Con ?edit no: l'editor
// lavora sulla pagina com'è. Senza catalogo_apri (SQL non ancora incollato)
// si torna a catalogo_percorso, coi prezzi della pagina.
//
// L'editor (/catalogo/?edit, catalogo/edit.js) non ha un codice: passa con la
// password dell'editor (EDIT_PASSWORD, la stessa di /api/save), chiesta dal
// browser una volta (autenticazione HTTP Basic, nome qualsiasi). Il browser la
// rimanda da solo anche al fetch(page + '?edit') con cui l'editor rilegge la
// pagina. Senza EDIT_PASSWORD su Cloudflare, ?edit resta chiuso come il resto.
const SUPABASE = 'https://rsqhmczqyqkcbgvygdrl.supabase.co';
const CHIAVE = 'sb_publishable_JNi_HHIXLmR_V_Q45E_k2g_0ucSGtL2';   // chiave pubblica
const CODICE = /^[a-km-np-z2-9]{8}$/;
const WHATSAPP = 'https://wa.me/393347918516?text=' + encodeURIComponent('Ciao Nicola, vorrei ricevere il catalogo.');

function riservato(guasto) {
  const testo = guasto
    ? 'Non riesco a controllare il tuo link in questo momento. Riprova tra poco.'
    : 'Il catalogo si apre con il link personale che ti ho mandato. Se non ce l\'hai, o non funziona più, scrivimi e te ne mando uno.';
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Catalogo riservato · Detensionami</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F6F1EA;color:#1B1714;font:400 16px/1.6 Inter,system-ui,sans-serif;padding:24px;box-sizing:border-box}
main{max-width:420px;text-align:center}h1{font:400 34px/1.2 'Cormorant Garamond',Georgia,serif;margin:0 0 12px}p{margin:0 0 24px;color:#5b5048}
a{display:inline-block;background:#A8573A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:500}</style></head>
<body><main><h1>Catalogo riservato</h1><p>${testo}</p><a href="${WHATSAPP}">Scrivimi su WhatsApp</a></main></body></html>`;
  return new Response(html, {
    status: guasto ? 503 : 403,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' },
  });
}

// 1500 → «1.500 €», 12.5 → «12,50 €»
export function euro(n) {
  const x = Math.round(Number(n) * 100) / 100;
  const [intera, dec] = x.toFixed(2).split('.');
  return intera.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec === '00' ? '' : ',' + dec) + ' €';
}
const normale = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
// il prezzo di una chiave data-prezzo nei prezzi del listino; undefined se non c'è
export function prezzoPer(chiave, p) {
  if (!p || !chiave) return undefined;
  const [tipo, a, b] = String(chiave).split(':');
  let v;
  if (tipo === 'durata') v = p.durata && p.durata[a];
  else if (tipo === 'pacchetto' || tipo === 'risparmio') {
    const [sedute, minuti] = String(a || '').split('x').map(Number);
    const k = (Array.isArray(p.pacchetti) ? p.pacchetti : []).find((k) => Number(k.sedute) === sedute && Number(k.minuti || 60) === minuti);
    if (k) v = tipo === 'risparmio' ? (Number(k.anticipato) > 0 ? Number(k.prezzo) - Number(k.anticipato) : undefined) : b === 'anticipato' ? k.anticipato : k.prezzo;
  } else if (tipo === 'altro') {
    const nome = normale(String(chiave).slice(6));
    const x = (Array.isArray(p.altri) ? p.altri : []).find((x) => normale(x.nome) === nome);
    if (x) v = x.prezzo;
  }
  v = Number(v);
  return v > 0 ? v : undefined;
}

function chiediPassword() {
  return new Response('Serve la password dell\'editor del catalogo.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Editor del catalogo", charset="UTF-8"', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
function passwordGiusta(request, attesa) {
  const m = /^Basic\s+(.+)$/i.exec(request.headers.get('Authorization') || '');
  if (!m) return false;
  let chiaro = '';
  try { chiaro = new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0))); } catch (e) { return false; }
  const data = chiaro.slice(chiaro.indexOf(':') + 1), a = new TextEncoder().encode(data), b = new TextEncoder().encode(attesa);
  if (a.length !== b.length) return false;
  let diversi = 0;
  for (let i = 0; i < a.length; i++) diversi |= a[i] ^ b[i];
  return diversi === 0;
}
function senzaCache(risposta) {
  const pagina = new Response(risposta.body, risposta);
  pagina.headers.set('Cache-Control', 'no-store');
  pagina.headers.set('X-Robots-Tag', 'noindex');
  pagina.headers.set('Referrer-Policy', 'no-referrer');
  return pagina;
}

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  // un file con estensione (css, js, immagini) passa; le pagine (.html o cartelle) no
  if (/\.[a-z0-9]+$/i.test(url.pathname) && !/\.html?$/i.test(url.pathname)) return next();

  // l'editor: con la password, senza codice
  if (url.searchParams.has('edit')) {
    if (!env || !env.EDIT_PASSWORD) return riservato(false);
    if (!passwordGiusta(request, env.EDIT_PASSWORD)) return chiediPassword();
    return senzaCache(await next());
  }

  const codice = (url.searchParams.get('c') || '').toLowerCase().trim();
  if (!CODICE.test(codice)) return riservato(false);
  let percorso = null, prezzi = null;
  const chiedi = (funzione) => fetch(SUPABASE + '/rest/v1/rpc/' + funzione, {
    method: 'POST',
    headers: { apikey: CHIAVE, Authorization: 'Bearer ' + CHIAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_codice: codice }),
  });
  try {
    let r = await chiedi('catalogo_apri');
    if (r.status === 404) {
      // catalogo_apri non c'è ancora: il percorso solo, coi prezzi della pagina
      r = await chiedi('catalogo_percorso');
      if (!r.ok) return riservato(true);
      percorso = await r.json();
    } else {
      if (!r.ok) return riservato(true);
      const d = await r.json();
      if (d && typeof d === 'object') { percorso = d.percorso; prezzi = d.prezzi || null; }
    }
  } catch (e) {
    return riservato(true);
  }
  if (typeof percorso !== 'string' || !/^\/catalogo\//.test(percorso)) return riservato(false);

  // il link è di un'altra versione: si va lì, col codice (e &prova, se c'era)
  const qui = url.pathname.replace(/index\.html?$/i, '');
  if (qui !== percorso) {
    const dove = new URL(percorso, url);
    dove.search = url.search;
    return new Response(null, { status: 302, headers: { Location: dove.toString(), 'Cache-Control': 'no-store' } });
  }

  const pagina = senzaCache(await next());
  if (!prezzi || typeof HTMLRewriter === 'undefined' || !/text\/html/i.test(pagina.headers.get('Content-Type') || '')) return pagina;
  return new HTMLRewriter().on('[data-prezzo]', {
    element(el) {
      const v = prezzoPer(el.getAttribute('data-prezzo'), prezzi);
      if (v !== undefined) el.setInnerContent(euro(v));
    },
  }).transform(pagina);
}
