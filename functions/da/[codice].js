// «Porta un amico» (CRM-SMART, AGENTS.md §49): www.detensionami.it/da/davide-k7m2xq9p
// è il link personale con cui un cliente invita qualcuno. Il codice è nome di
// battesimo, trattino, 8 caratteri.
//
// Qui si porta soltanto alla home col codice nell'indirizzo (?da=…): è da.js,
// dentro la pagina, che conta l'apertura, mostra «Ti manda Davide» e mette il
// codice nei pulsanti WhatsApp. Funziona solo su Cloudflare Pages: su GitHub
// Pages il link va scritto come /?da=<codice>.
//
// Un indirizzo /da/… che non porta un codice va comunque alla home: mai la
// pagina servita sotto /da/, dove fogli di stile e immagini non si trovano.
const CODICE = /^[a-z]{1,16}-[a-km-np-z2-9]{8}/;

export function onRequest({ params, request }) {
  let testo = String(params.codice || '').toLowerCase();
  try { testo = decodeURIComponent(testo); } catch (e) {}
  // il codice è all'inizio: quello che segue («,», «.», «)», un pezzo di frase) si lascia
  const m = CODICE.exec(testo);
  const u = new URL(request.url);
  return new Response(null, {
    status: 302,
    headers: {
      Location: u.origin + (m ? '/?da=' + m[0] : '/'),
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
