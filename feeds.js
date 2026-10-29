/* Noti-Trol · fuentes y lector RSS compartido (navegador + Node) */
(function (root) {
  'use strict';

  // Diarios deportivos reconocidos. sport: deporte por defecto (null = clasificar por contenido)
  // tags: etiquetas fijas de la fuente (colombia, espana, champions, internacional)
  const FEEDS = [
    { id: 'et-col',   name: 'El Tiempo',        url: 'https://www.eltiempo.com/rss/deportes_futbol-colombiano.xml', sport: 'futbol', tags: ['colombia'] },
    { id: 'as-col',   name: 'AS Colombia',      url: 'https://feeds.as.com/mrss-s/pages/as/site/colombia.as.com/section/futbol/portada/', sport: 'futbol', tags: ['colombia'] },
    { id: 'elcol',    name: 'El Colombiano',    url: 'https://www.elcolombiano.com/rss/deportes.xml', sport: null, tags: ['colombia'] },
    { id: 'semana',   name: 'Semana',           url: 'https://www.semana.com/arc/outboundfeeds/rss/category/deportes/', sport: null, tags: ['colombia'] },
    { id: 'marca-1a', name: 'Marca',            url: 'https://e00-marca.uecdn.es/rss/futbol/primera-division.xml', sport: 'futbol', tags: ['espana'] },
    { id: 'marca-ucl',name: 'Marca',            url: 'https://e00-marca.uecdn.es/rss/futbol/champions-league.xml', sport: 'futbol', tags: ['champions'] },
    { id: 'marca-int',name: 'Marca',            url: 'https://e00-marca.uecdn.es/rss/futbol/futbol-internacional.xml', sport: 'futbol', tags: ['internacional'] },
    { id: 'as-fut',   name: 'AS',               url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/portada/', sport: 'futbol', tags: [] },
    { id: 'md-fut',   name: 'Mundo Deportivo',  url: 'https://www.mundodeportivo.com/rss/futbol.xml', sport: 'futbol', tags: ['espana'] },
    { id: 'et-int',   name: 'El Tiempo',        url: 'https://www.eltiempo.com/rss/deportes_futbol-internacional.xml', sport: 'futbol', tags: ['internacional'] },
    { id: 'ole',      name: 'Olé',              url: 'https://www.ole.com.ar/rss/ultimas-noticias/', sport: null, tags: ['internacional'] },
    { id: 'infobae',  name: 'Infobae',          url: 'https://www.infobae.com/arc/outboundfeeds/rss/category/deportes/', sport: null, tags: [] },
    { id: 'marca-nba',name: 'Marca',            url: 'https://e00-marca.uecdn.es/rss/baloncesto.xml', sport: 'baloncesto', tags: [] },
    { id: 'marca-ten',name: 'Marca',            url: 'https://e00-marca.uecdn.es/rss/tenis.xml', sport: 'tenis', tags: [] },
    { id: 'marca-cic',name: 'Marca',            url: 'https://e00-marca.uecdn.es/rss/ciclismo.xml', sport: 'ciclismo', tags: [] },
    { id: 'marca-f1', name: 'Marca',            url: 'https://e00-marca.uecdn.es/rss/motor/formula1.xml', sport: 'f1', tags: [] }
  ];

  const PER_FEED = 25;

  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', iexcl: '¡', iquest: '¿', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', hellip: '…', ndash: '–', mdash: '—', ordm: 'º', ordf: 'ª', deg: '°' };
  function decode(s) {
    if (!s) return '';
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isFinite(n) ? String.fromCodePoint(n) : m; }
      return ENT[e] !== undefined ? ENT[e] : m;
    });
  }
  function cdata(s) { return (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'); }
  function stripHtml(s) {
    // algunas fuentes escapan el HTML dos veces
    let t = decode(cdata(s));
    t = cdata(t).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
    return decode(t).replace(/\s+/g, ' ').trim();
  }
  function tag(block, name) {
    const re = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i');
    const m = block.match(re); return m ? m[1] : '';
  }
  function tagsAll(block, name) {
    const re = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'gi');
    const out = []; let m; while ((m = re.exec(block))) out.push(stripHtml(m[1])); return out;
  }
  function attr(t, a) { const m = t.match(new RegExp('\\s' + a + '\\s*=\\s*"([^"]*)"', 'i')) || t.match(new RegExp('\\s' + a + "\\s*=\\s*'([^']*)'", 'i')); return m ? decode(m[1]) : ''; }

  function findImage(block) {
    const cands = [];
    const re = /<(media:content|media:thumbnail|enclosure)\b[^>]*>/gi; let m;
    while ((m = re.exec(block))) {
      const t = m[0], url = attr(t, 'url'); if (!url) continue;
      const type = attr(t, 'type'), medium = attr(t, 'medium');
      const isImg = medium === 'image' || /^image/i.test(type) || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
      if (!isImg) continue;
      const w = parseInt(attr(t, 'width'), 10) || (m[1].toLowerCase() === 'media:thumbnail' ? 300 : 800);
      cands.push({ url, w });
    }
    if (!cands.length) {
      const raw = decode(cdata(block));
      const im = raw.match(/<img[^>]+src="(https?:[^"]+\.(?:jpe?g|png|webp)[^"]*)"/i);
      if (im) cands.push({ url: im[1], w: 600 });
    }
    cands.sort((a, b) => b.w - a.w);
    const best = cands[0] && cands[0].url;
    return best ? best.replace(/^http:\/\//, 'https://') : '';
  }

  const KW = {
    ciclismo: /ciclis|\btour\b|giro de italia|vuelta a (españa|colombia)|clásico rcn|etapa|pelot[óo]n|egan|pogacar|vingegaard/i,
    tenis: /tenis|\batp\b|\bwta\b|wimbledon|roland garros|us open|alcaraz|sinner|djokovic|nadal|osorio/i,
    baloncesto: /baloncesto|basket|\bnba\b|euroliga|acb\b|lakers|celtics|lebron/i,
    f1: /f[óo]rmula 1|formula-1|\bf1\b|gran premio|verstappen|hamilton|alonso|leclerc|norris|automovilismo|motogp/i,
    futbol: /f[úu]tbol|futbol|gol(es|eador)?\b|liga|champions|libertadores|sudamericana|selecci[óo]n|mundial|penal|delantero|arquero|portero|entrenador|dt\b|tri?unfo|partidos?|club|copa|boca|river|vasco|benfica|millonarios|nacional|am[ée]rica de cali|junior|santa fe|real madrid|barcelona|atl[ée]tico|premier|bundesliga|serie a|mbapp|messi|james rodr[íi]guez|luis d[íi]az/i
  };
  const COL = /colombia|betplay|dimayor|millonarios|atl[ée]tico nacional|am[ée]rica de cali|deportivo cali|junior|santa fe|medell[íi]n|once caldas|tolima|pereira|bucaramanga|c[úu]cuta|llaneros|pasto|envigado|equidad|fortaleza|chic[óo]|uni[óo]n magdalena|boyac[áa]|alianza fc|james rodr[íi]guez|luis d[íi]az|lorenzo|nestor lorenzo/i;
  const UCL = /champions|libertadores|sudamericana|europa league|conference league/i;

  function classify(feed, it) {
    const hay = (it.link + ' ' + it.title + ' ' + it.categories.join(' ') + ' ' + it.summary.slice(0, 200));
    let sport = feed.sport;
    if (!sport) {
      const path = it.link.toLowerCase();
      if (/\/ciclismo\//.test(path)) sport = 'ciclismo';
      else if (/\/tenis\//.test(path)) sport = 'tenis';
      else if (/\/(baloncesto|basquet|nba)\//.test(path)) sport = 'baloncesto';
      else if (/\/(formula-1|f1|automovilismo|motor)\//.test(path)) sport = 'f1';
      else if (/\/(futbol|futbol-colombiano|futbol-internacional|seleccion-colombia|champions|liga)/.test(path)) sport = 'futbol';
      else {
        const head = it.title + ' ' + it.categories.join(' ');
        sport = ['ciclismo', 'tenis', 'baloncesto', 'f1', 'futbol'].find(k => KW[k].test(head)) ||
                ['futbol', 'ciclismo', 'tenis', 'baloncesto', 'f1'].find(k => KW[k].test(hay)) || 'otros';
      }
    }
    const tags = new Set(feed.tags);
    if (sport === 'futbol') {
      if (UCL.test(hay)) tags.add('champions');
      if (COL.test(it.title + ' ' + it.categories.join(' '))) tags.add('colombia');
    }
    if (sport !== 'futbol') { tags.delete('champions'); tags.delete('espana'); }
    return { sport, tags: [...tags] };
  }

  function parseDate(s) {
    if (!s) return 0;
    let t = Date.parse(s.trim());
    if (isNaN(t)) t = Date.parse(s.trim().replace(/\s(EST|EDT)$/, m => (m.trim() === 'EST' ? ' -0500' : ' -0400')));
    return isNaN(t) ? 0 : t;
  }

  function parseFeed(xml, feed) {
    const items = [];
    const re = /<item[\s>][\s\S]*?<\/item>/gi; let m;
    while ((m = re.exec(xml)) && items.length < PER_FEED) {
      const b = m[0];
      const title = stripHtml(tag(b, 'title'));
      let link = stripHtml(tag(b, 'link'));
      if (!link) { const g = stripHtml(tag(b, 'guid')); if (/^https?:/.test(g)) link = g; }
      if (!title || !link) continue;
      let summary = stripHtml(tag(b, 'description'));
      if (!summary) summary = stripHtml(tag(b, 'dcterms:alternative')) || stripHtml(tag(b, 'media:description'));
      if (!summary) summary = stripHtml(tag(b, 'content:encoded')).slice(0, 260);
      summary = summary.replace(/\s*Leer( más)?\s*$/i, '').slice(0, 280);
      const date = parseDate(tag(b, 'pubDate') || tag(b, 'dc:date') || tag(b, 'dcterms:modified'));
      const categories = tagsAll(b, 'category').filter(Boolean).slice(0, 6);
      const author = stripHtml(tag(b, 'dc:creator'));
      const it = { id: '', title, link: link.replace(/^http:\/\//, 'https://'), summary, date, image: findImage(b), source: feed.name, feed: feed.id, author: /^www\./.test(author) ? '' : author, categories };
      Object.assign(it, classify(feed, it));
      it.id = hash(it.link);
      items.push(it);
    }
    return items;
  }

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function norm(t) { return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 70); }

  // une, quita duplicados (mismo enlace o mismo titular) y ordena por fecha
  function merge(lists) {
    const seen = new Set(), out = [];
    const all = [].concat(...lists).sort((a, b) => b.date - a.date);
    for (const it of all) {
      const k1 = it.link, k2 = norm(it.title);
      if (seen.has(k1) || seen.has(k2)) continue;
      seen.add(k1); seen.add(k2); out.push(it);
    }
    const now = Date.now() + 10 * 60 * 1000; // ignora fechas en el futuro
    return out.map(i => (i.date > now ? Object.assign(i, { date: Date.now() }) : i));
  }

  const api = { FEEDS, parseFeed, merge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NTFeeds = api;
})(typeof self !== 'undefined' ? self : this);
