'use strict';
// Doble de prueba (fake) de los servicios externos: los 16 RSS y la API de ESPN.
// Reemplaza globalThis.fetch para que las pruebas no dependan de la red.
const { FEEDS } = require('../../feeds.js');

const T0 = Date.parse('2026-11-01T12:00:00Z'); // fecha fija: datos deterministas

// Cada fuente publica 2 noticias propias + 1 titular repetido en todas (para probar la deduplicación)
function rssDe(feed, i) {
  const item = (title, slug, minutos) => `<item><title>${title}</title><link>https://diario.test/${feed.id}/futbol/${slug}</link>` +
    `<description>Resumen de ${feed.name}</description><pubDate>${new Date(T0 - minutos * 60000).toUTCString()}</pubDate></item>`;
  return `<?xml version="1.0" encoding="utf-8"?><rss><channel>` +
    item(`Noticia A de ${feed.id}`, 'a', i * 2) +
    item(`Noticia B de ${feed.id}`, 'b', i * 2 + 1) +
    item('Millonarios gana el clásico capitalino', 'clasico', 500 + i) +
    `</channel></rss>`;
}

function instalar(opciones = {}) {
  const original = globalThis.fetch;
  const estado = {
    llamadas: [],                         // URLs pedidas al exterior (espía)
    caidas: new Set(opciones.caidas || []),// ids de feeds que responden 503
    espnCaida: false,
    restaurar() { globalThis.fetch = original; },
    reiniciar() { this.llamadas.length = 0; this.caidas.clear(); this.espnCaida = false; }
  };
  globalThis.fetch = async (url) => {
    url = String(url);
    // Las peticiones de la propia prueba hacia el servidor local sí van a la red real
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) return original(url);
    estado.llamadas.push(url);
    if (url.startsWith('https://site.api.espn.com/')) {
      if (estado.espnCaida) return new Response('caído', { status: 503 });
      return Response.json({ fuente: 'espn-falso', url });
    }
    const i = FEEDS.findIndex(f => f.url === url);
    if (i === -1) return new Response('no encontrado', { status: 404 });
    if (estado.caidas.has(FEEDS[i].id)) return new Response('caído', { status: 503 });
    return new Response(rssDe(FEEDS[i], i), { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
  };
  return estado;
}

module.exports = { instalar, T0 };
