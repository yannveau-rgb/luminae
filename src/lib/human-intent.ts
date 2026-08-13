/** Détection simple de l'intention « parler à un humain » (FR + EN). */

const PATTERNS: RegExp[] = [
  /parler\s+(?:à|a|avec)\s+(?:un\s+|une\s+|quelqu'un|qqn)?\s*(?:humain|agent|personne|conseiller|opérateur|operateur|expert|humaine)/i,
  /(je\s+(?:voudrais|veux|souhaite)|j'aimerais)\s+(?:parler\s+(?:à|a|avec)\s+)?(?:un\s+|une\s+)?(?:agent|humain|personne|conseiller)/i,
  /(?:agent|conseiller|support|assistance)\s+humain/i,
  /passer\s+(?:à|a)\s+un\s+(?:agent|humain)/i,
  /transf[ée]r[ée]?\w*\s+(?:à|a)\s+un\s+agent/i,
  /\bparler\s+à\s+qqn\b/i,
  /\bvoir\s+un\s+humain\b/i,
  /talk\s+to\s+(a\s+)?(human|agent|person|someone)/i,
  /\bhuman\s+(agent|support|please)\b/i,
  /^agent$/i,
  /^humain$/i
];

export function wantsHumanAgent(text: string): boolean {
  const t = text.trim();
  if (t.length > 400) return false; // évite les faux positifs sur les longs textes
  return PATTERNS.some((p) => p.test(t));
}
