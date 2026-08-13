/**
 * Luminae — script d'intégration pour sites tiers.
 *
 * Usage (une ligne, avant </body>) :
 *   <script src="https://luminae.app/embed.js"
 *           data-luminae-src="https://luminae.app"></script>
 *
 * Injecte un bouton flottant qui ouvre le widget de chat (/widget) dans une
 * iframe. La page hôte n'est jamais bloquée : tout est créé dynamiquement et
 * l'URL de la page courante est transmise au widget via postMessage
 * (message « luminae:init », écouté par /widget pour le contexte visiteur).
 */
(function () {
  'use strict';

  // Idempotent : ne rien faire si déjà chargé (double insertion du script).
  if (window.__luminaeEmbedLoaded) return;
  window.__luminaeEmbedLoaded = true;

  var script = document.currentScript;
  // Base : data-luminae-src, sinon l'origine du script lui-même.
  var base =
    (script && script.getAttribute('data-luminae-src')) ||
    (script && script.src ? new URL(script.src).origin : window.location.origin);
  base = base.replace(/\/+$/, ''); // sans slash final

  var accent = (script && script.getAttribute('data-accent')) || '#0E8C7D';
  var isOpen = false;

  // ── Styles (portée limitée via id dédiés, z-index élevé) ──────────────────
  var style = document.createElement('style');
  style.textContent =
    '#luminae-launcher{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border:0;border-radius:50%;' +
    'background:' + accent + ';color:#fff;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18);z-index:2147483000;' +
    'display:flex;align-items:center;justify-content:center;transition:transform .15s ease,opacity .15s ease}' +
    '#luminae-launcher:hover{transform:scale(1.06)}' +
    '#luminae-launcher svg{width:26px;height:26px}' +
    '#luminae-frame{position:fixed;bottom:88px;right:20px;width:384px;height:600px;max-width:calc(100vw - 40px);' +
    'max-height:calc(100vh - 120px);border:0;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.22);' +
    'z-index:2147483000;background:#fff;opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;' +
    'transition:opacity .18s ease,transform .18s ease}' +
    '#luminae-frame.luminae-open{opacity:1;transform:none;pointer-events:auto}' +
    '@media (max-width:480px){#luminae-frame{bottom:0;right:0;width:100vw;height:100dvh;max-width:100vw;max-height:100dvh;border-radius:0}}';
  document.head.appendChild(style);

  // ── Iframe du widget ──────────────────────────────────────────────────────
  var frame = document.createElement('iframe');
  frame.id = 'luminae-frame';
  frame.title = 'Assistant Luminae';
  frame.setAttribute('allow', 'clipboard-write');
  frame.src = base + '/widget';

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
        { type: 'luminae:init', href: window.location.href },
        base
      );
    } catch (e) {
      /* origine croisée : ignorer */
    }
  }

  function toggle() {
    isOpen = !isOpen;
    frame.classList.toggle('luminae-open', isOpen);
    launcher.innerHTML = isOpen ? ICON_CLOSE : ICON_CHAT;
    launcher.setAttribute('aria-label', isOpen ? 'Fermer le chat' : 'Ouvrir le chat');
    if (isOpen) sendInit();
  }

  launcher.addEventListener('click', toggle);
  // Renvoyer l'init dès que l'iframe est prête (au cas où déjà ouverte).
  frame.addEventListener('load', function () {
    if (isOpen) sendInit();
  });

  function mount() {
    document.body.appendChild(frame);
    document.body.appendChild(launcher);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
