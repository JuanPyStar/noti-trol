/* Noti-Trol · servidor en vivo (Node 18+, sin dependencias)
 * - Sirve la web estática
 * - /api/news  → une los RSS de diarios deportivos, caché de 60 s
 * Uso: node server.js   (luego abre http://localhost:3000)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { FEEDS, parseFeed, merge } = require('./feeds.js');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const TTL = 60 * 1000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.webmanifest': 'application/manifest+json' };

let cache = { at: 0, data: null, pending: null };
const espnCache = new Map();

async function fetchFeed(feed) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(feed.url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' }, signal: ctrl.signal, redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    const head = buf.subarray(0, 200).toString('latin1');
    const ct = r.headers.get('content-type') || '';
    const enc = (/encoding="([^"]+)"/i.exec(head) || /charset=([\w-]+)/i.exec(ct) || [])[1] || 'utf-8';
    let xml;
    try { xml = new TextDecoder(enc.toLowerCase()).decode(buf); } catch { xml = buf.toString('utf8'); }
    const items = parseFeed(xml, feed);
    return { id: feed.id, name: feed.name, ok: true, count: items.length, items };
  } catch (e) {
    return { id: feed.id, name: feed.name, ok: false, count: 0, error: String(e.message || e), items: [] };
  } finally { clearTimeout(timer); }
}

async function refresh() {
  const t0 = Date.now();
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const items = merge(results.map(r => r.items)).slice(0, 320);
  const data = { updated: Date.now(), took: Date.now() - t0, sources: results.map(({ items, ...s }) => s), items };
  cache = { at: Date.now(), data, pending: null };
  const ok = results.filter(r => r.ok).length;
  console.log(`[${new Date().toLocaleTimeString('es-CO')}] ${items.length} noticias de ${ok}/${FEEDS.length} fuentes en ${data.took} ms`);
  return data;
}

function getNews() {
  if (cache.data && Date.now() - cache.at < TTL) return Promise.resolve(cache.data);
  if (!cache.pending) cache.pending = refresh().catch(e => { cache.pending = null; throw e; });
  // mientras refresca, entrega lo último que hay (si existe) para no bloquear
  return cache.data ? Promise.resolve(cache.data) : cache.pending;
}

function send(res, code, body, type, extra) {
  res.writeHead(code, Object.assign({ 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' }, extra || {}));
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/news') {
    try {
      const data = await getNews();
      const since = Number(url.searchParams.get('since')) || 0;
      const out = since ? Object.assign({}, data, { items: data.items.filter(i => i.date > since) }) : data;
      return send(res, 200, JSON.stringify(out), MIME['.json'], { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    } catch (e) {
      return send(res, 502, JSON.stringify({ error: String(e) }), MIME['.json']);
    }
  }
  if (url.pathname === '/api/espn') {
    // reenvía solo marcadores y tablas de fútbol de la API pública de ESPN (caché 20 s)
    const p = url.searchParams.get('p') || '';
    const m = p.match(/^(scoreboard|standings)\/([a-z]{3,10}\.[a-z0-9_]{1,20})$/);
    if (!m) return send(res, 400, '{"error":"ruta no permitida"}', MIME['.json']);
    const target = m[1] === 'scoreboard'
      ? `https://site.api.espn.com/apis/site/v2/sports/soccer/${m[2]}/scoreboard`
      : `https://site.api.espn.com/apis/v2/sports/soccer/${m[2]}/standings`;
    const ttl = m[1] === 'scoreboard' ? 20000 : 300000;
    const hit = espnCache.get(target);
    if (hit && Date.now() - hit.at < ttl) return send(res, 200, hit.body, MIME['.json'], { 'Cache-Control': 'no-store' });
    try {
      const r = await fetch(target, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const body = await r.text();
      espnCache.set(target, { at: Date.now(), body });
      return send(res, 200, body, MIME['.json'], { 'Cache-Control': 'no-store' });
    } catch (e) {
      if (hit) return send(res, 200, hit.body, MIME['.json']);
      return send(res, 502, JSON.stringify({ error: String(e.message || e) }), MIME['.json']);
    }
  }
  if (url.pathname === '/api/health') return send(res, 200, JSON.stringify({ ok: true, feeds: FEEDS.length, cachedAt: cache.at }), MIME['.json']);

  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || /[\\/]\.|server\.js$|package/.test(file)) return send(res, 404, 'No encontrado', 'text/plain; charset=utf-8');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'No encontrado', 'text/plain; charset=utf-8');
    send(res, 200, buf, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', { 'Cache-Control': 'no-cache' });
  });
});

server.listen(PORT, () => {
  console.log(`\n  ⚽ Noti-Trol en vivo → http://localhost:${PORT}\n`);
  refresh().catch(() => {});
  setInterval(() => refresh().catch(() => {}), TTL); // mantiene la caché caliente
});
