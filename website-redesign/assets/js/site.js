/* GRANDE Roleplay — site interactions (no dependencies) */
(function () {
  'use strict';
  var CONNECT_CODE = 'qqqepoz';
  var DISCORD_INVITE = 'granderoleplay';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  /* ---------- toast ---------- */
  var toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }
  function copy(text, okMsg) {
    var done = function () { toast(okMsg || 'Kopiert'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { fallback(); }); return; }
    } catch (e) { /* fall through */ }
    fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast(text); }
      ta.remove();
    }
  }
  $$('[data-copy]').forEach(function (el) {
    el.addEventListener('click', function () { copy(el.getAttribute('data-copy'), el.getAttribute('data-copy-msg') || 'Kopiert'); });
  });

  /* ---------- header + mobile menu + action bar ---------- */
  var nav = $('.nav'), bar = $('.action-bar');
  if (bar) document.body.classList.add('has-bar');
  function onScroll() {
    var y = window.scrollY || 0;
    if (nav) nav.classList.toggle('scrolled', y > 40);
    if (bar) bar.classList.toggle('show', y > window.innerHeight * 0.6);
  }
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  var menu = $('.mobile-menu');
  $$('[data-menu]').forEach(function (b) {
    b.addEventListener('click', function () {
      var open = !menu.classList.contains('open');
      menu.classList.toggle('open', open); document.body.style.overflow = open ? 'hidden' : '';
      $$('[data-menu]').forEach(function (x) { x.setAttribute('aria-expanded', String(open)); });
    });
  });
  if (menu) $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { menu.classList.remove('open'); document.body.style.overflow = ''; }); });

  /* ---------- hero video: only play when visible / not reduced motion ---------- */
  var hv = $('.hero-media video');
  if (hv && hv.dataset.srcLarge) {
    // phones get the lighter 720p loop; the video starts after the page itself has loaded
    hv.src = innerWidth < 900 ? hv.dataset.srcSmall : hv.dataset.srcLarge;
  }
  if (hv) {
    if (reduce) { hv.removeAttribute('autoplay'); hv.pause(); }
    else {
      var p = hv.play(); if (p && p.catch) p.catch(function () {});
      if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { e[0].isIntersecting ? hv.play().catch(function () {}) : hv.pause(); }).observe(hv);
    }
  }
  var fv = $('.finale video');
  if (fv && 'IntersectionObserver' in window && !reduce) new IntersectionObserver(function (e) { e[0].isIntersecting ? fv.play().catch(function () {}) : fv.pause(); }, { threshold: .4 }).observe(fv);

  /* ---------- reveals (content stays readable; motion only below the fold) ---------- */
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.remove('pending'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(function (el, i) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('pending'); el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); }
    });
  }

  /* ---------- pointer spotlight on tiles ---------- */
  $$('.tile').forEach(function (t) {
    t.addEventListener('pointermove', function (e) {
      var r = t.getBoundingClientRect();
      t.style.setProperty('--mx', (e.clientX - r.left) + 'px'); t.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---------- parallax quote band ---------- */
  var qbg = $('.quote-band .bg');
  if (qbg && !reduce) {
    var tick = false;
    window.addEventListener('scroll', function () {
      if (tick) return; tick = true;
      requestAnimationFrame(function () {
        var r = qbg.parentNode.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) qbg.style.transform = 'translateY(' + ((r.top + r.height / 2 - innerHeight / 2) * -0.12).toFixed(1) + 'px)';
        tick = false;
      });
    }, { passive: true });
  }

  /* ---------- dossier tabs (Fraktionen & Jobs) ---------- */
  var dtabs = $$('.dossier-tab');
  dtabs.forEach(function (t) {
    t.addEventListener('click', function () {
      dtabs.forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); x.tabIndex = x === t ? 0 : -1; });
      $$('.dossier').forEach(function (d) { d.hidden = d.id !== t.getAttribute('aria-controls'); });
    });
    t.addEventListener('keydown', function (e) {
      var i = dtabs.indexOf(t), n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
      if (n === null) return; e.preventDefault(); var nt = dtabs[(n + dtabs.length) % dtabs.length]; nt.focus(); nt.click();
    });
  });

  /* ---------- server status (same sources as before: /api/players + /api/info, then FiveM list) ---------- */
  var cards = $$('[data-status]');
  if (cards.length) {
    var setAll = function (state, label, players, max) {
      cards.forEach(function (c) {
        c.setAttribute('data-state', state);
        $$('[data-st="label"]', c).forEach(function (e) { e.textContent = label; });
        $$('[data-st="players"]', c).forEach(function (e) { e.textContent = players; });
        $$('[data-st="max"]', c).forEach(function (e) { e.textContent = max; });
        var pct = (typeof players === 'number' && typeof max === 'number' && max > 0) ? Math.min(100, Math.max(2, Math.round(players / max * 100))) : 0;
        $$('[data-st="bar"]', c).forEach(function (e) { e.style.width = pct + '%'; });
        $$('[data-st="time"]', c).forEach(function (e) {
          e.textContent = state === 'unknown' ? label : 'Aktualisiert um ' + new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) + ' Uhr · automatisch jede Minute';
        });
      });
    };
    var get = function (u) {
      var c = ('AbortController' in window) ? new AbortController() : null;
      var t = setTimeout(function () { if (c) c.abort(); }, 8000);
      return fetch(u, { cache: 'no-store', signal: c ? c.signal : undefined }).then(function (r) { clearTimeout(t); if (!r.ok) throw 0; return r.json(); });
    };
    var direct = function () {
      return Promise.all([get('/api/players'), get('/api/info').catch(function () { return null; })]).then(function (a) {
        var pl = a[0], inf = a[1]; if (!Array.isArray(pl)) throw 0;
        var max = parseInt((inf && inf.vars && (inf.vars.sv_maxClients || inf.vars.sv_maxclients)) || 0, 10) || 48;
        setAll('online', 'Server online', pl.length, max);
      });
    };
    var urls = ['/api/status', 'https://servers-frontend.fivem.net/api/servers/single/' + CONNECT_CODE];
    var tryUrl = function (i) {
      if (i >= urls.length) {
        // Preview hosts (no /api proxy, blocked external requests) can't reach the server: say so instead of claiming "offline".
        if (location.hostname.indexOf('granderoleplay.ch') === -1) { setAll('unknown', 'Live-Status nur auf granderoleplay.ch', '–', '–'); return; }
        setAll('offline', 'Server offline', 0, '–'); return;
      }
      get(urls[i]).then(function (j) {
        var d = j && (j.Data || j.data); if (!d) throw 0;
        var max = parseInt(d.sv_maxclients || d.svMaxclients || (d.vars && d.vars.sv_maxClients) || 0, 10) || '–';
        var cl = typeof d.clients === 'number' ? d.clients : (d.players ? d.players.length : 0);
        setAll('online', 'Server online', cl, max);
      }).catch(function () { tryUrl(i + 1); });
    };
    var load = function () { direct().catch(function () { tryUrl(0); }); };
    load(); setInterval(load, 60000);
  }

  /* ---------- Discord: live member counts from the public invite ---------- */
  var dc = $('[data-discord]');
  if (dc) {
    fetch('https://discord.com/api/v10/invites/' + DISCORD_INVITE + '?with_counts=true', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) {
        if (typeof j.approximate_member_count !== 'number') throw 0;
        var f = function (n) { return n.toLocaleString('de-CH'); };
        $('[data-dc="members"]', dc).textContent = f(j.approximate_member_count);
        $('[data-dc="online"]', dc).textContent = f(j.approximate_presence_count || 0);
        $('.d-stats', dc).hidden = false;
      })
      .catch(function () { /* keep stats hidden; button still works */ });
  }

  /* ---------- Regelwerk tools ---------- */
  var root = $('.rules');
  if (root) {
    var tabs = $$('.r-tab'), panels = $$('.r-panel');
    var box = $('.r-search input'), cnt = $('.r-count'), marks = [], cur = -1;
    var toc = $('.rw-toc');
    var show = function (k) {
      tabs.forEach(function (t) { t.classList.toggle('on', t.dataset.tab === k); t.setAttribute('aria-selected', String(t.dataset.tab === k)); });
      panels.forEach(function (p) { p.classList.toggle('on', p.dataset.panel === k); });
      buildToc();
    };
    // permalink buttons
    $$('.rule').forEach(function (d) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'r-link'; b.setAttribute('aria-label', 'Link zu diesem Abschnitt kopieren');
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); copy(location.href.split('#')[0] + '#' + d.id, 'Link kopiert'); });
      var chev = $('.r-chev', d); $('summary', d).insertBefore(b, chev);
    });
    function buildToc() {
      if (!toc) return;
      var p = $('.r-panel.on'); var items = $$('.rule', p);
      toc.innerHTML = '<div class="t-head">Inhalt</div>' + items.map(function (d) {
        var t = $('.r-title', d).textContent.trim(); var m = t.match(/^(§\s?\d+)\s*(.*)$/);
        return '<a href="#' + d.id + '" data-id="' + d.id + '"><b>' + (m ? m[1].replace(' ', '') : '✦') + '</b><span>' + (m ? m[2] : t) + '</span></a>';
      }).join('');
      $$('a', toc).forEach(function (a) {
        a.addEventListener('click', function (e) { e.preventDefault(); var d = document.getElementById(a.dataset.id); d.open = true; d.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); history.replaceState(null, '', '#' + a.dataset.id); });
      });
      spy();
    }
    function spy() {
      if (!toc) return; var p = $('.r-panel.on'); var items = $$('.rule', p); var act = items[0];
      items.forEach(function (d) { if (d.getBoundingClientRect().top < 240) act = d; });
      $$('a', toc).forEach(function (a) { a.classList.toggle('active', act && a.dataset.id === act.id); });
    }
    var prog = $('.rw-progress');
    window.addEventListener('scroll', function () {
      spy();
      if (prog) { var h = document.documentElement.scrollHeight - innerHeight; prog.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + '%'; }
    }, { passive: true });
    tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.tab); clear(); box.value = ''; cnt.textContent = ''; history.replaceState(null, '', '#' + t.dataset.tab); }); });
    var all = $('[data-expand]');
    if (all) all.addEventListener('click', function () {
      var p = $('.r-panel.on'); var ds = $$('details', p); var open = ds.some(function (d) { return !d.open; });
      ds.forEach(function (d) { d.open = open; }); all.textContent = open ? 'Alle schliessen' : 'Alle öffnen';
    });
    // search (same behaviour as before: highlights, Enter jumps to next hit)
    function clear() { marks.forEach(function (m) { var t = document.createTextNode(m.textContent); m.parentNode.replaceChild(t, m); t.parentNode.normalize(); }); marks = []; cur = -1; }
    function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function search() {
      clear(); var q = box.value.trim(); if (q.length < 2) { cnt.textContent = ''; return; }
      var re = new RegExp(esc(q), 'gi'); var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
      nodes.forEach(function (n) {
        if (n.parentNode.closest('button')) return;
        var v = n.nodeValue; if (!re.test(v)) return; re.lastIndex = 0; var f = document.createDocumentFragment(), last = 0, m;
        while ((m = re.exec(v))) { f.appendChild(document.createTextNode(v.slice(last, m.index))); var mk = document.createElement('mark'); mk.textContent = m[0]; f.appendChild(mk); marks.push(mk); last = m.index + m[0].length; }
        f.appendChild(document.createTextNode(v.slice(last))); n.parentNode.replaceChild(f, n);
      });
      cnt.textContent = marks.length ? marks.length + ' Treffer' : 'Keine Treffer';
      if (marks.length) go(0);
    }
    function go(i) {
      if (!marks.length) return; cur = (i + marks.length) % marks.length; marks.forEach(function (m) { m.classList.remove('cur'); });
      var m = marks[cur]; m.classList.add('cur'); var d = m.closest('details'); if (d) { d.open = true; var pn = d.closest('.r-panel'); if (!pn.classList.contains('on')) show(pn.dataset.panel); }
      cnt.textContent = (cur + 1) + ' / ' + marks.length;
      setTimeout(function () { m.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); }, 30);
    }
    var tmr; box.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(search, 200); });
    box.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (marks.length) go(cur + 1); else search(); } });
    // deep links: #regelwerk / #streaming / #fraktionen or a rule id (on load and on in-page hash changes)
    function route() {
      var h = location.hash.slice(1);
      if (h && tabs.some(function (t) { return t.dataset.tab === h; })) { show(h); return; }
      var el = h && document.getElementById(h);
      if (el && el.tagName === 'DETAILS') { show(el.closest('.r-panel').dataset.panel); el.open = true; setTimeout(function () { el.scrollIntoView({ block: 'start' }); }, 60); return; }
      buildToc();
    }
    window.addEventListener('hashchange', route);
    route();
  }
})();
