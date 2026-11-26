'use strict';
// Caja negra de parseSince: partición de equivalencia y valores límite (ítem C2)
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSince } = require('../server.js');

test('parseSince sin parámetro (null o vacío) devuelve 0', () => {
  // Arrange-Act-Assert en una línea: clase válida "ausente"
  assert.equal(parseSince(null), 0);
  assert.equal(parseSince(''), 0);
});

test('parseSince acepta enteros no negativos en sus límites', () => {
  assert.equal(parseSince('0'), 0);
  assert.equal(parseSince('1'), 1);
  assert.equal(parseSince('1732500000000'), 1732500000000);
  assert.equal(parseSince(String(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);
});

test('parseSince rechaza negativos, decimales, texto y valores fuera de rango', () => {
  for (const malo of ['-1', '1.5', 'abc', '12abc', ' 5', String(Number.MAX_SAFE_INTEGER + 2), '1e3']) {
    assert.equal(parseSince(malo), null, `debe rechazar ${JSON.stringify(malo)}`);
  }
});

// Caja blanca (ítem C3). Un caso por camino independiente del camino base.
// parseSince: decisiones null, '', regex, isSafeInteger => V(G) = 4 + 1 = 5
test('parseSince camino 4: dígitos que exceden el entero seguro devuelven null', () => {
  assert.equal(parseSince('99999999999999999999'), null);
});

// espnTarget: decisiones (p || ''), !m, ternario => V(G) = 3 + 1 = 4
const { espnTarget } = require('../server.js');

test('espnTarget camino 1: p ausente devuelve null', () => {
  assert.equal(espnTarget(null), null);
});

test('espnTarget camino 2: ruta fuera de la lista blanca devuelve null', () => {
  assert.equal(espnTarget('../../admin'), null);
  assert.equal(espnTarget('scoreboard/COL.1'), null);
});

test('espnTarget camino 3: scoreboard arma la URL de marcadores con TTL de 20 s', () => {
  assert.deepEqual(espnTarget('scoreboard/col.1'), { target: 'https://site.api.espn.com/apis/site/v2/sports/soccer/col.1/scoreboard', ttl: 20000 });
});

test('espnTarget camino 4: standings arma la URL de tablas con TTL de 5 min', () => {
  assert.deepEqual(espnTarget('standings/esp.1'), { target: 'https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings', ttl: 300000 });
});

// Escáner de secretos: detecta una credencial falsa y no marca código limpio
const { escanear } = require('../scripts/escanear-secretos.js');

test('escanear detecta una credencial asignada en el código', () => {
  const textos = { 'a.js': "const token = " + "'abc123XYZ987';", 'b.js': 'const PORT = 3000;' };
  assert.deepEqual(escanear(Object.keys(textos), f => textos[f]), ['a.js:1 Asignación de credencial']);
});

test('listarArchivos incluye el código y omite node_modules, .git y package-lock.json', () => {
  const { listarArchivos, leerTexto } = require('../scripts/escanear-secretos.js');
  const raiz = require('node:path').join(__dirname, '..');
  const archivos = listarArchivos(raiz);
  assert.ok(archivos.includes('server.js'));
  assert.ok(!archivos.some(f => /^(node_modules|\.git)[\\/]/.test(f) || f === 'package-lock.json'));
  assert.equal(leerTexto(require('node:path').join(raiz, 'docs', 'img', 'flujo-ci.png')), null, 'los binarios se omiten');
});
