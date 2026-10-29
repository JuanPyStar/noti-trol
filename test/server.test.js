'use strict';
// Pruebas de integración de server.js: levanta el servidor real en un puerto libre
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
let srv;

test.before(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/health'); return; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error('el servidor no arrancó');
});
test.after(() => srv.kill());

test('CP-I01 /api/health responde 200 con 16 fuentes', async () => {
  const r = await fetch(BASE + '/api/health');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).feeds, 16);
});

test('CP-I02 sirve index.html en / con tipo HTML', async () => {
  const r = await fetch(BASE + '/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

test('CP-I03 bloquea archivos sensibles (server.js, package.json)', async () => {
  assert.equal((await fetch(BASE + '/server.js')).status, 404);
  assert.equal((await fetch(BASE + '/package.json')).status, 404);
});

test('CP-I04 bloquea recorrido de directorios', async () => {
  assert.equal((await fetch(BASE + '/..%2f..%2fWindows%2fwin.ini')).status, 404);
});

test('CP-I05 /api/espn rechaza rutas fuera de la lista blanca', async () => {
  for (const p of ['', 'scoreboard/../x', 'teams/col.1', 'scoreboard/COL.1', 'standings/x.1']) {
    const r = await fetch(BASE + '/api/espn?p=' + encodeURIComponent(p));
    assert.equal(r.status, 400, p);
  }
});

test('CP-I06 archivo inexistente devuelve 404', async () => {
  assert.equal((await fetch(BASE + '/no-existe.css')).status, 404);
});
