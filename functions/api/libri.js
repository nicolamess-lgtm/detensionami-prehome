/* I libri del catalogo, per le pagine dei clienti del gestionale (CRM-SMART, AGENTS.md §69).
   GET /api/libri → [{ id, numero, titolo, descrizione, stato, copertina, link: [{ tipo, testo, href }] }]

   La fonte è una sola: la sezione «I libri» di catalogo/index.html (id="libri"),
   quella che si cambia con l'editor del catalogo. Qui si legge il file così com'è
   (env.ASSETS, senza passare dal link personale: i libri non hanno prezzi né
   dati di nessuno) e si restituiscono solo titolo, descrizione, stato, copertina
   e link. Ai link di Amazon si aggiunge il codice affiliato dello studio
   (tag=detensionami-21) se manca. Aperto a tutti (CORS), in cache 10 minuti. */
const TAG = 'detensionami-21';

const decodifica = (s) => String(s || '')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

export function conTag(href) {
  try {
    const u = new URL(href);
    if (!/(^|\.)amazon\.[a-z.]+$/i.test(u.hostname)) return href;
    u.searchParams.set('tag', TAG);
    return u.toString();
  } catch { return href; }
}

export function libriDa(html, base) {
  const sezione = /<section[^>]*\bid="libri"[^>]*>([\s\S]*?)<\/section>/i.exec(html);
  if (!sezione) return [];
  const out = [];
  const voci = sezione[1].match(/<li\b[\s\S]*?<\/li>/gi) || [];
  for (const li of voci) {
    const titolo = decodifica((/<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(li) || [])[1]);
    if (!titolo) continue;
    const src = (/<img[^>]*\bsrc="([^"]+)"/i.exec(li) || [])[1];
    const link = [];
    for (const m of li.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const href = (/\bhref="([^"]+)"/i.exec(m[1]) || [])[1];
      if (!href || !/^https:\/\//i.test(href)) continue;
      link.push({ tipo: (/\bdata-tipo="([^"]+)"/i.exec(m[1]) || [])[1] || '', testo: decodifica(m[2]), href: conTag(href) });
    }
    out.push({
      id: (/<li[^>]*\bid="([^"]+)"/i.exec(li) || [])[1] || '',
      numero: decodifica((/<span[^>]*class="n"[^>]*>([\s\S]*?)<\/span>/i.exec(li) || [])[1]),
      titolo,
      descrizione: decodifica((/<h3[\s\S]*?<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/i.exec(li) || [])[1]),
      stato: decodifica((/<span[^>]*class="st"[^>]*>([\s\S]*?)<\/span>/i.exec(li) || [])[1]),
      copertina: src ? new URL(src, base).toString() : '',
      link,
    });
  }
  return out;
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }

export async function onRequestGet({ request, env }) {
  const pagina = new URL('/catalogo/index.html', request.url);
  let libri = [];
  try {
    const r = await env.ASSETS.fetch(pagina);
    if (r.ok) libri = libriDa(await r.text(), new URL('/catalogo/', request.url));
  } catch { libri = []; }
  return new Response(JSON.stringify(libri), {
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=600', 'X-Robots-Tag': 'noindex' },
  });
}
