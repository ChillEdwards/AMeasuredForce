/* ============================================================
   AMF SPA Router
   ------------------------------------------------------------
   Intercepts internal <a> clicks and converts them into:
     1. relief retreat animation (shader-bg)
     2. parallel fetch of the target page's HTML
     3. <main> + <title> swap once both retreat and fetch are ready
     4. history.pushState so the URL/back-forward stays correct
     5. AMFShaderBg.swapPage(newKey) — old reliefs disposed, new
        reliefs loaded against the same wall (the wall never resets)
     6. AMFPage.boot(newMain) — per-page JS re-initialises against
        the freshly-inserted DOM, with the previous page's
        listeners / rAFs / observers torn down first.

   The plaster wall (shader-bg canvas), the smoke canvas, the
   header, the menu overlay, the footer, and the cursor are all
   PERSISTENT — they live outside <main> and are never touched
   on navigation. That's the whole point of going SPA: the wall
   is the same wall the entire time.
   ============================================================ */
(function () {
  if (typeof window === 'undefined') return;
  if (!window.history || !window.history.pushState) return;

  /* Mirror the relief lookup used in shader-bg.js so the router can
     decide which set to load after a swap. Keep these in sync. */
  function pageKeyFromPath(path) {
    if (/\/services\/ai\/?(index\.html)?$/.test(path)) return 'ai';
    if (path === '/' || /\/index\.html?$/.test(path) || path === '/index') return 'home';
    if (/\/contact\.html?$/.test(path)) return 'contact';
    if (/\/about\.html?$/.test(path)) return 'about';
    if (/\/work\.html?$/.test(path)) return 'work';
    return null;
  }

  function isInternalLink(a) {
    const raw = a.getAttribute('href');
    if (!raw) return false;
    if (raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) return false;
    if (a.target === '_blank') return false;
    if (a.hasAttribute('download')) return false;
    if (a.hasAttribute('data-no-router')) return false;
    try {
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return false;
      // Same-document anchor — leave to the smooth-anchor handler.
      if (url.pathname === location.pathname && url.search === location.search && url.hash) return false;
      // Exact same URL — no-op.
      if (url.href === location.href) return false;
      return true;
    } catch (e) { return false; }
  }

  function isMenuOpen() {
    const overlay = document.getElementById('menuOverlay');
    return !!(overlay && overlay.classList.contains('is-open'));
  }

  let navGen = 0;
  let navigating = false;

  async function navigate(href, options) {
    options = options || {};
    const fromMenu  = !!options.fromMenu;
    const skipRetreat = !!options.skipRetreat;

    if (navigating) return;
    navigating = true;
    const myGen = ++navGen;

    // Reliefs sink back into the wall while we fetch. The wall itself
    // stays — that's what gives the navigation its grounded feel.
    if (!skipRetreat && window.AMFShaderBg && window.AMFShaderBg.retreatAllReliefs) {
      window.AMFShaderBg.retreatAllReliefs(1100);
    }

    // Kick the smoke recede in parallel with the relief retreat so both fade
    // together. The menu overlay container stays visible until the page swap;
    // is-navigating fades the items + submenu in parallel with the smoke so
    // nothing lingers after the smoke clears.
    const menuOverlayEl = fromMenu ? document.getElementById('menuOverlay') : null;
    if (fromMenu && window.MenuShader && window.MenuShader.stop) {
      window.MenuShader.stop();
    }
    if (menuOverlayEl) menuOverlayEl.classList.add('is-navigating');

    // Fetch the target page in parallel with the retreat animation.
    const fetchPromise = fetch(href, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      });

    // Hold the swap until BOTH the retreat has played out AND the fetch
    // has landed. Retreat = 1100ms — matches the perceived "everything's
    // gone" moment of the smoke + statue + items fade; the page swap lands
    // right when the wall is bare.
    const retreatMs = skipRetreat ? 0 : 1100;

    let html;
    try {
      const [fetchedHtml] = await Promise.all([
        fetchPromise,
        new Promise((resolve) => setTimeout(resolve, retreatMs)),
      ]);
      html = fetchedHtml;
    } catch (e) {
      console.warn('[router] fetch failed; falling back to hard nav', e);
      window.location.href = href;
      return;
    }

    // A newer click won the race — bail before mutating the DOM.
    if (myGen !== navGen) { navigating = false; return; }

    let newMain, newTitle;
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      newMain = doc.querySelector('main');
      newTitle = doc.querySelector('title');
    } catch (e) {
      console.warn('[router] parse failed; falling back to hard nav', e);
      window.location.href = href;
      return;
    }

    if (!newMain) {
      console.warn('[router] no <main> in response; falling back', href);
      window.location.href = href;
      return;
    }

    // Order matters here, top to bottom:
    //   1. pushState first so the document's base URL is updated before any
    //      relative paths in the new <main> are resolved by the browser.
    //   2. Update <title>.
    //   3. Tear down previous page's JS (AMFPage.boot calls teardown inside).
    //   4. Swap <main> — the new main is now in the DOM under the new URL.
    //   5. Reset scroll to top so the new page reads as a fresh page.
    //   6. Tell shader-bg to dispose old reliefs and load the new page's set
    //      (this also resets the camera Y to match scroll=0).
    //   7. Boot per-page JS against the new main.
    //   8. Close the menu if the navigation was initiated from it.
    history.pushState({ amf: true, href: href }, '', href);
    if (newTitle) document.title = newTitle.textContent;

    const currentMain = document.querySelector('main');
    if (currentMain) currentMain.replaceWith(newMain);
    else document.body.appendChild(newMain);

    window.scrollTo(0, 0);

    const newKey = pageKeyFromPath(new URL(href, location.href).pathname);
    if (window.AMFShaderBg && window.AMFShaderBg.swapPage) {
      window.AMFShaderBg.swapPage(newKey);
    }

    if (window.AMFPage && window.AMFPage.boot) {
      window.AMFPage.boot(newMain);
    }

    if (fromMenu && window.AMFMenu && window.AMFMenu.close) {
      window.AMFMenu.close();
      if (menuOverlayEl) menuOverlayEl.classList.remove('is-navigating');
    }

    navigating = false;
  }

  // Capture-phase click interceptor. Wins over the smooth-anchor and any
  // other handlers in main.js so we don't double-handle.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.button !== 0) return;
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;

    const overlay = document.getElementById('menuOverlay');
    const fromMenu = !!(overlay && overlay.classList.contains('is-open') && overlay.contains(a));

    // Same-URL click from the open menu: just close the menu — don't retreat
    // reliefs, don't swap <main>, don't reset scroll. The page the user is on
    // stays exactly as it was; only the smoke + items + overlay dissolve.
    if (fromMenu) {
      try {
        const url = new URL(a.href, location.href);
        if (url.href === location.href) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (window.AMFMenu && window.AMFMenu.close) window.AMFMenu.close();
          return;
        }
      } catch (_) { /* fall through */ }
    }

    if (!isInternalLink(a)) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    navigate(a.href, { fromMenu: fromMenu });
  }, true);

  // Back / forward — no retreat (the user didn't click a link), just swap.
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.amf) {
      navigate(location.href, { skipRetreat: true, fromMenu: false });
    }
  });

  // Record the initial page so the first popstate back lands here cleanly.
  history.replaceState({ amf: true, href: location.href }, '', location.href);

  window.AMFRouter = { navigate: navigate };
})();
