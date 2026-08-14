/**
 * Contrôle d'origine sur les routes mutantes.
 *
 * Les routes qui lisent du JSON sont protégées de fait : un formulaire tiers ne
 * peut pas envoyer `application/json` sans préflight CORS, que le navigateur
 * bloque. `/api/agent/attachments` accepte en revanche du
 * `multipart/form-data`, un type autorisé SANS préflight : un formulaire hébergé
 * ailleurs pouvait donc déclencher un téléversement au nom d'un agent connecté.
 * Seul le `SameSite` par défaut du cookie Supabase s'y opposait (constat S-13).
 *
 * Politique retenue : un en-tête `Origin` présent doit correspondre à l'hôte de
 * la requête. Absent, on laisse passer — les appels serveur à serveur et les
 * outils en ligne de commande n'en envoient pas, tandis qu'un navigateur en
 * envoie toujours sur une requête POST. Le vecteur d'attaque est donc couvert
 * sans casser les usages légitimes.
 */
export function origineEtrangere(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false; // pas un navigateur, ou requête same-origin sans en-tête

  let hoteOrigine: string;
  try {
    hoteOrigine = new URL(origin).host;
  } catch {
    return true; // en-tête illisible : on refuse
  }

  const hotes = new Set<string>();
  const host = req.headers.get('host');
  if (host) hotes.add(host);

  // Utile derrière un proxy qui réécrit `Host`.
  const configuree = process.env.NEXT_PUBLIC_APP_URL;
  if (configuree) {
    try {
      hotes.add(new URL(configuree).host);
    } catch {
      /* variable mal formée : ignorée */
    }
  }

  return !hotes.has(hoteOrigine);
}
