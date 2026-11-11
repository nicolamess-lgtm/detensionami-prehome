/* Cloudflare Pages Function: salva le modifiche fatte con l'editor del catalogo
   (…/catalogo/?edit, aperto dal gestionale) e le scrive nel repo GitHub; Cloudflare
   ripubblica da solo. Può toccare SOLO le pagine e le foto del catalogo.
   Variabili da impostare nel progetto Pages (Settings → Variables and secrets):
     EDIT_PASSWORD  password scelta da Nicola
     GITHUB_TOKEN   token GitHub fine-grained, Contents: Read and write, solo su questo repo
     GITHUB_REPO    nicolamess-lgtm/detensionami-prehome
     GITHUB_BRANCH  facoltativo, default main */
const ALLOWED = /^catalogo\/([a-z0-9-]+\/)?(index\.html|img\/[a-z0-9_-]+\.(jpg|jpeg|png|webp))$/i;

export async function onRequestPost({ request, env }) {
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  let body; try { body = await request.json(); } catch { return json({ ok: false, error: 'Richiesta non valida' }, 400); }
  if (!env.EDIT_PASSWORD || !env.GITHUB_TOKEN || !env.GITHUB_REPO) return json({ ok: false, error: 'Modifica non configurata sul server' }, 500);
  if (body.password !== env.EDIT_PASSWORD) return json({ ok: false, error: 'Password sbagliata' }, 401);
  const path = String(body.path || '');
  if (!ALLOWED.test(path) || path.includes('..')) return json({ ok: false, error: 'File non consentito: ' + path }, 400);

  let content;
  if (typeof body.content === 'string') {
    const bytes = new TextEncoder().encode(body.content);
    if (bytes.length > 2_000_000) return json({ ok: false, error: 'Pagina troppo grande' }, 413);
    let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b)); content = btoa(bin);
  } else if (typeof body.contentBase64 === 'string') {
    if (body.contentBase64.length > 8_000_000) return json({ ok: false, error: 'Foto troppo grande' }, 413);
    content = body.contentBase64;
  } else return json({ ok: false, error: 'Contenuto mancante' }, 400);

  const branch = env.GITHUB_BRANCH || 'main';
  const api = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`;
  const headers = { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'detensionami-catalogo-editor', 'content-type': 'application/json' };

  let sha;
  const cur = await fetch(`${api}?ref=${branch}`, { headers });
  if (cur.ok) sha = (await cur.json()).sha;
  else if (cur.status !== 404) return json({ ok: false, error: 'GitHub: ' + cur.status }, 502);

  const put = await fetch(api, { method: 'PUT', headers, body: JSON.stringify({ message: String(body.message || 'Catalogo aggiornato dall\'editor').slice(0, 200), content, sha, branch }) });
  if (!put.ok) return json({ ok: false, error: 'GitHub: ' + put.status + ' ' + (await put.text()).slice(0, 200) }, 502);
  const r = await put.json();
  return json({ ok: true, commit: r.commit && r.commit.html_url });
}
