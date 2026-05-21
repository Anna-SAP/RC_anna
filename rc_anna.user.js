// ==UserScript==
// @name         RC Anna Toolkit
// @namespace    https://github.com/Anna-SAP/RC_anna
// @version      0.1.0
// @description  Extensible userscript toolkit for RingCentral web app. Currently includes: Bookmark Search.
// @author       Anna
// @match        https://app.ringcentral.com/*
// @run-at       document-idle
// @grant        none
// @homepageURL  https://github.com/Anna-SAP/RC_anna
// @supportURL   https://github.com/Anna-SAP/RC_anna/issues
// @updateURL    https://raw.githubusercontent.com/Anna-SAP/RC_anna/main/rc_anna.user.js
// @downloadURL  https://raw.githubusercontent.com/Anna-SAP/RC_anna/main/rc_anna.user.js
// ==/UserScript==

/* eslint-disable no-undef */
(function () {
  'use strict';

  // =====================================================================
  // RCX core: a tiny extensible framework
  // ---------------------------------------------------------------------
  // Register a feature like:
  //   RCX.register({
  //     id: 'bookmark-search',
  //     name: 'Bookmark Search',
  //     match: (url) => url.includes('/messages/bookmarks'),
  //     init: (ctx) => { ctx.panel ... ctx.onDestroy(...) }
  //   });
  // Each feature gets its own tab in the floating panel and is
  // mounted/unmounted automatically as the URL changes.
  // =====================================================================

  const RCX = (window.__RCX = window.__RCX || {
    features: [],
    log: (...a) => console.log('[RCX]', ...a),
    register(feat) {
      if (!feat || !feat.id || !feat.init) return;
      if (this.features.find(f => f.id === feat.id)) return;
      this.features.push(feat);
      Shell.refresh();
    },
  });

  // ---------- floating shell (tabs container) ----------
  const Shell = (function () {
    let host, tabsEl, bodyEl, statusEl;
    const mounted = new Map(); // featureId -> {root, ctx, destroyers:[]}
    let activeId = null;

    function ensureHost() {
      if (host) return;
      host = document.createElement('div');
      host.id = 'rcx-shell';
      host.innerHTML = `
        <style>
          #rcx-shell{position:fixed;top:70px;right:20px;width:380px;max-height:75vh;
            background:#fff;border:1px solid #d0d4d9;border-radius:8px;
            box-shadow:0 4px 16px rgba(0,0,0,.15);z-index:2147483000;
            font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;
            display:flex;flex-direction:column;color:#222}
          #rcx-shell header{display:flex;align-items:center;gap:6px;padding:6px 8px;
            border-bottom:1px solid #eee;background:#fafbfc;border-radius:8px 8px 0 0;cursor:move}
          #rcx-shell header strong{flex:1;font-size:12px;color:#555;letter-spacing:.3px}
          #rcx-shell header button{cursor:pointer;border:1px solid #c8ccd1;background:#fff;
            border-radius:4px;padding:2px 6px;font-size:11px}
          #rcx-tabs{display:flex;flex-wrap:wrap;gap:2px;padding:4px 6px;border-bottom:1px solid #eee;background:#f5f7fa}
          .rcx-tab{cursor:pointer;border:1px solid transparent;background:transparent;
            border-radius:4px;padding:3px 8px;font-size:12px;color:#444}
          .rcx-tab:hover{background:#e8ecf1}
          .rcx-tab.active{background:#fff;border-color:#d0d4d9;color:#0b66c2;font-weight:600}
          .rcx-tab.disabled{color:#aaa;cursor:not-allowed}
          #rcx-body{flex:1;overflow:auto;padding:8px}
          #rcx-status{padding:4px 8px;border-top:1px solid #eee;color:#888;font-size:11px;background:#fafbfc;
            border-radius:0 0 8px 8px}
          #rcx-shell.collapsed #rcx-tabs,
          #rcx-shell.collapsed #rcx-body,
          #rcx-shell.collapsed #rcx-status{display:none}
          .rcx-section{display:flex;flex-direction:column;gap:6px}
          .rcx-input{width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #d0d4d9;
            border-radius:4px;font-size:13px}
          .rcx-btn{cursor:pointer;border:1px solid #c8ccd1;background:#f5f7fa;
            border-radius:4px;padding:4px 10px;font-size:12px}
          .rcx-btn:hover{background:#e8ecf1}
          .rcx-row{display:flex;gap:6px;align-items:center}
          .rcx-list{display:flex;flex-direction:column;gap:2px}
          .rcx-item{padding:6px 8px;border-radius:4px;cursor:pointer;border:1px solid transparent}
          .rcx-item:hover{background:#f0f4fa;border-color:#dde4ef}
          .rcx-item mark{background:#fff2a8;padding:0 1px}
          .rcx-muted{color:#888;font-size:12px}
        </style>
        <header id="rcx-head">
          <strong>RC Anna Toolkit</strong>
          <button id="rcx-toggle" title="折叠/展开">_</button>
        </header>
        <div id="rcx-tabs"></div>
        <div id="rcx-body"></div>
        <div id="rcx-status">loaded</div>
      `;
      document.body.appendChild(host);
      tabsEl = host.querySelector('#rcx-tabs');
      bodyEl = host.querySelector('#rcx-body');
      statusEl = host.querySelector('#rcx-status');
      host.querySelector('#rcx-toggle').onclick = () => host.classList.toggle('collapsed');
      enableDrag(host.querySelector('#rcx-head'), host);
    }

    function enableDrag(handle, target) {
      let sx, sy, ox, oy, dragging = false;
      handle.addEventListener('mousedown', e => {
        if (e.target.tagName === 'BUTTON') return;
        dragging = true;
        sx = e.clientX; sy = e.clientY;
        const r = target.getBoundingClientRect();
        ox = r.left; oy = r.top;
        e.preventDefault();
      });
      document.addEventListener('mousemove', e => {
        if (!dragging) return;
        target.style.left = (ox + e.clientX - sx) + 'px';
        target.style.top = (oy + e.clientY - sy) + 'px';
        target.style.right = 'auto';
      });
      document.addEventListener('mouseup', () => dragging = false);
    }

    function setStatus(s, featId) {
      if (!statusEl) return;
      if (featId && featId !== activeId) return;
      statusEl.textContent = s == null ? '' : String(s);
    }

    function buildCtx(feat) {
      const root = document.createElement('div');
      root.className = 'rcx-section';
      const destroyers = [];
      const ctx = {
        id: feat.id,
        panel: root,
        setStatus: (s) => setStatus(s, feat.id),
        onDestroy: (fn) => destroyers.push(fn),
        h: (tag, props = {}, ...children) => {
          const el = document.createElement(tag);
          Object.entries(props).forEach(([k, v]) => {
            if (k === 'class') el.className = v;
            else if (k === 'style') el.setAttribute('style', v);
            else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
            else if (v !== false && v != null) el.setAttribute(k, v);
          });
          children.flat().forEach(c => {
            if (c == null || c === false) return;
            el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
          });
          return el;
        },
      };
      return { root, ctx, destroyers };
    }

    function mount(feat) {
      if (mounted.has(feat.id)) return;
      const { root, ctx, destroyers } = buildCtx(feat);
      mounted.set(feat.id, { root, ctx, destroyers });
      try { feat.init(ctx); } catch (e) { console.error('[RCX] init error', feat.id, e); }
    }

    function unmount(featId) {
      const m = mounted.get(featId);
      if (!m) return;
      m.destroyers.forEach(fn => { try { fn(); } catch (_) {} });
      mounted.delete(featId);
    }

    function activate(featId) {
      ensureHost();
      activeId = featId;
      bodyEl.innerHTML = '';
      if (!featId) {
        bodyEl.appendChild(document.createTextNode(''));
        const tip = document.createElement('div');
        tip.className = 'rcx-muted';
        tip.textContent = '当前页面没有可用的工具';
        bodyEl.appendChild(tip);
      } else {
        const m = mounted.get(featId);
        if (m) bodyEl.appendChild(m.root);
      }
      tabsEl.querySelectorAll('.rcx-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.id === featId);
      });
    }

    function refresh() {
      ensureHost();
      const url = location.href;
      const available = RCX.features.filter(f => !f.match || f.match(url));

      // unmount features no longer applicable
      Array.from(mounted.keys()).forEach(id => {
        if (!available.find(f => f.id === id)) unmount(id);
      });
      // mount newly applicable features
      available.forEach(f => mount(f));

      // rebuild tab bar
      tabsEl.innerHTML = '';
      RCX.features.forEach(f => {
        const ok = available.includes(f);
        const t = document.createElement('div');
        t.className = 'rcx-tab' + (ok ? '' : ' disabled');
        t.dataset.id = f.id;
        t.textContent = f.name || f.id;
        if (ok) t.onclick = () => activate(f.id);
        tabsEl.appendChild(t);
      });

      const stillActive = available.find(f => f.id === activeId);
      activate(stillActive ? activeId : (available[0] ? available[0].id : null));
    }

    // Watch for SPA route changes
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        refresh();
      }
    }, 800);

    return { refresh, setStatus };
  })();

  // =====================================================================
  // Feature: Bookmark Search
  // =====================================================================
  RCX.register({
    id: 'bookmark-search',
    name: 'Bookmark Search',
    match: (url) => url.includes('/messages/bookmarks'),
    init(ctx) {
      const { h } = ctx;
      let cache = [];
      let listbox = null;
      let scrollEl = null;

      const input = h('input', { class: 'rcx-input', placeholder: '输入关键词搜索 (先点 Scan)' });
      const scanBtn = h('button', { class: 'rcx-btn' }, '⟳ Scan');
      const clearBtn = h('button', { class: 'rcx-btn' }, 'Clear');
      const info = h('div', { class: 'rcx-muted' }, '未扫描');
      const list = h('div', { class: 'rcx-list' });

      ctx.panel.append(
        h('div', { class: 'rcx-row' }, scanBtn, clearBtn, info),
        input,
        list
      );

      function findListbox() {
        listbox = document.querySelector('[role="listbox"]');
        if (!listbox) return false;
        scrollEl = listbox.parentElement;
        return !!scrollEl;
      }
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const escapeReg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

      async function scanAll() {
        if (!findListbox()) { info.textContent = '未找到 bookmark 列表'; return; }
        info.textContent = '扫描中…';
        const seen = new Map();
        scrollEl.scrollTop = 0;
        await sleep(300);
        const step = Math.max(200, scrollEl.clientHeight - 100);
        let pos = 0, safety = 0;
        while (safety < 500) {
          scrollEl.scrollTop = pos;
          await sleep(120);
          const opts = listbox.querySelectorAll('[role="option"]');
          opts.forEach(o => {
            const top = o.offsetTop;
            if (!seen.has(top)) {
              const txt = (o.innerText || '').trim().replace(/\s+/g, ' ');
              if (txt) seen.set(top, { text: txt, offsetTop: top });
            }
          });
          const total = listbox.scrollHeight;
          info.textContent = `扫描中… ${seen.size} 条 (${Math.min(pos,total)}/${total}px)`;
          if (pos >= total) break;
          pos += step; safety++;
        }
        scrollEl.scrollTop = 0;
        cache = Array.from(seen.values()).sort((a, b) => a.offsetTop - b.offsetTop);
        info.textContent = `共 ${cache.length} 条`;
        render(input.value);
      }

      function render(q) {
        list.innerHTML = '';
        if (!cache.length) {
          list.appendChild(h('div', { class: 'rcx-muted' }, '请先点 Scan 扫描'));
          return;
        }
        q = (q || '').trim();
        let arr = cache;
        if (q) {
          const ql = q.toLowerCase();
          arr = cache.filter(c => c.text.toLowerCase().includes(ql));
        }
        info.textContent = `${arr.length} / ${cache.length} 条匹配`;
        const reg = q ? new RegExp(escapeReg(q), 'ig') : null;
        arr.slice(0, 200).forEach(item => {
          const snippet = item.text.length > 220 ? item.text.slice(0, 220) + '…' : item.text;
          const html = reg ? escapeHtml(snippet).replace(reg, m => `<mark>${m}</mark>`) : escapeHtml(snippet);
          const row = h('div', { class: 'rcx-item' });
          row.innerHTML = html;
          row.addEventListener('click', () => jumpTo(item));
          list.appendChild(row);
        });
        if (arr.length > 200) list.appendChild(h('div', { class: 'rcx-muted' }, '仅显示前 200 条，请细化关键词'));
      }

      async function jumpTo(item) {
        if (!findListbox()) return;
        scrollEl.scrollTop = Math.max(0, item.offsetTop - 80);
        await sleep(200);
        const opts = listbox.querySelectorAll('[role="option"]');
        let best = null, bestDiff = Infinity;
        opts.forEach(o => {
          const d = Math.abs(o.offsetTop - item.offsetTop);
          if (d < bestDiff) { bestDiff = d; best = o; }
        });
        if (best) {
          const oldBox = best.style.boxShadow;
          const oldBg = best.style.backgroundColor;
          best.style.transition = 'all .3s';
          best.style.boxShadow = '0 0 0 2px #ff9800 inset';
          best.style.backgroundColor = '#fff8e1';
          setTimeout(() => { best.style.boxShadow = oldBox; best.style.backgroundColor = oldBg; }, 2500);
        }
      }

      scanBtn.addEventListener('click', scanAll);
      clearBtn.addEventListener('click', () => { cache = []; input.value = ''; info.textContent = '已清空'; render(''); });

      let t;
      input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => render(input.value), 150); });

      render('');
    },
  });

  // =====================================================================
  // (Future features: just call RCX.register({...}) here or in another
  // script block. Each will appear as its own tab in the panel.)
  // =====================================================================

  // initial mount once DOM is ready
  const boot = setInterval(() => {
    if (document.body) {
      clearInterval(boot);
      // give SPA a moment
      setTimeout(() => Shell.refresh && Shell.refresh(), 500);
      // and refresh periodically in case features depend on late-loaded DOM
      setInterval(() => Shell.refresh && Shell.refresh(), 3000);
    }
  }, 200);
})();
