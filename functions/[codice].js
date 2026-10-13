// Link brevi della pagina del cliente: www.detensionami.it/davide-k7m2xq9pr4
// porta alla sua pagina nel gestionale (CRM-SMART, AGENTS.md §44).
// Funziona solo su Cloudflare Pages: GitHub Pages non esegue questo file.
//
// Il codice è nome di battesimo, trattino, 10 caratteri casuali: tutto il
// resto (le pagine del sito, le immagini) passa oltre e si serve come sempre.
const PAGINA_CLIENTE = 'https://crm-smart.pages.dev/portale.html';
const CODICE = /^[a-z]{1,16}-[a-km-np-z2-9]{10}$/;

export function onRequest({ params, next }) {
  // chi lo scrive a mano può mettere una maiuscola: il codice è tutto minuscolo
  // e la punteggiatura che un messaggio attacca in fondo al link («…pr4,», «…pr4.», «…pr4)») si toglie:
  // senza, il codice non torna e il sito risponde con una pagina senza grafica
  let codice = String(params.codice || '').toLowerCase();
  try { codice = decodeURIComponent(codice); } catch (e) {}
  codice = codice.replace(/[^a-z0-9]+$/, '');
  if (!CODICE.test(codice)) return next();
  // il codice va dopo il «#»: da lì in poi il browser non lo manda a nessun server
  return new Response(null, {
    status: 302,
    headers: {
      Location: PAGINA_CLIENTE + '#' + codice,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
    },
  });
}
