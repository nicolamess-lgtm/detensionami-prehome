// «Porta un amico» (CRM-SMART, AGENTS.md §49): www.detensionami.it/da/davide-k7m2xq9p
// è il link personale con cui un cliente invita qualcuno. Il codice è nome di
// battesimo, trattino, 8 caratteri.
//
// Qui si porta soltanto alla home col codice nell'indirizzo (?da=…): è da.js,
// dentro la pagina, che conta l'apertura, mostra «Ti manda Davide» e mette il
// codice nei pulsanti WhatsApp. Funziona solo su Cloudflare Pages: su GitHub
// Pages il link va scritto come /?da=<codice>.
const CODICE = /^[a-z]{1,16}-[a-km-np-z2-9]{8}$/;

export function onRequest({ params, request, next }) {
  const codice = String(params.codice || '').toLowerCase();
  if (!CODICE.test(codice)) return next();
  const u = new URL(request.url);
  return new Response(null, {
    status: 302,
    headers: {
      Location: u.origin + '/?da=' + codice,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
