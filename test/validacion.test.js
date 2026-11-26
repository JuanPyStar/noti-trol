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
