/**
 * Sanitisation minimale du HTML produit par le composer agent.
 * Liste blanche de balises ; seuls les liens gardent leur href (http/https).
 */

const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'div', 'span',
  'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre'
]);

export function sanitizeHtml(html: string): string {
  // Suppression complète des balises dangereuses et de leur contenu.
  let out = html.replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\s*\1\s*>/gi, '');
  out = out.replace(/<(script|style|iframe|object|embed|form)[^>]*\/?>/gi, '');
  // Suppression des handlers et javascript: résiduels.
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/javascript\s*:/gi, '');

  // Filtrage des balises par liste blanche.
  out = out.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*?)?)\s*(\/?)\s*>/g, (match, slash, tag, attrs) => {
    const t = String(tag).toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return '';
    if (slash) return `</${t}>`;
    if (t === 'a') {
      const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(attrs || '');
      const url = hrefMatch?.[1] ?? '';
      if (/^https?:\/\//i.test(url)) {
        return `<a href="${url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">`;
      }
      return '<a>';
    }
    if (t === 'br') return '<br>';
    return `<${t}>`;
  });

  // Échappe les « < » orphelins restants.
  out = out.replace(/<(?![a-zA-Z/])/g, '&lt;');
  return out;
}
