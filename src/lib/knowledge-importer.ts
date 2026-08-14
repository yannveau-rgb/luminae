/** Moteur d'importation et de segmentation intelligente de fichiers pour la Base de Connaissances RAG. */

export interface ParsedArticle {
  title: string;
  content: string;
  category: string;
  tags: string[];
}

/**
 * Nettoie une chaîne de texte.
 */
function clean(str?: string | null): string {
  return (str ?? '').trim();
}

/**
 * Parse un fichier JSON de base de connaissances.
 */
export function parseJsonKnowledge(raw: string): ParsedArticle[] {
  const data = JSON.parse(raw);
  const items: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data.articles)
      ? data.articles
      : Array.isArray(data.faqs)
        ? data.faqs
        : Array.isArray(data.items)
          ? data.items
          : [data];

  const results: ParsedArticle[] = [];

  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const obj = item as Record<string, unknown>;
    const title = clean(String(obj.title ?? obj.titre ?? obj.question ?? obj.name ?? ''));
    const content = clean(String(obj.content ?? obj.contenu ?? obj.answer ?? obj.reponse ?? obj.body ?? ''));
    const category = clean(String(obj.category ?? obj.categorie ?? obj.section ?? 'Général')) || 'Général';
    
    let tags: string[] = [];
    if (Array.isArray(obj.tags)) {
      tags = obj.tags.map((t) => clean(String(t))).filter(Boolean);
    } else if (typeof obj.tags === 'string') {
      tags = obj.tags.split(',').map((t) => clean(t)).filter(Boolean);
    }

    if (title && content) {
      results.push({ title, content, category, tags });
    }
  }

  return results;
}

/**
 * Parse un fichier CSV / TSV.
 */
export function parseCsvKnowledge(raw: string): ParsedArticle[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Détecte le séparateur (point-virgule ou virgule ou tabulation)
  const firstLine = lines[0];
  const sep = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';

  // Parse headers
  const headers = firstLine.split(sep).map((h) => clean(h).toLowerCase().replace(/['"]/g, ''));
  const titleIdx = headers.findIndex((h) => h.includes('titre') || h.includes('title') || h.includes('question'));
  const contentIdx = headers.findIndex((h) => h.includes('contenu') || h.includes('content') || h.includes('reponse') || h.includes('answer') || h.includes('body'));
  const categoryIdx = headers.findIndex((h) => h.includes('categorie') || h.includes('category') || h.includes('section'));
  const tagsIdx = headers.findIndex((h) => h.includes('tag') || h.includes('etiquette') || h.includes('mot-cle'));

  const results: ParsedArticle[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Split simple en respectant les guillemets basiques
    const cols = line.split(sep).map((c) => clean(c).replace(/^["']|["']$/g, ''));
    const title = titleIdx !== -1 ? cols[titleIdx] : cols[0];
    const content = contentIdx !== -1 ? cols[contentIdx] : cols[1];
    const category = (categoryIdx !== -1 && cols[categoryIdx]) ? cols[categoryIdx] : 'Général';
    const rawTags = tagsIdx !== -1 && cols[tagsIdx] ? cols[tagsIdx] : '';
    const tags = rawTags ? rawTags.split(',').map((t) => clean(t)).filter(Boolean) : [];

    if (title && content) {
      results.push({ title, content, category, tags });
    }
  }

  return results;
}

/**
 * Parse et segmente un document Markdown (.md) par titres (# ou ## ou ### ou ---).
 */
export function parseMarkdownKnowledge(raw: string): ParsedArticle[] {
  const lines = raw.split(/\r?\n/);
  const sections: { title: string; lines: string[]; category?: string }[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];
  let mainDocTitle = '';

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    const hrMatch = line.trim() === '---' || line.trim() === '___';

    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = clean(headingMatch[2]).replace(/\*\*/g, '');

      if (level === 1 && !mainDocTitle) {
        mainDocTitle = headingText;
      }

      if (currentTitle && currentLines.join('\n').trim()) {
        sections.push({
          title: currentTitle,
          lines: currentLines,
          category: mainDocTitle || 'Documentation'
        });
        currentLines = [];
      }

      currentTitle = headingText;
    } else if (hrMatch && currentTitle && currentLines.join('\n').trim()) {
      sections.push({
        title: currentTitle,
        lines: currentLines,
        category: mainDocTitle || 'Documentation'
      });
      currentTitle = '';
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentTitle && currentLines.join('\n').trim()) {
    sections.push({
      title: currentTitle,
      lines: currentLines,
      category: mainDocTitle || 'Documentation'
    });
  }

  // Si aucun titre n'a été trouvé (texte brut ou non titré), on crée un article unique ou par paragraphes
  if (sections.length === 0 && raw.trim().length > 0) {
    return parseTextKnowledge(raw);
  }

  return sections.map((s) => ({
    title: s.title,
    content: clean(s.lines.join('\n')),
    category: s.category ?? 'Documentation',
    tags: []
  })).filter((a) => a.title && a.content);
}

/**
 * Parse un document texte (.txt) ou FAQ textuelle.
 */
export function parseTextKnowledge(raw: string): ParsedArticle[] {
  // Détection de blocs Q: / R: ou Question / Réponse
  const qaRegex = /(?:Q(?:uestion)?\s*[:\-\)]\s*([^\n\r]+))\s*(?:R(?:éponse|eponse)?\s*[:\-\)]\s*([\s\S]+?))(?=(?:Q(?:uestion)?\s*[:\-\)]|$))/gi;
  const qaMatches = Array.from(raw.matchAll(qaRegex));

  if (qaMatches.length > 0) {
    return qaMatches.map((m) => ({
      title: clean(m[1]),
      content: clean(m[2]),
      category: 'FAQ',
      tags: []
    })).filter((a) => a.title && a.content);
  }

  // Découpage par double saut de ligne si paragraphes séparés
  const blocks = raw.split(/\n\s*\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length > 1) {
    return blocks.map((b, idx) => {
      const firstLine = b.split('\n')[0].replace(/^[#\-*\d\.]+\s*/, '').trim();
      const body = b.substring(firstLine.length).trim() || b;
      return {
        title: firstLine.slice(0, 100) || `Section ${idx + 1}`,
        content: body,
        category: 'Guide',
        tags: []
      };
    }).filter((a) => a.title && a.content);
  }

  // Document unique
  const firstLine = raw.split('\n')[0].trim().slice(0, 100) || 'Article de Base de Connaissances';
  return [
    {
      title: firstLine,
      content: raw.trim(),
      category: 'Général',
      tags: []
    }
  ];
}

/**
 * Fonction maîtresse : parse automatiquement tout contenu selon son type / nom de fichier.
 */
export function parseKnowledgeFile(content: string, fileName?: string): ParsedArticle[] {
  const name = (fileName ?? '').toLowerCase();
  const trimmed = content.trim();

  if (name.endsWith('.json') || (trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      return parseJsonKnowledge(content);
    } catch {
      // repli
    }
  }

  if (name.endsWith('.csv') || name.endsWith('.tsv')) {
    return parseCsvKnowledge(content);
  }

  if (name.endsWith('.md') || content.includes('# ') || content.includes('## ')) {
    return parseMarkdownKnowledge(content);
  }

  return parseTextKnowledge(content);
}
