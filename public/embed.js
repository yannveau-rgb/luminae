/**
 * Luminae — script d'intégration pour sites tiers.
 *
 * Usage (une ligne, avant </body>) :
 *   <script src="https://luminae.vercel.app/embed.js"
 *           data-luminae-src="https://luminae.vercel.app"></script>
 *
 * Injecte un bouton flottant qui ouvre le widget de chat (/widget) dans une
 * iframe. Inclut déclencheurs proactifs e-commerce et synchronisation SPA.
 */
(function () {
  'use strict';

  if (window.__luminaeEmbedLoaded) return;
  window.__luminaeEmbedLoaded = true;

  var script = document.currentScript;
  var base =
    (script && script.getAttribute('data-luminae-src')) ||
    (script && script.src ? new URL(script.src).origin : window.location.origin);
  base = base.replace(/\/+$/, '');

  var accent = (script && script.getAttribute('data-accent')) || '#0B7A6E';
  var isOpen = false;
  var lastUrl = window.location.href;

  // ── Styles ────────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent =
    '#luminae-launcher{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border:0;border-radius:50%;' +
    'background:' + accent + ';color:#fff;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18);z-index:2147483000;' +
    'display:flex;align-items:center;justify-content:center;transition:transform .15s ease,opacity .15s ease}' +
    '#luminae-launcher:hover{transform:scale(1.06)}' +
    '#luminae-launcher svg{width:26px;height:26px}' +
    '#luminae-frame{position:fixed;bottom:88px;right:20px;width:390px;height:640px;max-width:calc(100vw - 40px);' +
    'max-height:calc(100vh - 120px);border:0;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.22);' +
    'z-index:2147483000;background:#fff;opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;' +
    'transition:opacity .18s ease,transform .18s ease}' +
    '#luminae-frame.luminae-open{opacity:1;transform:none;pointer-events:auto}' +
    '#luminae-bubble{position:fixed;bottom:86px;right:24px;background:#fff;color:#0f172a;padding:12px 14px;' +
    'border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,.16);border:1px solid rgba(0,0,0,.08);font-family:system-ui,-apple-system,sans-serif;' +
    'font-size:12.5px;line-height:1.4;max-width:260px;z-index:2147482999;cursor:pointer;opacity:0;transform:translateY(8px) scale(.95);' +
    'transition:opacity .25s ease,transform .25s ease;display:flex;align-items:start;gap:8px}' +
    '#luminae-bubble.luminae-bubble-show{opacity:1;transform:none}' +
    '#luminae-bubble:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(0,0,0,.2)}' +
    '#luminae-bubble-close{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:0 2px;line-height:1}' +
    '#luminae-bubble-close:hover{color:#0f172a}' +
    '@media (max-width:480px){#luminae-frame{bottom:0;right:0;width:100vw;height:100dvh;max-width:100vw;max-height:100dvh;border-radius:0}}';
  document.head.appendChild(style);

  // ── Iframe du widget ──────────────────────────────────────────────────────
  var frame = document.createElement('iframe');
  frame.id = 'luminae-frame';
  frame.title = 'Assistant Luminae';
  frame.setAttribute('allow', 'clipboard-write');
  frame.src = base + '/widget';

  // ── Bulle d'accroche proactive (Trigger) ──────────────────────────────────
  var bubble = document.createElement('div');
  bubble.id = 'luminae-bubble';
  bubble.innerHTML =
    '<span>👋 <strong>Besoin d’aide ou d’un conseil ?</strong> Notre équipe et l’IA sont là pour vous répondre !</span>' +
    '<button id="luminae-bubble-close" aria-label="Fermer">✕</button>';

  var bubbleShown = false;
  function showProactiveBubble(text) {
    if (isOpen || bubbleShown || sessionStorage.getItem('luminae_bubble_dismissed')) return;
    if (text) {
      bubble.querySelector('span').innerHTML = text;
    }
    bubbleShown = true;
    bubble.classList.add('luminae-bubble-show');
  }

  function hideProactiveBubble(e) {
    if (e) e.stopPropagation();
    bubble.classList.remove('luminae-bubble-show');
    sessionStorage.setItem('luminae_bubble_dismissed', '1');
  }

  bubble.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'luminae-bubble-close') {
      hideProactiveBubble(e);
      return;
    }
    hideProactiveBubble();
    toggle();
  });

  // Déclenchement automatique après 18s ou sur pages chaudes (panier, tarifs)
  setTimeout(function () {
    var path = window.location.pathname.toLowerCase();
    if (path.includes('panier') || path.includes('cart') || path.includes('checkout')) {
      showProactiveBubble('🛒 <strong>Une question sur votre commande ?</strong> Profitez de notre assistance en direct !');
    } else if (path.includes('tarif') || path.includes('pricing')) {
      showProactiveBubble('💡 <strong>Besoin d’un conseil sur nos formules ?</strong> Discutez avec notre équipe.');
    } else {
      showProactiveBubble();
    }
  }, 18000);

  // ── Bouton flottant ───────────────────────────────────────────────────────
  var launcher = document.createElement('button');
  launcher.id = 'luminae-launcher';
  launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Ouvrir le chat');
  var ICON_CHAT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_CLOSE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  launcher.innerHTML = ICON_CHAT;

  function sendInit() {
    try {
      frame.contentWindow.postMessage(
        { type: 'luminae:init', href: window.location.href, title: document.title },
        base
      );
    } catch (e) {}
  }

  function sendNavigation(href, title) {
    try {
      frame.contentWindow.postMessage(
        { type: 'luminae:navigation', href: href, title: title || document.title },
        base
      );
    } catch (e) {}
  }

  function checkUrlChange() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      sendNavigation(lastUrl, document.title);
    }
  }

  var origPushState = history.pushState;
  if (origPushState) {
    history.pushState = function () {
      origPushState.apply(this, arguments);
      setTimeout(checkUrlChange, 60);
    };
  }

  var origReplaceState = history.replaceState;
  if (origReplaceState) {
    history.replaceState = function () {
      origReplaceState.apply(this, arguments);
      setTimeout(checkUrlChange, 60);
    };
  }

  window.addEventListener('popstate', checkUrlChange);
  window.addEventListener('hashchange', checkUrlChange);
  setInterval(checkUrlChange, 1500);

  function toggle() {
    isOpen = !isOpen;
    if (isOpen) hideProactiveBubble();
    frame.classList.toggle('luminae-open', isOpen);
    launcher.innerHTML = isOpen ? ICON_CLOSE : ICON_CHAT;
    launcher.setAttribute('aria-label', isOpen ? 'Fermer le chat' : 'Ouvrir le chat');
    if (isOpen) {
      sendInit();
      sendNavigation(window.location.href, document.title);
    }
  }

  launcher.addEventListener('click', toggle);
  frame.addEventListener('load', function () {
    sendInit();
    if (isOpen) sendNavigation(window.location.href, document.title);
  });

  function mount() {
    document.body.appendChild(frame);
    document.body.appendChild(bubble);
    document.body.appendChild(launcher);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
