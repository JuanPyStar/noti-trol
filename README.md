# Noti-Trol · fútbol en vivo

[![CI](https://github.com/JuanPyStar/noti-trol/actions/workflows/ci.yml/badge.svg)](https://github.com/JuanPyStar/noti-trol/actions/workflows/ci.yml)

Agregador de noticias deportivas que se actualiza solo, con el fútbol como protagonista.

**Desarrolladores:** Juan David Jauregui · Andres Mendez

## Cómo ejecutarlo

Requiere [Node.js](https://nodejs.org) 18 o superior (no hay que instalar dependencias).

```bash
node server.js
```

Luego abre **http://localhost:3000**. Para otro puerto: `PORT=8080 node server.js` (en Windows PowerShell: `$env:PORT=8080; node server.js`).

## Qué hace en vivo

| Qué | De dónde | Cada cuánto |
|---|---|---|
| Noticias | RSS de Marca, AS, AS Colombia, Mundo Deportivo, El Tiempo, El Colombiano, Semana, Infobae y Olé | 60 s |
| Marcadores | API pública de ESPN (Liga BetPlay, Champions, Libertadores, Sudamericana, LaLiga, Premier, Serie A, Bundesliga, Europa League, Ligue 1) | 30 s |
| Tabla Liga BetPlay | API pública de ESPN | 10 min |

- Las noticias nuevas aparecen con la marca **NUEVA** o con el botón rojo "▲ N noticias nuevas" si estás leyendo más abajo.
- Los goles, inicios y finales de partido quedan en el **Bloc en vivo**; con "🔔 Avisos de gol" también llegan como notificación del navegador.
- Cada noticia muestra titular, resumen corto e imagen del diario y enlaza al artículo original.

## Pruebas automatizadas

```bash
npm install   # solo la primera vez (instala Newman, dependencia de desarrollo)
npm run lint  # análisis estático (ESLint)
npm run test:ci  # pruebas con umbral de cobertura (85 % líneas, 80 % ramas y funciones)
npm test      # un solo comando: node:test (unitarias + integración, con cobertura) y Newman (API)
```

- `test/feeds.test.js` – unitarias del lector RSS, clasificador y merge (incluye pruebas parametrizadas).
- `test/server.test.js` – integración HTTP del servidor real (salud, estáticos, lista blanca de ESPN).
- `test/api-news.test.js` – integración de `/api/news` y `/api/espn` con *fixtures* y un doble de `fetch` (sin red).
- `test/api/noti-trol.postman_collection.json` + `test/api/run-newman.js` – pruebas de API con Postman/Newman.
- `test/helpers/fake-upstream.js` – doble de prueba de los 16 RSS y de ESPN.

## Archivos

- `server.js` – servidor Node sin dependencias: sirve la web y expone `/api/news` (une los RSS, quita duplicados, caché de 60 s).
- `feeds.js` – lista de diarios y lector RSS (lo usan el servidor y el navegador).
- `index.html`, `styles.css`, `app.js` – la web.
- `docs/` – documentos del proyecto (PDF).

Si se abre `index.html` sin el servidor (doble clic o hosting estático), la web intenta leer los RSS a través de proxies CORS públicos ("Modo directo"). Funciona, pero es menos fiable: lo recomendado es `node server.js`.
