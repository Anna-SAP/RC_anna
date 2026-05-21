// ==UserScript==
// @name         RC Anna Toolkit
// @namespace    https://github.com/Anna-SAP/RC_anna
// @version      0.1.1
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
          #rcx-tabs{display:flex;flex-wrap:wrap;gap:2px;padding:6px 10px;border-bottom:1px solid #eee;background:#f5f7fa}
          /* single-tab title style: not button-like */
          #rcx-tabs.single .rcx-tab{cursor:default;background:transparent;border:none;
            color:#0b66c2;font-weight:600;font-size:13px;padding:2px 0}
          #rcx-tabs.single .rcx-tab:hover{background:transparent}
          /* multi-tab button style */
          #rcx-tabs:not(.single) .rcx-tab{cursor:pointer;border:1px solid transparent;background:transparent;
            border-radius:4px;padding:3px 8px;font-size:12px;color:#444}
          #rcx-tabs:not(.single) .rcx-tab:hover{background:#e8ecf1}
          #rcx-tabs:not(.single) .rcx-tab.active{background:#fff;border-color:#d0d4d9;color:#0b66c2;font-weight:600}
          #rcx-tabs:not(.single) .rcx-tab.disabled{color:#aaa;cursor:not-allowed}
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
          .rcx-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
          .rcx-list{display:flex;flex-direction:column;gap:2px;max-height:50vh;overflow:auto}
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

      Array.from(mounted.keys()).forEach(id => {
        if (!available.find(f => f.id === id)) unmount(id);
      });
      available.forEach(f => mount(f));

      tabsEl.innerHTML = '';
      // single-tab vs multi-tab visual style
      tabsEl.classList.toggle('single', available.length === 1);
      RCX.features.forEach(f => {
        const ok = available.includes(f);
        if (!ok && available.length === 1) return; // hide disabled tabs in single mode
        const t = document.createElement('div');
        t.className = 'rcx-tab' + (ok ? '' : ' disabled');
        t.dataset.id = f.id;
        t.textContent = f.name || f.id;
        if (ok && available.length > 1) t.onclick = () => activate(f.id);
        tabsEl.appendChild(t);
      });

      const stillActive = available.find(f => f.id === activeId);
      activate(stillActive ? activeId : (available[0] ? available[0].id : null));
    }

    // Watch for SPA route changes ONLY (don't periodically rebuild — that
    // would kill focus on inputs).
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
  // ---------------------------------------------------------------------
  // RingCentral bookmark list specifics (as of 2026-05):
  //   * Multiple [role="listbox"] exist on the page (emoji pickers etc.)
  //   * The bookmark one is the listbox whose closest [aria-label] is
  //     "Bookmarks Page", and whose parent is the virtual-scroll container
  //     (parent.scrollHeight > parent.clientHeight).
  //   * Each bookmark item is a DIRECT child <div role="document"> of the
  //     listbox — NOT role="option".
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

      function findBookmarkListbox() {
        // pick the listbox that is inside the Bookmarks page region AND
        // has a virtual-scroll parent.
        const all = document.querySelectorAll('[role="listbox"]');
        for (const lb of all) {
          const ancestor = lb.closest('[aria-label="Bookmarks Page"]');
          const parent = lb.parentElement;
          if (!parent) continue;
          if (ancestor && parent.scrollHeight > parent.clientHeight + 10) {
            return { listbox: lb, scrollEl: parent };
          }
        }
        // fallback: any listbox whose parent has a much larger scrollHeight
        for (const lb of all) {
          const parent = lb.parentElement;
          if (parent && parent.scrollHeight > parent.clientHeight + 100
              && lb.scrollHeight > 500) {
            return { listbox: lb, scrollEl: parent };
          }
        }
        return null;
      }

      function getItems() {
        if (!listbox) return [];
        // direct children that look like a bookmark item
        return Array.from(listbox.children).filter(c =>
          c.tagName === 'DIV'
          && c.offsetHeight > 20
          && (c.innerText || '').trim().length > 0
        );
      }

      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const escapeReg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

      async function scanAll() {
        const found = findBookmarkListbox();
        if (!found) { info.textContent = '未找到 Bookmarks 列表，请确认在 Bookmarks 页面'; return; }
        listbox = found.listbox; scrollEl = found.scrollEl;
        info.textContent = '扫描中…';
        const seen = new Map();
        scrollEl.scrollTop = 0;
        await sleep(300);
        const step = Math.max(200, scrollEl.clientHeight - 100);
        let pos = 0, safety = 0, lastTotal = -1;
        while (safety < 500) {
          scrollEl.scrollTop = pos;
          await sleep(150);
          const items = getItems();
          items.forEach(el => {
            const top = el.offsetTop;
            if (!seen.has(top)) {
              const txt = (el.innerText || '').trim().replace(/\s+/g, ' ');
              if (txt) seen.set(top, { text: txt, offsetTop: top });
            }
          });
          const total = listbox.scrollHeight;
          info.textContent = `扫描中… ${seen.size} 条 (${Math.min(pos,total)}/${total}px)`;
          if (pos >= total) {
            if (total === lastTotal) break;
            lastTotal = total;
          }
          pos += step; safety++;
        }
        scrollEl.scrollTop = 0;
        cache = Array.from(seen.values()).sort((a, b) => a.offsetTop - b.offsetTop);
        info.textContent = `共 ${cache.length} 条`;
        console.log('[RCX] bookmark scan done, count=', cache.length);
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
        const found = findBookmarkListbox();
        if (!found) return;
        listbox = found.listbox; scrollEl = found.scrollEl;
        scrollEl.scrollTop = Math.max(0, item.offsetTop - 80);
        await sleep(200);
        const items = getItems();
        let best = null, bestDiff = Infinity;
        items.forEach(el => {
          const d = Math.abs(el.offsetTop - item.offsetTop);
          if (d < bestDiff) { bestDiff = d; best = el; }
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
  // (Add more features here with RCX.register({...}) in the future.)
  // =====================================================================

  // Initial mount once DOM is ready. NOTE: we DO NOT call refresh on a
  // timer — the SPA route watcher inside Shell handles re-mounting on
  // navigation, and periodic rebuilds would steal focus from inputs.
  const boot = setInterval(() => {
    if (document.body) {
      clearInterval(boot);
      setTimeout(() => Shell.refresh && Shell.refresh(), 500);
    }
  }, 200);
})();