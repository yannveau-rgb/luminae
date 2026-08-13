/**
 * Émission d'événements Realtime « Broadcast » vers les clients connectés.
 * Appelée côté serveur (clé service role). Les topics sont préfixés par
 * `realtime:` côté Supabase ; les clients s'abonnent avec supabase.channel(topic).
 *
 * Canaux utilisés :
 *  - conv:{conversationId} → messages, statut, saisie (widget + agents)
 *  - inbox:all             → mise à jour de la boîte de réception
 *  - agent:{agentId}       → notifications personnelles
 */
export async function broadcast(topic: string, event: string, payload: unknown): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${service}`
      },
      body: JSON.stringify({
        messages: [{ topic: `realtime:${topic}`, event, payload }]
      })
    });
  } catch (err) {
    // Le temps réel ne doit jamais faire échouer une route API.
    console.error('[broadcast] échec', err);
  }
}
