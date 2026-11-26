'use strict';
// Escaneo de secretos (ítem B4): busca credenciales en los archivos versionados y falla si encuentra alguna.
// shortcut: solo patrones conocidos y archivos actuales; usar gitleaks si el proyecto crece o hay que revisar todo el historial en el CI.
const path = require('node:path');
const fs = require('node:fs');

const PATRONES = [
  ['Clave de AWS', /AKIA[0-9A-Z]{16}/],
  ['Token de GitHub', /gh[pousr]_[A-Za-z0-9]{30,}/],
  ['Clave tipo sk-', /\bsk-[A-Za-z0-9]{20,}/],
  ['Llave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Asignación de credencial', /(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*['"][^'"\s]{6,}['"]/i]
];

function escanear(archivos, leer) {
  const hallazgos = [];
  for (const f of archivos) {
    const texto = leer(f);
    if (texto === null) continue;
    texto.split(/\r?\n/).forEach((linea, i) => {
      for (const [nombre, re] of PATRONES) if (re.test(linea)) hallazgos.push(`${f}:${i + 1} ${nombre}`);
    });
  }
  return hallazgos;
}

// recorre el proyecto con fs (sin lanzar git desde el PATH, regla S4036 de Sonar)
const IGNORAR = /^(node_modules|\.git|coverage)([\\/]|$)|^package-lock\.json$/;
function listarArchivos(raiz) {
  return fs.readdirSync(raiz, { recursive: true, withFileTypes: true })
    .filter(e => e.isFile())
    .map(e => path.relative(raiz, path.join(e.parentPath, e.name)))
    .filter(f => !IGNORAR.test(f));
}

function leerTexto(f) {
  const buf = fs.readFileSync(f);
  return buf.includes(0) ? null : buf.toString('utf8'); // omite binarios (docx, pdf, png)
}

if (require.main === module) {
  const archivos = listarArchivos('.');
  const hallazgos = escanear(archivos, leerTexto);
  console.log(`Escaneo de secretos: ${archivos.length} archivos, ${hallazgos.length} hallazgos`);
  hallazgos.forEach(h => console.log('  ' + h));
  process.exit(hallazgos.length ? 1 : 0);
}

module.exports = { escanear, listarArchivos, leerTexto, PATRONES };
