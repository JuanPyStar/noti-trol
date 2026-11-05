'use strict';
// Pruebas de integración de /api/news y /api/espn dentro del mismo proceso,
// con un doble de prueba de fetch (sin red) y fixtures de preparación/limpieza.
const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createServer, resetCache, TTL } = require('../server.js');
const upstream = require('./helpers/fake-upstream.js');
const { FEEDS } = require('../feeds.js');

const MIN = 60000;
const TOTAL = FEEDS.length * 2 + 1; // 2 propias por fuente + 1 titular repetido que se deduplica
let srv, BASE, fake;

// ---------- fixtures ----------
before(async () => {
  fake = upstream.instalar();
  srv = createServer();
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); // puerto libre asignado por el SO
  BASE = `http://127.0.0.1:${srv.address().port}`;
});
after(async () => {
  await new Promise(r => srv.close(r));
  fake.restaurar();
});
beforeEach(() => { resetCache(); fake.reiniciar(); }); // cada caso arranca sin caché ni llamadas previas

const getJson = async (ruta) => { const r = await fetch(BASE + ruta); return { status: r.status, body: await r.json() }; };
const llamadasRss = () => fake.llamadas.filter(u => !u.includes('espn')).length;

describe('/api/news', () => {
  test('CP-I07 une las 16 fuentes, quita duplicados y ordena por fecha descendente', async () => {
    const { status, body } = await getJson('/api/news');
    assert.equal(status, 200);
    assert.equal(body.sources.length, 16);
    assert.ok(body.sources.every(s => s.ok));
    assert.equal(body.items.length, TOTAL);
    assert.equal(body.items.filter(i => /clásico/.test(i.title)).length, 1);
    const fechas = body.items.map(i => i.date);
    assert.deepEqual(fechas, [...fechas].sort((a, b) => b - a));
  });

  test('CP-I08 la caché de 60 s evita volver a pedir los RSS', async () => {
    await getJson('/api/news');
    assert.equal(llamadasRss(), 16);
    await getJson('/api/news');
    await getJson('/api/news');
    assert.equal(llamadasRss(), 16, 'la 2.ª y 3.ª petición deben salir de la caché');
  });

  test('CP-I08b con la caché vencida entrega lo último y refresca en segundo plano', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
    await getJson('/api/news');
    t.mock.timers.tick(TTL + 1000);
    const { status, body } = await getJson('/api/news');
    assert.equal(status, 200);
    assert.equal(body.items.length, TOTAL); // no bloquea: responde con lo último
    // espera explícita (no fija): sondea hasta 1 s a que termine el refresco en segundo plano
    for (let i = 0; i < 40 && llamadasRss() < 32; i++) await new Promise(r => setTimeout(r, 25));
    assert.equal(llamadasRss(), 32, 'debe disparar un segundo ciclo de 16 peticiones');
  });

  // Prueba parametrizada: valores límite del parámetro since
  const casosSince = [
    { since: '',                          esperado: TOTAL, nota: 'sin parámetro' },
    { since: 'abc',                       esperado: TOTAL, nota: 'no numérico → 0' },
    { since: upstream.T0 - 2 * MIN - 1,   esperado: 3,     nota: '1 ms antes de la 3.ª más reciente' },
    { since: upstream.T0 - 1,             esperado: 1,     nota: '1 ms antes de la más reciente' },
    { since: upstream.T0,                 esperado: 0,     nota: 'igual a la más reciente (estricto >)' }
  ];
  for (const c of casosSince) {
    test(`CP-I09 since=${c.since || '∅'} devuelve ${c.esperado} (${c.nota})`, async () => {
      const { body } = await getJson('/api/news' + (c.since === '' ? '' : '?since=' + c.since));
      assert.equal(body.items.length, c.esperado);
    });
  }

  test('CP-I11 una fuente caída no tumba la portada', async () => {
    fake.caidas.add('marca-1a');
    const { status, body } = await getJson('/api/news');
    assert.equal(status, 200);
    const caida = body.sources.find(s => s.id === 'marca-1a');
    assert.equal(caida.ok, false);
    assert.match(caida.error, /HTTP 503/);
    assert.equal(body.sources.filter(s => s.ok).length, 15);
    assert.equal(body.items.length, TOTAL - 2);
  });
});

describe('/api/espn', () => {
  // Prueba parametrizada: cada ruta permitida se traduce a la URL correcta de ESPN
  const rutas = [
    ['scoreboard/col.1', 'https://site.api.espn.com/apis/site/v2/sports/soccer/col.1/scoreboard'],
    ['scoreboard/uefa.champions', 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard'],
    ['standings/col.1', 'https://site.api.espn.com/apis/v2/sports/soccer/col.1/standings']
  ];
  for (const [p, destino] of rutas) {
    test(`CP-I10 ${p} se reenvía a ESPN y queda en caché`, async () => {
      const a = await getJson('/api/espn?p=' + p);
      const b = await getJson('/api/espn?p=' + p);
      assert.equal(a.status, 200);
      assert.equal(a.body.url, destino);
      assert.deepEqual(b.body, a.body);
      assert.equal(fake.llamadas.length, 1, 'la segunda petición debe salir de la caché');
    });
  }

  test('CP-I12 ESPN caído: 502 sin caché y respaldo con la última respuesta', async (t) => {
    fake.espnCaida = true;
    assert.equal((await getJson('/api/espn?p=scoreboard/col.1')).status, 502);

    fake.espnCaida = false;
    t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
    const buena = await getJson('/api/espn?p=scoreboard/col.1');
    t.mock.timers.tick(21000); // vence la caché de 20 s del marcador
    fake.espnCaida = true;
    const respaldo = await getJson('/api/espn?p=scoreboard/col.1');
    assert.equal(respaldo.status, 200);
    assert.deepEqual(respaldo.body, buena.body);
  });
});
