/**
 * Sanitisation du HTML produit par le composer agent.
 *
 * Le rendu se fait via `dangerouslySetInnerHTML` à la fois dans l'interface
 * agent ET dans le widget public servi sur les sites clients : une faille ici
 * devient un XSS stocké diffusé chez vos clients (constat S-08).
 *
 * Implémentation : un tokenizer qui parcourt la chaîne caractère par caractère,
 * puis RECONSTRUIT la sortie depuis une liste blanche. Rien de ce qui entre
 * n'est recopié tel quel — ni les attributs (tous supprimés, sauf `href` sur
 * `<a>` après validation du schéma), ni le texte (échappé). Les balises
 * remplacent l'ancienne succession de `String.replace`, dont la logique de
 * découpe était trop fragile pour ce qu'elle protège.
 *
 * Note : la référence du domaine reste DOMPurify. Le remplacement se fait en un
 * point d'appel unique dès qu'une dépendance peut être ajoutée au projet.
 */

/** Balises conservées. Toutes leurs autres caractéristiques sont perdues. */
const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'div', 'span',
  'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre'
]);

/** Balises sans contenu. */
const VOID_TAGS = new Set(['br']);

/**
 * Balises dont le CONTENU est également jeté. Sans cela, coller un script
 * afficherait son code en texte (inoffensif mais illisible) ; et pour `svg` /
 * `math`, le contenu relève d'un analyseur différent où les règles HTML ne
 * s'appliquent pas — mieux vaut ne rien en garder.
 */
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'form',
  'template', 'svg', 'math', 'noscript', 'title', 'textarea'
]);

/** Une esperluette qui n'ouvre pas déjà une entité valide. */
const LONE_AMP = /&(?![a-zA-Z][a-zA-Z0-9]{1,31};|#\d{1,7};|#[xX][0-9a-fA-F]{1,6};)/g;

/** Échappe un fragment de texte, en préservant les entités déjà présentes. */
function escapeText(text: string): string {
  return text.replace(LONE_AMP, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Échappe une valeur d'attribut destinée à être placée entre guillemets. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Décode les entités numériques et nommées courantes, pour que la validation du
 * schéma d'URL ne soit pas contournable par encodage (« java&#115;cript: »).
 */
function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', colon: ':', tab: '\t', newline: '\n'
  };
  return value.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);?/g, (match, body: string) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return named[body.toLowerCase()] ?? match;
  });
}

/**
 * Retire espaces et caractères de contrôle (C0, DEL, C1). Les navigateurs les
 * ignorent à l'intérieur d'un schéma d'URL : « java\tscript:alert(1) » s'exécute
 * malgré la tabulation. Il faut donc les ôter AVANT de valider le schéma.
 *
 * Écrit en boucle plutôt qu'en classe de caractères : une regex demanderait des
 * échappements \u que le moindre outil de réécriture peut transformer en
 * caractères littéraux, rendant le garde-fou silencieusement inopérant.
 */
function stripBlankAndControl(value: string): string {
  let result = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl = code <= 32 || code === 127 || (code >= 128 && code <= 159);
    if (!isControl) result += ch;
  }
  return result;
}

/**
 * Extrait un `href` exploitable. Retourne null si l'URL n'est pas une adresse
 * http(s) absolue — ce qui écarte `javascript:`, `data:`, `vbscript:` et les
 * schémas d'application, y compris sous forme encodée.
 */
function safeHref(attrs: string): string | null {
  const match = /(?:^|[\s/])href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/i.exec(attrs);
  if (!match) return null;

  const raw = match[2] ?? match[3] ?? match[4] ?? '';
  const url = stripBlankAndControl(decodeEntities(raw));
  if (!/^https?:\/\/[^/]/i.test(url)) return null;
  return url;
}

interface ParsedTag {
  name: string;
  closing: boolean;
  selfClosing: boolean;
  attrs: string;
  /** Index du caractère suivant le « > » fermant. */
  end: number;
}

/**
 * Lit une balise à partir de la position du « < ».
 * Le parcours des attributs respecte les guillemets : un `>` dans une valeur
 * ne termine donc pas la balise, contrairement à ce que faisait l'ancien
 * `[^<>]*?`. Retourne null si ce n'est pas une balise (« < » orphelin) ou si
 * elle n'est jamais fermée.
 */
function parseTag(source: string, start: number): ParsedTag | null {
  let p = start + 1;
  const closing = source[p] === '/';
  if (closing) p++;

  const name = /^[a-zA-Z][a-zA-Z0-9:-]*/.exec(source.slice(p))?.[0];
  if (!name) return null;
  p += name.length;

  const attrStart = p;
  let quote: string | null = null;
  while (p < source.length) {
    const c = source[p];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      break;
    }
    p++;
  }
  if (p >= source.length) return null; // balise non terminée

  const attrs = source.slice(attrStart, p);
  return { name, closing, selfClosing: /\/\s*$/.test(attrs), attrs, end: p + 1 };
}

/** Position juste après la balise fermante de `name`, ou la fin de la chaîne. */
function skipContent(source: string, from: number, name: string): number {
  const closeRe = new RegExp(`</\\s*${name}\\b[^>]*>`, 'i');
  const rest = source.slice(from);
  const found = closeRe.exec(rest);
  return found ? from + found.index + found[0].length : source.length;
}

export function sanitizeHtml(html: string): string {
  const out: string[] = [];
  /** Balises ouvertes, pour refermer proprement et ignorer les fermetures orphelines. */
  const open: string[] = [];
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      out.push(escapeText(html.slice(i)));
      break;
    }
    if (lt > i) out.push(escapeText(html.slice(i, lt)));

    // Commentaires, doctype, instructions de traitement : rien à conserver.
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
      const end = html.indexOf('>', lt);
      i = end === -1 ? html.length : end + 1;
      continue;
    }

    const tag = parseTag(html, lt);
    if (!tag) {
      out.push('&lt;'); // « < » littéral
      i = lt + 1;
      continue;
    }
    i = tag.end;

    const name = tag.name.toLowerCase();

    if (DROP_WITH_CONTENT.has(name)) {
      if (!tag.closing && !tag.selfClosing) i = skipContent(html, i, name);
      continue;
    }

    // Balise inconnue : elle disparaît, son contenu textuel est conservé
    // (échappé) — un `<h2>` collé depuis un site devient du texte simple.
    if (!ALLOWED_TAGS.has(name)) continue;

    if (tag.closing) {
      const idx = open.lastIndexOf(name);
      if (idx === -1) continue; // fermeture sans ouverture : ignorée
      for (let k = open.length - 1; k >= idx; k--) out.push(`</${open[k]}>`);
      open.length = idx;
      continue;
    }

    if (VOID_TAGS.has(name)) {
      out.push(`<${name}>`);
      continue;
    }

    if (name === 'a') {
      const href = safeHref(tag.attrs);
      out.push(
        href
          ? `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer nofollow">`
          : '<a>'
      );
    } else {
      out.push(`<${name}>`);
    }
    if (!tag.selfClosing) open.push(name);
  }

  // Refermer ce qui reste ouvert : un HTML déséquilibré ne doit pas pouvoir
  // déborder de la bulle de message et disloquer la mise en page.
  for (let k = open.length - 1; k >= 0; k--) out.push(`</${open[k]}>`);

  return out.join('');
}
