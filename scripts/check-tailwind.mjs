#!/usr/bin/env node
/**
 * Vérification statique des classes Tailwind spécifiques au système Lumen.
 *
 * Tailwind ignore silencieusement les classes inexistantes (ex. `mist-50` quand
 * il n'existait pas encore, ou `glow` non défini). Ce script extrait les tokens
 * de classes utilisés dans `src/` et vérifie qu'aucun ton inexistant des palettes
 * Lumen (ink, lagoon, aurora, sun, coral, mist) ou ombre n'est invoqué par erreur.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC_DIR = resolve('src');

// Palette exacte définie dans tailwind.config.ts
const VALID_COLORS = {
  ink: new Set(['DEFAULT', '950', '900', '800', '700', '600', '500', '400', '300']),
  lagoon: new Set(['DEFAULT', '700', '600', '500', '400', '300', '200', '100', '50']),
  aurora: new Set(['DEFAULT', '600', '500', '400', '300', '100']),
  sun: new Set(['DEFAULT', '700', '600', '500', '300', '100', '50']),
  coral: new Set(['DEFAULT', '600', '500', '300', '100', '50']),
  mist: new Set(['DEFAULT', '600', '500', '400', '300', '200', '100', '50'])
};

const VALID_SHADOWS = new Set(['panel', 'bubble', 'glow-sm', 'glow', 'halo']);

function getFiles(dir) {
  const entries = readdirSync(dir);
  let results = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(full));
    } else if (/\.(tsx?|jsx?|css)$/.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

const colorPrefixes = ['text', 'bg', 'border', 'ring', 'fill', 'stroke', 'from', 'via', 'to', 'placeholder', 'accent'];
const classPattern = /(?:[a-z0-9_-]+:)*([a-z]+)-([a-z]+)(?:-([0-9]+))?(?:\/([0-9]+))?/g;
const shadowPattern = /(?:[a-z0-9_-]+:)*shadow-([a-z0-9_-]+)/g;

let errors = 0;
const files = getFiles(SRC_DIR);

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  const relPath = file.replace(resolve('.') + '\\', '').replace(resolve('.') + '/', '');

  let match;
  while ((match = classPattern.exec(content)) !== null) {
    const [fullMatch, prefix, colorName, shade] = match;
    if (colorPrefixes.includes(prefix) && VALID_COLORS[colorName]) {
      const targetShade = shade || 'DEFAULT';
      if (!VALID_COLORS[colorName].has(targetShade)) {
        console.error(`❌ [Tailwind] Classe inexistante "${fullMatch}" dans ${relPath} (ton "${targetShade}" non défini pour "${colorName}")`);
        errors++;
      }
    }
  }

  let sMatch;
  while ((sMatch = shadowPattern.exec(content)) !== null) {
    const shadowName = sMatch[1];
    const standardShadows = new Set(['sm', 'md', 'lg', 'xl', '2xl', 'inner', 'none']);
    if (!standardShadows.has(shadowName) && !VALID_SHADOWS.has(shadowName)) {
      console.error(`❌ [Tailwind] Ombre personnalisée inconnue "shadow-${shadowName}" dans ${relPath}`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\nTotal : ${errors} classe(s) Tailwind invalide(s) détectée(s).`);
  process.exit(1);
} else {
  console.log(`✅ [Tailwind] Toutes les classes personnalisées de ${files.length} fichiers sont conformes au thème Lumen.`);
}
