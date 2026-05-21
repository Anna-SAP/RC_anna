// ==UserScript==
// @name         RC Anna Toolkit
// @namespace    https://github.com/Anna-SAP/RC_anna
// @version      0.2.1
// @description  Extensible userscript toolkit for RingCentral web app. Features: Bookmark Search, Conversation Search. Scan results now also show the earliest item's posted time.
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
  // RCX core (same as 0.2.0)
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

  const Shell = (function () {
    let host, tabsEl, bodyEl, statusEl;
    const mounted = new Map();
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
          #rcx-tabs.single .rcx-tab{cursor:default;background:transparent;border:none;
            color:#0b66c2;font-weight:600;font-size:13px;padding:2px 0}
          #rcx-tabs.single .rcx-tab:hover{background:transparent}
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
          .rcx-btn[disabled]{opacity:.5;cursor:not-allowed}
          .rcx-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
          .rcx-info{font-size:12px;color:#666;line-height:1.5}
          .rcx-info b{color:#222;font-weight:600}
          .rcx-list{display:flex;flex-direction:column;gap:2px;max-height:50vh;overflow:auto}
          .rcx-item{padding:6px 8px;border-radius:4px;cursor:pointer;border:1px solid transparent}
          .rcx-item:hover{background:#f0f4fa;border-color:#dde4ef}
          .rcx-item mark{background:#fff2a8;padding:0 1px}
          .rcx-item .rcx-snippet{display:block;white-space:pre-wrap;word-break:break-word}
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
      tabsEl.classList.toggle('single', available.length === 1);
      RCX.features.forEach(f => {
        const ok = available.includes(f);
        if (!ok && available.length <= 1) return;
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
  // Shared helpers
  // =====================================================================
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const escapeReg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const norm = (s) => (s || '').trim().replace(/\s+/g, ' ');

  // Try to extract the visible "posted time" text from a message card.
  // RC uses .conversation-card-head__right for this; format varies:
  //   "1:20 PM"           (today)
  //   "Mon, 1:20 PM"      (within last week)
  //   "Apr 12"            (this year)
  //   "Apr 12, 2024"      (older than a year)
  function extractCardTimeText(cardEl) {
    if (!cardEl) return '';
    const head = cardEl.querySelector('.conversation-card-head__right');
    if (!head) return '';
    return norm(head.innerText);
  }

  // Render the info line. Earliest time is shown when known.
  function renderInfo(infoEl, { matched, total, earliestTimeText, earliestSourceId }) {
    infoEl.innerHTML = '';
    const main = document.createElement('span');
    if (matched == null || matched === total) {
      main.innerHTML = `共 <b>${total}</b> 条`;
    } else {
      main.innerHTML = `<b>${matched}</b> / ${total} 条匹配`;
    }
    infoEl.appendChild(main);
    if (earliestTimeText) {
      const sep = document.createElement('span');
      sep.textContent = ' · 最早 ';
      sep.style.color = '#888';
      const t = document.createElement('span');
      t.textContent = earliestTimeText;
      t.style.color = '#222';
      infoEl.appendChild(sep);
      infoEl.appendChild(t);
    }
  }

  // =====================================================================
  // Feature: Bookmark Search
  // =====================================================================
  RCX.register({
    id: 'bookmark-search',
    name: 'Bookmark Search',
    match: (url) => url.includes('/messages/bookmarks'),
    init(ctx) {
      const { h } = ctx;
      // cache items: { text, offsetTop, sortKey (number), timeText }
      let cache = [];
      let listbox = null;
      let scrollEl = null;

      const input = h('input', { class: 'rcx-input', placeholder: '输入关键词搜索 (先点 Scan)' });
      const scanBtn = h('button', { class: 'rcx-btn' }, '⟳ Scan');
      const clearBtn = h('button', { class: 'rcx-btn' }, 'Clear');
      const info = h('div', { class: 'rcx-info' }, '未扫描');
      const list = h('div', { class: 'rcx-list' });

      ctx.panel.append(
        h('div', { class: 'rcx-row' }, scanBtn, clearBtn),
        info,
        input,
        list
      );

      function findBookmarkListbox() {
        const all = document.querySelectorAll('[role="listbox"]');
        for (const lb of all) {
          const ancestor = lb.closest('[aria-label="Bookmarks Page"]');
          const parent = lb.parentElement;
          if (!parent) continue;
          if (ancestor && parent.scrollHeight > parent.clientHeight + 10) {
            return { listbox: lb, scrollEl: parent };
          }
        }
        for (const lb of all) {
          const parent = lb.parentElement;
          if (parent && parent.scrollHeight > parent.clientHeight + 100 && lb.scrollHeight > 500) {
            return { listbox: lb, scrollEl: parent };
          }
        }
        return null;
      }

      function getItems() {
        if (!listbox) return [];
        return Array.from(listbox.children).filter(c =>
          c.tagName === 'DIV' && c.offsetHeight > 20 && (c.innerText || '').trim().length > 0
        );
      }

      // earliest = item with the smallest message id we can read from the
      // card. Bookmarks may not always expose an id, in which case we
      // fall back to scroll position (later items = newer? actually RC
      // shows bookmarks in the order they were created, with the most
      // recently bookmarked at the TOP — so "earliest" by position is
      // the BOTTOM-most item). To be robust we prefer message id.
      function computeEarliest() {
        if (!cache.length) return null;
        const withId = cache.filter(c => c.sortKey != null);
        if (withId.length) {
          const min = withId.reduce((a, b) => (a.sortKey < b.sortKey ? a : b));
          return min;
        }
        // fallback: bottom item
        return cache[cache.length - 1];
      }

      async function scanAll() {
        const found = findBookmarkListbox();
        if (!found) { info.textContent = '未找到 Bookmarks 列表'; return; }
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
            if (seen.has(top)) return;
            const txt = norm(el.innerText);
            if (!txt) return;
            // try to read message id from inside this bookmark card
            const innerCard = el.querySelector('[data-ally-id]');
            const sortKey = innerCard ? Number(innerCard.getAttribute('data-ally-id')) : null;
            const timeText = extractCardTimeText(el);
            seen.set(top, { text: txt, offsetTop: top, sortKey: isFinite(sortKey) ? sortKey : null, timeText });
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
        render(input.value);
      }

      function render(q) {
        list.innerHTML = '';
        if (!cache.length) {
          renderInfo(info, { total: 0 });
          info.textContent = '请先点 Scan 扫描';
          list.appendChild(h('div', { class: 'rcx-muted' }, '请先点 Scan 扫描'));
          return;
        }
        q = (q || '').trim();
        let arr = cache;
        if (q) {
          const ql = q.toLowerCase();
          arr = cache.filter(c => c.text.toLowerCase().includes(ql));
        }
        const earliest = computeEarliest();
        renderInfo(info, {
          matched: q ? arr.length : undefined,
          total: cache.length,
          earliestTimeText: earliest && earliest.timeText ? earliest.timeText : null
        });
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
        flashHighlight(best);
      }

      scanBtn.addEventListener('click', scanAll);
      clearBtn.addEventListener('click', () => { cache = []; input.value = ''; render(''); });

      let t;
      input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => render(input.value), 150); });

      render('');
    },
  });

  // =====================================================================
  // Feature: Conversation Search
  // =====================================================================
  RCX.register({
    id: 'conversation-search',
    name: 'Conversation Search',
    match: (url) => /\/messages\/\d+/.test(url) && !url.includes('/bookmarks'),
    init(ctx) {
      const { h } = ctx;
      // cache items: { id (string), idNum (number), text, offsetTop, timeText }
      let cache = [];
      let vl = null;

      const input = h('input', { class: 'rcx-input', placeholder: '输入关键词搜索本会话 (先点 Scan)' });
      const scanBtn = h('button', { class: 'rcx-btn' }, '⟳ Scan');
      const stopBtn = h('button', { class: 'rcx-btn' }, 'Stop');
      const clearBtn = h('button', { class: 'rcx-btn' }, 'Clear');
      const info = h('div', { class: 'rcx-info' }, '未扫描');
      const hint = h('div', { class: 'rcx-muted' },
        'Scan 会反复向上滚以加载历史消息，再向下滚一遍收集内容。会话越长耗时越久。');
      const list = h('div', { class: 'rcx-list' });

      stopBtn.disabled = true;
      ctx.panel.append(
        h('div', { class: 'rcx-row' }, scanBtn, stopBtn, clearBtn),
        info,
        input,
        hint,
        list
      );

      function findScroller() {
        const region = document.querySelector('[aria-label="Conversation messages"]');
        if (!region) return null;
        return region.querySelector('[data-test-automation-id="virtualized-list"]');
      }

      function getVisibleMessages() {
        if (!vl) return [];
        return Array.from(vl.querySelectorAll('div[class*="primary-card"]'))
          .filter(el => el.offsetHeight > 10);
      }

      function relTopWithinScroller(el) {
        if (!vl) return 0;
        const er = el.getBoundingClientRect();
        const vr = vl.getBoundingClientRect();
        return (er.top - vr.top) + vl.scrollTop;
      }

      function harvest(seen) {
        const msgs = getVisibleMessages();
        msgs.forEach(el => {
          const idAttr = el.getAttribute('data-ally-id') || el.getAttribute('data-id') || '';
          const id = idAttr || ('top:' + Math.round(relTopWithinScroller(el)));
          if (seen.has(id)) {
            // refresh offsetTop & timeText (in case new history shifted positions)
            const exist = seen.get(id);
            exist.offsetTop = Math.round(relTopWithinScroller(el));
            if (!exist.timeText) exist.timeText = extractCardTimeText(el);
            return;
          }
          const txt = norm(el.innerText);
          if (!txt) return;
          const idNum = Number(idAttr);
          seen.set(id, {
            id,
            idNum: isFinite(idNum) ? idNum : null,
            text: txt,
            offsetTop: Math.round(relTopWithinScroller(el)),
            timeText: extractCardTimeText(el),
          });
        });
      }

      function computeEarliest() {
        if (!cache.length) return null;
        const withId = cache.filter(c => c.idNum != null);
        if (withId.length) {
          return withId.reduce((a, b) => (a.idNum < b.idNum ? a : b));
        }
        return cache[0]; // smallest offsetTop
      }

      let aborted = false;
      async function scanAll() {
        vl = findScroller();
        if (!vl) { info.textContent = '未找到 Conversation 消息流，请先打开会话'; return; }
        aborted = false;
        scanBtn.disabled = true; stopBtn.disabled = false;
        const seen = new Map();

        info.textContent = '加载历史中… (向上滚)';
        let lastSH = -1, stableRounds = 0, phase1Rounds = 0;
        while (!aborted && phase1Rounds < 400) {
          vl.scrollTop = 0;
          await sleep(700);
          harvest(seen);
          const sh = vl.scrollHeight;
          info.textContent = `加载历史… 已知 ${seen.size} 条, 列表高度 ${sh}px`;
          if (sh === lastSH) {
            stableRounds++;
            if (stableRounds >= 3) break;
          } else {
            stableRounds = 0;
            lastSH = sh;
          }
          phase1Rounds++;
        }

        if (!aborted) {
          info.textContent = '收集消息中… (向下滚)';
          vl.scrollTop = 0;
          await sleep(300);
          const total = vl.scrollHeight;
          const step = Math.max(200, vl.clientHeight - 100);
          let pos = 0, safety = 0;
          while (!aborted && safety < 800) {
            vl.scrollTop = pos;
            await sleep(180);
            harvest(seen);
            info.textContent = `收集中… ${seen.size} 条 (${Math.min(pos,total)}/${total}px)`;
            if (pos >= total) break;
            pos += step; safety++;
          }
        }

        cache = Array.from(seen.values()).sort((a, b) => a.offsetTop - b.offsetTop);
        scanBtn.disabled = false; stopBtn.disabled = true;
        render(input.value);
      }

      function render(q) {
        list.innerHTML = '';
        if (!cache.length) {
          renderInfo(info, { total: 0 });
          info.textContent = '请先点 Scan 扫描';
          list.appendChild(h('div', { class: 'rcx-muted' }, '请先点 Scan 扫描'));
          return;
        }
        q = (q || '').trim();
        let arr = cache;
        if (q) {
          const ql = q.toLowerCase();
          arr = cache.filter(c => c.text.toLowerCase().includes(ql));
        }
        const earliest = computeEarliest();
        renderInfo(info, {
          matched: q ? arr.length : undefined,
          total: cache.length,
          earliestTimeText: earliest && earliest.timeText ? earliest.timeText : null
        });
        const reg = q ? new RegExp(escapeReg(q), 'ig') : null;
        arr.slice(0, 200).forEach(item => {
          const snippet = item.text.length > 260 ? item.text.slice(0, 260) + '…' : item.text;
          const html = reg ? escapeHtml(snippet).replace(reg, m => `<mark>${m}</mark>`) : escapeHtml(snippet);
          const row = h('div', { class: 'rcx-item' });
          const span = document.createElement('span');
          span.className = 'rcx-snippet';
          // prefix time if available
          if (item.timeText) {
            const prefix = document.createElement('span');
            prefix.style.cssText = 'color:#888;margin-right:6px;font-size:11px';
            prefix.textContent = '
