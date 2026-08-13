import { sanitizeHtml } from './sanitize.ts';

interface Case {
  nom: string;
  entree: string;
  /** La sortie ne doit contenir AUCUN de ces fragments. */
  interdit?: string[];
  /** La sortie doit contenir ces fragments. */
  attendu?: string[];
}

const cas: Case[] = [
  // ── Vecteurs XSS ────────────────────────────────────────────────────────
  {
    nom: 'script simple',
    entree: '<script>alert(1)</script>bonjour',
    interdit: ['<script', 'alert(1)'],
    attendu: ['bonjour']
  },
  {
    nom: 'img avec onerror',
    entree: '<img src=x onerror=alert(1)>',
    interdit: ['onerror', '<img']
  },
  {
    nom: 'handler sur balise autorisee',
    entree: '<p onclick="alert(1)">texte</p>',
    interdit: ['onclick', 'alert'],
    attendu: ['<p>', 'texte', '</p>']
  },
  {
    nom: 'href javascript:',
    entree: '<a href="javascript:alert(1)">clic</a>',
    interdit: ['javascript'],
    attendu: ['<a>', 'clic']
  },
  {
    nom: 'href javascript: encode en entite',
    entree: '<a href="java&#115;cript:alert(1)">clic</a>',
    interdit: ['javascript', 'java&#115;cript:alert']
  },
  {
    nom: 'href javascript: avec tabulation',
    entree: '<a href="java\tscript:alert(1)">clic</a>',
    interdit: ['javascript', 'script:alert']
  },
  {
    nom: 'href data: html',
    entree: '<a href="data:text/html;base64,PHNjcmlwdD4=">clic</a>',
    interdit: ['data:text/html']
  },
  {
    nom: 'attribut contenant un chevron fermant (ancien trou)',
    entree: '<a href="https://ok.fr" title="a>b" onmouseover="alert(1)">clic</a>',
    interdit: ['onmouseover', 'alert'],
    attendu: ['https://ok.fr']
  },
  {
    nom: 'svg avec script imbrique',
    entree: '<svg><script>alert(1)</script></svg>apres',
    interdit: ['<svg', 'alert(1)', '<script'],
    attendu: ['apres']
  },
  {
    nom: 'iframe',
    entree: '<iframe src="https://evil.test"></iframe>',
    interdit: ['<iframe', 'evil.test']
  },
  {
    nom: 'style avec expression',
    entree: '<style>body{background:url(javascript:alert(1))}</style>ok',
    interdit: ['<style', 'javascript'],
    attendu: ['ok']
  },
  {
    nom: 'balise inconnue en casse mixte',
    entree: '<ScRiPt>alert(1)</ScRiPt>',
    interdit: ['alert(1)', 'ScRiPt']
  },
  {
    nom: 'commentaire conditionnel',
    entree: '<!--[if IE]><script>alert(1)</script><![endif]-->visible',
    interdit: ['alert(1)'],
    attendu: ['visible']
  },
  {
    nom: 'form + input',
    entree: '<form action="https://evil.test"><input name="a"></form>',
    interdit: ['<form', '<input', 'evil.test']
  },

  // ── Non-regression : le HTML legitime doit survivre ─────────────────────
  {
    nom: 'mise en forme du composeur',
    entree: '<p>Bonjour <b>Marie</b>, voici la <i>procedure</i>.</p>',
    attendu: ['<p>', '<b>', 'Marie', '</b>', '<i>', 'procedure', '</i>', '</p>']
  },
  {
    nom: 'liste a puces',
    entree: '<ul><li>un</li><li>deux</li></ul>',
    attendu: ['<ul>', '<li>', 'un', '</li>', 'deux', '</ul>']
  },
  {
    nom: 'lien https legitime',
    entree: '<a href="https://luminae.app/aide?x=1&y=2">aide</a>',
    attendu: ['href="https://luminae.app/aide?x=1&amp;y=2"', 'rel="noopener noreferrer nofollow"', 'target="_blank"']
  },
  {
    nom: 'entites deja presentes preservees',
    entree: '<p>Tarif&nbsp;: 5&nbsp;&euro; &amp; plus</p>',
    attendu: ['&nbsp;', '&amp;', '&euro;']
  },
  {
    nom: 'texte avec chevrons litteraux',
    entree: 'si a < b et b > c alors 5 < 10',
    attendu: ['a &lt; b', 'b &gt; c']
  },
  {
    nom: 'balises non refermees equilibrees',
    entree: '<div><p>texte',
    attendu: ['<div>', '<p>', 'texte', '</p>', '</div>']
  },
  {
    nom: 'fermeture orpheline ignoree',
    entree: 'texte</div></p>',
    interdit: ['</div>', '</p>']
  },
  {
    nom: 'br autoferme',
    entree: 'ligne1<br/>ligne2',
    attendu: ['<br>', 'ligne1', 'ligne2']
  }
];

let echecs = 0;
for (const c of cas) {
  const sortie = sanitizeHtml(c.entree);
  const problemes: string[] = [];

  for (const frag of c.interdit ?? []) {
    if (sortie.toLowerCase().includes(frag.toLowerCase())) problemes.push(`contient « ${frag} »`);
  }
  for (const frag of c.attendu ?? []) {
    if (!sortie.includes(frag)) problemes.push(`manque « ${frag} »`);
  }

  if (problemes.length > 0) {
    echecs++;
    console.log(`ECHEC  ${c.nom}`);
    console.log(`       entree : ${c.entree}`);
    console.log(`       sortie : ${sortie}`);
    console.log(`       ${problemes.join(' | ')}`);
  } else {
    console.log(`ok     ${c.nom}`);
  }
}

console.log(`\n${cas.length - echecs}/${cas.length} cas passent.`);
if (echecs > 0) process.exitCode = 1;
