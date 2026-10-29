'use strict';
// Pruebas unitarias de feeds.js (caja blanca + partición de equivalencia)
const test = require('node:test');
const assert = require('node:assert/strict');
const { FEEDS, parseFeed, merge } = require('../feeds.js');

const feed = { id: 'f', name: 'Fuente', sport: null, tags: [] };
const item = (body) => `<rss><channel><item>${body}</item></channel></rss>`;

test('CP-U01 parseFeed extrae título, enlace, resumen y fecha', () => {
  const [it] = parseFeed(item('<title>Gol de Millonarios</title><link>http://x.co/futbol/a</link><description>Resumen</description><pubDate>Mon, 26 Oct 2026 10:00:00 GMT</pubDate>'), feed);
  assert.equal(it.title, 'Gol de Millonarios');
  assert.equal(it.link, 'https://x.co/futbol/a'); // fuerza https
  assert.equal(it.summary, 'Resumen');
  assert.equal(it.date, Date.parse('2026-10-26T10:00:00Z'));
});

test('CP-U02 descarta ítems sin título o sin enlace', () => {
  assert.equal(parseFeed(item('<link>https://x.co/a</link>'), feed).length, 0);
  assert.equal(parseFeed(item('<title>Sin enlace</title>'), feed).length, 0);
});

test('CP-U03 usa guid como enlace si no hay <link>', () => {
  const [it] = parseFeed(item('<title>T</title><guid>https://x.co/g</guid>'), feed);
  assert.equal(it.link, 'https://x.co/g');
});

test('CP-U04 decodifica CDATA y entidades HTML', () => {
  const [it] = parseFeed(item('<title><![CDATA[Atl&eacute;tico &amp; Nacional]]></title><link>https://x.co/a</link>'), feed);
  assert.equal(it.title, 'Atlético & Nacional');
});

test('CP-U05 límite: máximo 25 ítems por fuente (24, 25, 26)', () => {
  const xml = (n) => '<rss>' + Array.from({ length: n }, (_, i) => `<item><title>T${i}</title><link>https://x.co/${i}</link></item>`).join('') + '</rss>';
  assert.equal(parseFeed(xml(24), feed).length, 24);
  assert.equal(parseFeed(xml(25), feed).length, 25);
  assert.equal(parseFeed(xml(26), feed).length, 25);
});

test('CP-U06 límite: resumen se corta en 280 caracteres', () => {
  const [it] = parseFeed(item(`<title>T</title><link>https://x.co/a</link><description>${'a'.repeat(300)}</description>`), feed);
  assert.equal(it.summary.length, 280);
});

test('CP-U07 fecha inválida o ausente devuelve 0', () => {
  const [a] = parseFeed(item('<title>T</title><link>https://x.co/a</link><pubDate>no-fecha</pubDate>'), feed);
  const [b] = parseFeed(item('<title>T</title><link>https://x.co/b</link>'), feed);
  assert.equal(a.date, 0);
  assert.equal(b.date, 0);
});

test('CP-U08 elige la imagen más grande y la pasa a https', () => {
  const [it] = parseFeed(item('<title>T</title><link>https://x.co/a</link><media:thumbnail url="http://i.co/s.jpg"/><media:content url="http://i.co/b.jpg" medium="image" width="1200"/>'), feed);
  assert.equal(it.image, 'https://i.co/b.jpg');
});

test('CP-U09 clasifica deporte por la ruta del enlace', () => {
  const sport = (link) => parseFeed(item(`<title>Noticia</title><link>${link}</link>`), feed)[0].sport;
  assert.equal(sport('https://x.co/ciclismo/a'), 'ciclismo');
  assert.equal(sport('https://x.co/tenis/a'), 'tenis');
  assert.equal(sport('https://x.co/nba/a'), 'baloncesto');
  assert.equal(sport('https://x.co/formula-1/a'), 'f1');
  assert.equal(sport('https://x.co/futbol/a'), 'futbol');
});

test('CP-U10 clasifica por palabras clave y etiqueta Colombia/Champions', () => {
  const [it] = parseFeed(item('<title>Luis Díaz marca en la Champions</title><link>https://x.co/n/1</link>'), feed);
  assert.equal(it.sport, 'futbol');
  assert.ok(it.tags.includes('colombia'));
  assert.ok(it.tags.includes('champions'));
  const [otro] = parseFeed(item('<title>Receta de arepas</title><link>https://x.co/n/2</link>'), feed);
  assert.equal(otro.sport, 'otros');
});

test('CP-U11 merge quita duplicados por enlace y por titular normalizado', () => {
  const a = { link: 'https://a/1', title: 'Gol de Falcao', date: 3 };
  const b = { link: 'https://a/1', title: 'Otro', date: 2 };
  const c = { link: 'https://b/9', title: 'GOL DE FALCAO!', date: 1 };
  const d = { link: 'https://c/2', title: 'Nueva', date: 5 };
  const out = merge([[a, b], [c, d]]);
  assert.deepEqual(out.map(i => i.link), ['https://c/2', 'https://a/1']);
});

test('CP-U12 merge corrige fechas en el futuro', () => {
  const futuro = Date.now() + 24 * 3600 * 1000;
  const [it] = merge([[{ link: 'https://a', title: 'T', date: futuro }]]);
  assert.ok(it.date <= Date.now());
});

test('CP-U13 catálogo de fuentes: 16 feeds con id único y URL https', () => {
  assert.equal(FEEDS.length, 16);
  assert.equal(new Set(FEEDS.map(f => f.id)).size, FEEDS.length);
  assert.ok(FEEDS.every(f => f.url.startsWith('https://')));
});
