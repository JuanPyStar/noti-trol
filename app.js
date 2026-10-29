/* Noti-Trol · lógica en vivo */
(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const NEWS_EVERY = 60, SCORES_EVERY = 30, PAGE = 18;
  const SPORT = { futbol: { n: 'Fútbol', e: '⚽' }, baloncesto: { n: 'Baloncesto', e: '🏀' }, tenis: { n: 'Tenis', e: '🎾' }, ciclismo: { n: 'Ciclismo', e: '🚴' }, f1: { n: 'Fórmula 1', e: '🏁' }, otros: { n: 'Otros', e: '🏅' } };
  const TAGN = { colombia: 'Colombia', champions: 'Copas', espana: 'España', internacional: 'Mundo' };
  const LEAGUES = [
    { id: 'col.1', n: 'Liga BetPlay' }, { id: 'uefa.champions', n: 'Champions' }, { id: 'conmebol.libertadores', n: 'Libertadores' },
    { id: 'conmebol.sudamericana', n: 'Sudamericana' }, { id: 'esp.1', n: 'LaLiga' }, { id: 'eng.1', n: 'Premier' },
    { id: 'ita.1', n: 'Serie A' }, { id: 'ger.1', n: 'Bundesliga' }, { id: 'uefa.europa', n: 'Europa League' }, { id: 'fra.1', n: 'Ligue 1' }
  ];
  // ESPN: primero vía nuestro servidor (/api/espn); si no hay servidor, directo (ESPN permite CORS)
  async function espn(kind, league) {
    if (st.mode !== 'direct' && /^https?:/.test(location.protocol)) {
      try { const r = await fetch(`api/espn?p=${kind}/${league}`, { cache: 'no-store' }); if (r.ok) return await r.json(); } catch {}
    }
    const url = kind === 'scoreboard' ? `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard` : `https://site.api.espn.com/apis/v2/sports/soccer/${league}/standings`;
    const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  const PROXIES = [
    u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
    u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u)
  ];

  const st = { items: [], known: new Set(), pending: [], cat: 'futbol', src: '', q: '', shown: PAGE, updated: 0, sources: [], mode: '', loaded: false, matches: [], league: 'all', prev: new Map(), heroIds: new Set(), alerts: false, nextNews: 0 };

  /* ---------- utilidades ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto', style: 'short' });
  function ago(t) {
    if (!t) return '';
    const s = Math.round((t - Date.now()) / 1000), a = Math.abs(s);
    if (a < 45) return 'ahora';
    if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
    if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
    return rtf.format(Math.round(s / 86400), 'day');
  }
  const hhmm = t => new Date(t).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 4200); }
  function img(src, sport, cls) {
    const e = (SPORT[sport] || SPORT.otros).e;
    return src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-e="${e}"${cls ? ` class="${cls}"` : ''}>` : `<div class="ph-img">${e}</div>`;
  }
  // imagen rota → marcador de posición deportivo
  document.addEventListener('error', ev => {
    const el = ev.target;
    if (el.tagName === 'IMG' && el.dataset.e) { const d = document.createElement('div'); d.className = 'ph-img'; d.textContent = el.dataset.e; el.replaceWith(d); }
    else if (el.tagName === 'IMG' && el.dataset.logo !== undefined) { el.style.visibility = 'hidden'; }
  }, true);

  /* ---------- reloj y tema ---------- */
  const clock = () => { const d = new Date(); $('#clock').textContent = d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '') + ' · ' + hhmm(d); };
  clock(); setInterval(clock, 10000);
  $('#year').textContent = new Date().getFullYear();
  const root = document.documentElement, tb = $('#themeBtn');
  const paintTheme = () => (tb.innerHTML = root.dataset.theme === 'light' ? '🌙<span class="lbl"> Oscuro</span>' : '☀️<span class="lbl"> Claro</span>');
  paintTheme();
  tb.onclick = () => { root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light'; store.set('nt-theme', root.dataset.theme); paintTheme(); };

  /* ---------- avisos de gol (Notification API) ---------- */
  const ab = $('#btnAlerts');
  st.alerts = store.get('nt-alerts') === '1' && 'Notification' in window && Notification.permission === 'granted';
  const paintAlerts = () => ab.setAttribute('aria-pressed', String(st.alerts));
  paintAlerts();
  ab.onclick = async () => {
    if (st.alerts) { st.alerts = false; store.set('nt-alerts', '0'); paintAlerts(); return toast('Avisos de gol desactivados.'); }
    if (!('Notification' in window)) return toast('Tu navegador no admite notificaciones. Los goles igual salen en el Bloc en vivo.');
    const p = await Notification.requestPermission();
    st.alerts = p === 'granted'; store.set('nt-alerts', st.alerts ? '1' : '0'); paintAlerts();
    toast(st.alerts ? '🔔 Te avisaremos de cada gol en vivo.' : 'Permiso denegado: los goles seguirán apareciendo en el Bloc en vivo.');
  };
  function notify(title, body) { if (st.alerts) { try { new Notification(title, { body, tag: title + body }); } catch {} } }

  /* ---------- bloc en vivo ---------- */
  const evList = $('#events');
  function logEvent(icon, html, cls) {
    const ph = evList.querySelector('li.muted'); if (ph) ph.remove();
    const li = document.createElement('li'); if (cls) li.className = cls;
    li.innerHTML = `<span class="ic">${icon}</span><div>${html}<time>${hhmm(Date.now())}</time></div>`;
    evList.prepend(li);
    while (evList.children.length > 40) evList.lastElementChild.remove();
  }
  $('#blocClear').onclick = () => { evList.innerHTML = '<li class="muted">Bloc limpio. Seguimos atentos a goles y noticias nuevas.</li>'; };

  /* ======================= NOTICIAS ======================= */
  async function fetchServer() {
    if (!/^https?:/.test(location.protocol)) throw new Error('sin servidor');
    const r = await fetch('api/news', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json(); if (!d.items) throw new Error('respuesta inválida');
    return d;
  }
  let proxyIdx = 0;
  async function fetchViaProxy(url) {
    for (let k = 0; k < PROXIES.length; k++) {
      const i = (proxyIdx + k) % PROXIES.length;
      try {
        const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 10000);
        const r = await fetch(PROXIES[i](url), { signal: ctrl.signal }); clearTimeout(tm);
        if (!r.ok) continue;
        const txt = await r.text(); if (!/<item[\s>]/i.test(txt)) continue;
        proxyIdx = i; return txt;
      } catch {}
    }
    throw new Error('sin proxy disponible');
  }
  async function fetchDirect() {
    const { FEEDS, parseFeed, merge } = window.NTFeeds;
    const res = await Promise.all(FEEDS.map(async f => {
      try { const items = parseFeed(await fetchViaProxy(f.url), f); return { id: f.id, name: f.name, ok: true, count: items.length, items }; }
      catch (e) { return { id: f.id, name: f.name, ok: false, count: 0, items: [] }; }
    }));
    const items = merge(res.map(r => r.items));
    if (!items.length) throw new Error('ninguna fuente respondió');
    return { updated: Date.now(), sources: res.map(({ items, ...s }) => s), items };
  }

  let newsBusy = false;
  async function loadNews() {
    if (newsBusy) return; newsBusy = true;
    try {
      let d;
      if (st.mode !== 'direct') { try { d = await fetchServer(); st.mode = 'server'; } catch { st.mode = 'direct'; } }
      if (st.mode === 'direct') d = await fetchDirect();
      st.sources = d.sources || []; st.updated = d.updated || Date.now();
      ingest(d.items || []);
      renderSources();
    } catch (e) {
      $('#syncTxt').textContent = 'Sin conexión con las fuentes · reintentando';
      if (!st.loaded) { $('#grid').innerHTML = ''; $('#empty').hidden = false; $('#empty').textContent = 'No pudimos conectar con los diarios. Abre el sitio con "node server.js" o revisa tu conexión.'; }
    } finally { newsBusy = false; st.nextNews = Date.now() + NEWS_EVERY * 1000; }
  }

  function ingest(items) {
    if (!st.loaded) {
      st.items = items; items.forEach(i => st.known.add(i.id)); st.loaded = true;
      renderAll(); return;
    }
    const fresh = items.filter(i => !st.known.has(i.id));
    fresh.forEach(i => st.known.add(i.id));
    if (!fresh.length) { renderTicker(); renderTimes(); return; }
    fresh.slice(0, 4).forEach(i => logEvent(SPORT[i.sport] ? SPORT[i.sport].e : '📰', `<b>${esc(i.source)}</b> · <a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.title)}</a>`));
    st.pending = fresh.concat(st.pending);
    if (window.scrollY < 300) applyPending(); else showNewBtn();
  }
  function showNewBtn() {
    const n = st.pending.filter(matches).length;
    $('#newN').textContent = n; $('#newBtn').hidden = n === 0;
    if (!n && st.pending.length) applyPending(true);
  }
  function applyPending(silent) {
    const ids = new Set(st.pending.map(i => i.id));
    st.items = st.pending.concat(st.items).sort((a, b) => b.date - a.date).slice(0, 400);
    st.pending = []; $('#newBtn').hidden = true;
    renderAll(ids);
    if (!silent && ids.size) toast(`📰 ${ids.size} noticia${ids.size > 1 ? 's' : ''} nueva${ids.size > 1 ? 's' : ''} de los diarios`);
  }
  $('#newBtn').onclick = () => { applyPending(true); $('#feed').scrollIntoView({ behavior: 'smooth' }); };

  /* ---------- filtros ---------- */
  function matches(i) {
    if (st.src && i.source !== st.src) return false;
    if (st.cat === 'futbol' && i.sport !== 'futbol') return false;
    if (TAGN[st.cat] && (i.sport !== 'futbol' || !i.tags.includes(st.cat))) return false;
    if (st.q) { const h = norm(i.title + ' ' + i.summary + ' ' + i.source + ' ' + (i.categories || []).join(' ')); if (!st.q.split(/\s+/).every(w => h.includes(w))) return false; }
    return true;
  }
  function setCat(cat) {
    st.cat = cat; st.shown = PAGE;
    $$('#chips .chip').forEach(c => c.classList.toggle('active', c.dataset.cat === cat));
    $$('.nav a[data-cat]').forEach(a => a.classList.toggle('on', a.dataset.cat === cat));
    renderGrid();
  }
  $$('#chips .chip').forEach(c => (c.onclick = () => setCat(c.dataset.cat)));
  $$('.nav a[data-cat]').forEach(a => a.addEventListener('click', () => setCat(a.dataset.cat)));
  let qT; $('#q').addEventListener('input', e => { clearTimeout(qT); qT = setTimeout(() => { st.q = norm(e.target.value.trim()); st.shown = PAGE; renderGrid(); if (st.q) $('#feed').scrollIntoView({ behavior: 'smooth' }); }, 220); });
  $('#srcSel').onchange = e => { st.src = e.target.value; st.shown = PAGE; renderGrid(); };
  $('#moreBtn').onclick = () => { st.shown += PAGE; renderGrid(); };

  /* ---------- render noticias ---------- */
  const kick = (i, withTag) => `<span class="kick"><span class="src">${esc(i.source)}</span>${withTag && i.tags[0] && TAGN[i.tags[0]] ? `<span class="tag">${TAGN[i.tags[0]]}</span>` : ''}<span class="ago" data-t="${i.date}">${ago(i.date)}</span></span>`;
  function renderAll(freshIds) { renderHero(); renderGrid(freshIds); renderOthers(); renderTicker(); renderSourceSelect(); }

  function renderHero() {
    const pool = st.items.filter(i => i.sport === 'futbol' && i.image);
    const recent = pool.filter(i => Date.now() - i.date < 8 * 3600e3);
    const base = recent.length >= 5 ? recent : pool;
    // la principal prioriza fútbol colombiano o copas recientes; si no, la más nueva
    const lead = base.find(i => i.tags.includes('colombia')) || base[0];
    if (!lead) return;
    const side = []; const usedSrc = new Set([lead.source]);
    for (const i of base) { if (side.length >= 4) break; if (i === lead || (usedSrc.has(i.source) && base.length > 12 && side.length < 3)) continue; side.push(i); usedSrc.add(i.source); }
    for (const i of base) { if (side.length >= 4) break; if (i !== lead && !side.includes(i)) side.push(i); }
    st.heroIds = new Set([lead.id, ...side.map(i => i.id)]);
    $('#hero').innerHTML = `
      <a class="lead" href="${esc(lead.link)}" target="_blank" rel="noopener">${img(lead.image, lead.sport)}
        <div class="lead-body">${kick(lead, true)}<h1>${esc(lead.title)}</h1>${lead.summary ? `<p>${esc(lead.summary)}</p>` : ''}</div></a>
      <div class="hero-side">${side.map(i => `<a class="side" href="${esc(i.link)}" target="_blank" rel="noopener">${img(i.image, i.sport)}<div class="side-body">${kick(i)}<h3>${esc(i.title)}</h3></div></a>`).join('')}</div>`;
  }

  function renderGrid(freshIds) {
    const hideHero = st.cat === 'futbol' && !st.q && !st.src;
    const list = st.items.filter(i => matches(i) && !(hideHero && st.heroIds.has(i.id)));
    const view = list.slice(0, st.shown);
    $('#grid').innerHTML = view.map(i => `
      <a class="card${freshIds && freshIds.has(i.id) ? ' fresh' : ''}" href="${esc(i.link)}" target="_blank" rel="noopener">
        <div class="thumb">${img(i.image, i.sport)}${freshIds && freshIds.has(i.id) ? '<span class="kick"><span class="new-dot">NUEVA</span></span>' : ''}</div>
        <div class="card-b"><h3>${esc(i.title)}</h3>${i.summary ? `<p>${esc(i.summary)}</p>` : ''}
        <div class="card-meta"><span class="s">${esc(i.source)}${i.sport !== 'futbol' ? ' · ' + SPORT[i.sport].n : (i.tags[0] && TAGN[i.tags[0]] ? ' · ' + TAGN[i.tags[0]] : '')}</span><span class="ago" data-t="${i.date}">${ago(i.date)}</span></div></div>
      </a>`).join('');
    $('#empty').hidden = list.length > 0;
    if (!list.length) $('#empty').textContent = 'No hay noticias con ese filtro todavía. Prueba otra búsqueda.';
    $('#moreBtn').hidden = list.length <= st.shown;
    $('#resCount').textContent = `${list.length} noticias`;
  }

  function renderOthers() {
    const cols = ['baloncesto', 'tenis', 'ciclismo', 'f1'];
    $('#others').innerHTML = cols.map(s => {
      const l = st.items.filter(i => i.sport === s).slice(0, 4);
      return `<div class="ocol"><h3>${SPORT[s].e} ${SPORT[s].n}</h3>${l.length ? l.map(i => `<a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.title)}<small>${esc(i.source)} · <span class="ago" data-t="${i.date}">${ago(i.date)}</span></small></a>`).join('') : '<p class="muted">Sin novedades ahora.</p>'}</div>`;
    }).join('');
  }

  function renderTicker() {
    const l = st.items.filter(i => i.sport === 'futbol').slice(0, 14);
    if (!l.length) return;
    const html = l.map(i => `<a href="${esc(i.link)}" target="_blank" rel="noopener"><b>${hhmm(i.date)}</b>${esc(i.title)}<em>${esc(i.source)}</em></a>`).join('');
    const tr = $('#ticker'); tr.innerHTML = html + html; tr.style.setProperty('--dur', Math.max(60, l.length * 9) + 's');
  }

  function renderSourceSelect() {
    const sel = $('#srcSel'), names = [...new Set(st.items.map(i => i.source))].sort();
    const cur = st.src;
    sel.innerHTML = '<option value="">Todos los diarios</option>' + names.map(n => `<option${n === cur ? ' selected' : ''}>${esc(n)}</option>`).join('');
  }

  function renderSources() {
    const by = new Map();
    for (const s of st.sources) { const o = by.get(s.name) || { name: s.name, ok: false, count: 0 }; o.ok = o.ok || s.ok; o.count += s.count; by.set(s.name, o); }
    const arr = [...by.values()].sort((a, b) => b.count - a.count);
    $('#sources').innerHTML = arr.map(s => `<li class="${s.ok ? '' : 'err'}" title="${s.ok ? 'Conectado' : 'Sin respuesta en este momento'}"><i></i>${esc(s.name)}<small>${s.ok ? s.count : '—'}</small></li>`).join('');
    const ok = arr.filter(s => s.ok).length;
    $('#srcSummary').textContent = `${ok}/${arr.length} activas`;
  }

  function renderTimes() { $$('.ago[data-t]').forEach(e => (e.textContent = ago(+e.dataset.t))); }

  /* ---------- estado de sincronización ---------- */
  function tickSync() {
    const left = Math.max(0, Math.round((st.nextNews - Date.now()) / 1000));
    const pct = st.nextNews ? 1 - left / NEWS_EVERY : 0;
    $('#ringBar').style.strokeDashoffset = String(94.25 * (1 - pct));
    if (st.updated) {
      const ok = st.sources.filter(s => s.ok).length;
      $('#syncTxt').textContent = `${st.mode === 'direct' ? 'Modo directo · ' : ''}Noticias de ${ago(st.updated)} · ${ok}/${st.sources.length} fuentes · nueva carga en ${left}s`;
    }
  }
  setInterval(tickSync, 1000);
  setInterval(renderTimes, 30000);

  /* ======================= MARCADORES ======================= */
  function statusOf(e) {
    const t = e.status.type, c = e.competitions[0];
    if (t.state === 'in') return { k: 'live', txt: t.name === 'STATUS_HALFTIME' ? 'Descanso' : (e.status.displayClock || t.shortDetail || 'En vivo') };
    if (t.state === 'post') {
      if (/POSTPONED|CANCELED|SUSPENDED/.test(t.name)) return { k: 'fin', txt: 'Aplazado' };
      return { k: 'fin', txt: /PEN/.test(t.name) || /pen/i.test(t.shortDetail || '') ? 'Final (pen)' : 'Final' };
    }
    if (/POSTPONED|CANCELED/.test(t.name)) return { k: 'fin', txt: 'Aplazado' };
    const d = new Date(e.date), now = new Date(), tom = new Date(now.getTime() + 864e5);
    const same = (a, b) => a.toDateString() === b.toDateString();
    const day = same(d, now) ? 'Hoy' : same(d, tom) ? 'Mañana' : d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }).replace('.', '');
    return { k: 'pre', txt: `${day} ${hhmm(d)}` };
  }
  function mapEvent(e, lg) {
    const c = e.competitions[0];
    const side = h => c.competitors.find(x => x.homeAway === h) || c.competitors[h === 'home' ? 0 : 1];
    const tm = x => ({ name: x.team.shortDisplayName || x.team.displayName || x.team.abbreviation, logo: x.team.logo || (x.team.logos && x.team.logos[0] && x.team.logos[0].href) || '', score: x.score == null ? '' : String(x.score), winner: x.winner });
    return { id: e.id, league: lg.id, ln: lg.n, date: Date.parse(e.date), state: e.status.type.state, status: statusOf(e), home: tm(side('home')), away: tm(side('away')) };
  }
  async function loadScores() {
    const res = await Promise.all(LEAGUES.map(async lg => {
      try { const d = await espn('scoreboard', lg.id); return (d.events || []).map(e => mapEvent(e, lg)); }
      catch { return []; }
    }));
    const now = Date.now();
    let all = res.flat().filter(m => m.state === 'in' || (m.state === 'pre' && m.date - now < 4 * 864e5) || (m.state === 'post' && now - m.date < 40 * 3600e3));
    if (!all.length) all = res.flat().slice(0, 24);
    const rank = m => (m.state === 'in' ? 0 : m.state === 'pre' ? 1 : 2);
    all.sort((a, b) => rank(a) - rank(b) || (a.state === 'post' ? b.date - a.date : a.date - b.date));
    detectChanges(all);
    st.matches = all;
    renderScores();
  }
  function detectChanges(list) {
    const first = st.prev.size === 0;
    for (const m of list) {
      const key = `${m.state}|${m.home.score}-${m.away.score}`, old = st.prev.get(m.id);
      st.prev.set(m.id, key);
      if (first || !old) continue;
      const [ostate, osc] = old.split('|'); const [oh, oa] = osc.split('-').map(Number);
      const h = +m.home.score, a = +m.away.score, line = `${m.home.name} ${m.home.score}-${m.away.score} ${m.away.name}`;
      if (m.state === 'in' && (h > oh || a > oa)) {
        const who = h > oh ? m.home.name : m.away.name;
        logEvent('⚽', `<b>¡GOL de ${esc(who)}!</b> ${esc(line)} <span class="muted">· ${esc(m.status.txt)} · ${esc(m.ln)}</span>`, 'goal');
        toast(`⚽ ¡GOL de ${who}! ${line}`); notify(`⚽ ¡Gol de ${who}!`, `${line} · ${m.status.txt}`);
        m.flash = true;
      } else if (ostate === 'pre' && m.state === 'in') {
        logEvent('▶️', `<b>Arrancó</b> ${esc(m.home.name)} vs ${esc(m.away.name)} <span class="muted">· ${esc(m.ln)}</span>`);
      } else if (ostate === 'in' && m.state === 'post') {
        logEvent('🏁', `<b>Final:</b> ${esc(line)} <span class="muted">· ${esc(m.ln)}</span>`); notify('🏁 Final', line);
      }
    }
  }
  function renderScores() {
    const live = st.matches.filter(m => m.state === 'in').length;
    $('#liveCount').textContent = live; $('#livePill').classList.toggle('off', !live);
    // pestañas
    const lgs = LEAGUES.filter(l => st.matches.some(m => m.league === l.id));
    if (st.league !== 'all' && st.league !== 'live' && !lgs.some(l => l.id === st.league)) st.league = 'all';
    const tab = (id, n, cnt) => `<button class="tab${st.league === id ? ' active' : ''}" role="tab" aria-selected="${st.league === id}" data-l="${id}">${n}${cnt ? `<span class="n">${cnt}</span>` : ''}</button>`;
    $('#leagueTabs').innerHTML = tab('all', 'Todos') + (live ? tab('live', 'En vivo', live) : '') + lgs.map(l => tab(l.id, l.n, st.matches.filter(m => m.league === l.id && m.state === 'in').length)).join('');
    $$('#leagueTabs .tab').forEach(b => (b.onclick = () => { st.league = b.dataset.l; renderScores(); }));
    const view = st.matches.filter(m => st.league === 'all' || (st.league === 'live' ? m.state === 'in' : m.league === st.league));
    const row = (t, lose) => `<div class="team${lose ? ' lose' : ''}">${t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy" data-logo>` : '<span class="ph"></span>'}<span class="nm">${esc(t.name)}</span><span class="sc">${esc(t.score)}</span></div>`;
    $('#scoreRail').innerHTML = view.length ? view.map(m => {
      const hs = +m.home.score, as = +m.away.score, done = m.state === 'post';
      return `<a class="score ${m.state === 'in' ? 'is-live' : m.state}${m.flash ? ' goal' : ''}" href="https://www.espn.com.co/futbol/partido/_/juegoId/${esc(m.id)}" target="_blank" rel="noopener" aria-label="${esc(m.home.name)} ${esc(m.home.score)} ${esc(m.away.name)} ${esc(m.away.score)}, ${esc(m.status.txt)}">
        <div class="score-top"><span class="lg">${esc(m.ln)}</span><span class="st ${m.status.k}">${esc(m.status.txt)}</span></div>
        ${row(m.home, done && hs < as)}${row(m.away, done && as < hs)}</a>`;
    }).join('') : '<div class="score-empty">No hay partidos en esta liga por ahora.</div>';
    st.matches.forEach(m => (m.flash = false));
  }

  /* ---------- tabla Liga BetPlay ---------- */
  let tablaAll = false, tablaRows = [];
  async function loadTable() {
    try {
      const d = await espn('standings', 'col.1'); const g = (d.children && d.children[0]) || d;
      const stat = (e, n) => { const s = e.stats.find(x => x.name === n); return s ? s.displayValue : ''; };
      tablaRows = (g.standings.entries || []).map(e => ({ rank: +stat(e, 'rank') || 0, name: e.team.shortDisplayName || e.team.displayName, logo: e.team.logos && e.team.logos[0] ? e.team.logos[0].href : '', pj: stat(e, 'gamesPlayed'), dg: stat(e, 'pointDifferential'), pts: stat(e, 'points') })).sort((a, b) => a.rank - b.rank);
      $('#tablaStage').textContent = (g.name || 'Tabla') + (d.season && d.season.year ? ' ' + d.season.year : '');
      renderTable();
    } catch { $('#tablaBody').innerHTML = '<tr><td colspan="5" class="muted">Tabla no disponible en este momento.</td></tr>'; }
  }
  function renderTable() {
    const rows = tablaAll ? tablaRows : tablaRows.slice(0, 10);
    $('#tablaBody').innerHTML = rows.map(r => `<tr class="${r.rank <= 8 ? 'q' : ''}"><td>${r.rank}</td><td><span class="tm">${r.logo ? `<img src="${esc(r.logo)}" alt="" loading="lazy" data-logo>` : ''}${esc(r.name)}</span></td><td>${esc(r.pj)}</td><td>${esc(r.dg)}</td><td>${esc(r.pts)}</td></tr>`).join('');
    $('#tablaMore').textContent = tablaAll ? 'Ver solo top 10' : 'Ver tabla completa';
    $('#tablaMore').hidden = tablaRows.length <= 10;
  }
  $('#tablaMore').onclick = () => { tablaAll = !tablaAll; renderTable(); };

  /* ---------- volver arriba ---------- */
  const tt = $('#toTop');
  addEventListener('scroll', () => { tt.classList.toggle('show', scrollY > 800); if (scrollY < 300 && st.pending.length) applyPending(); }, { passive: true });
  tt.onclick = () => scrollTo({ top: 0, behavior: 'smooth' });

  /* ---------- arranque y ciclos en vivo ---------- */
  loadNews(); loadScores(); loadTable();
  setInterval(loadNews, NEWS_EVERY * 1000);
  setInterval(loadScores, SCORES_EVERY * 1000);
  setInterval(loadTable, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() > st.nextNews - 5000) { loadNews(); loadScores(); } });
})();
