# RC Anna Toolkit

An extensible Tampermonkey userscript for the RingCentral web app
(`https://app.ringcentral.com/`).

The script provides a small floating panel that hosts multiple **features**
as tabs. Each feature is activated only on the pages where it makes sense.
New features can be added over time without rewriting the existing ones.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Open this raw URL — Tampermonkey will offer to install the script:
   <https://raw.githubusercontent.com/Anna-SAP/RC_anna/main/rc_anna.user.js>
3. Open <https://app.ringcentral.com/>. A floating panel labeled
   **RC Anna Toolkit** appears in the top-right corner. Drag its header to
   move it; click the `_` button to collapse.

Tampermonkey will automatically pick up new versions from this repo via the
`@updateURL` / `@downloadURL` headers in the script.

## Current features

### Bookmark Search

Active on `/messages/bookmarks`. RingCentral's bookmark list uses virtual
scrolling, so a plain Ctrl+F can't see bookmarks that aren't rendered.

Usage:

1. Open the **Bookmarks** page.
2. Click **⟳ Scan** in the panel. The script scrolls the bookmark list
   from top to bottom once, caching every bookmark's text and position.
3. Type a keyword in the search box to filter in real time. Matched text
   is highlighted.
4. Click any result to scroll the list to that bookmark; the matching row
   is briefly outlined in orange.
5. After adding or removing bookmarks, click **⟳ Scan** again to refresh
   the cache. **Clear** wipes the cache and the search box.

The script never sends any network requests and never modifies any
bookmark — everything is read-only and lives in memory only.

## Adding a new feature

A feature is just an object passed to `RCX.register(...)` inside
`rc_anna.user.js`:

```js
RCX.register({
  id: 'my-feature',            // unique key
  name: 'My Feature',          // label shown on the tab
  match: (url) => url.includes('/some/path'), // when to activate
  init(ctx) {
    // ctx.panel: the DOM container you should fill in
    // ctx.h(tag, props, ...children): tiny element helper
    // ctx.setStatus(text): show a message in the status bar
    // ctx.onDestroy(fn): register a cleanup callback (called on route change)
    const btn = ctx.h('button', { class: 'rcx-btn' }, 'Hello');
    btn.addEventListener('click', () => ctx.setStatus('clicked'));
    ctx.panel.appendChild(btn);
  },
});
```

If `match` returns `false` for the current URL, the feature's tab is shown
disabled and its `init` is not called. When the URL changes (SPA
navigation), features are mounted/unmounted automatically.

## Releasing a new version

1. Edit `rc_anna.user.js`.
2. Bump the `@version` line (e.g. `0.1.0` → `0.2.0`).
3. Commit & push to `main`.

All installed Tampermonkey clients will pick up the update on their next
update check (or you can force it from the Tampermonkey dashboard).

## License

MIT (or whichever you prefer — add a `LICENSE` file if you want).
