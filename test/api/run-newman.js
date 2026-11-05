'use strict';
// Ejecutor de las pruebas de API: levanta Noti-Trol con los servicios externos
// reemplazados por un doble (sin red), corre la colección de Postman con Newman
// y termina con código 0 (todo aprobado) o 1 (alguna falla). Uso: node test/api/run-newman.js
const path = require('node:path');
const newman = require('newman');
const upstream = require('../helpers/fake-upstream.js');
const { createServer } = require('../../server.js');

const fake = upstream.instalar();
const srv = createServer();

srv.listen(0, '127.0.0.1', () => {
  const baseUrl = `http://127.0.0.1:${srv.address().port}`;
  newman.run({
    collection: require(path.join(__dirname, 'noti-trol.postman_collection.json')),
    envVar: [{ key: 'baseUrl', value: baseUrl }],
    reporters: ['cli'],
    timeoutRequest: 5000
  }, (err, summary) => {
    srv.close();
    fake.restaurar();
    const fallas = err ? 1 : summary.run.failures.length;
    process.exitCode = fallas ? 1 : 0;
  });
});
