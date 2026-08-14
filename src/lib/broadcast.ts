/**
 * Émission d'événements Realtime « Broadcast » vers les clients connectés.
 * Appelée côté serveur (clé service role).
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
    // On diffuse sur le topic brut et le topic préfixé 'realtime:' pour garantir
    // la compatibilité à 100% avec toutes les versions du serveur Realtime Supabase.
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${service}`
      },
      body: JSON.stringify({
        messages: [
          { topic: `realtime:${topic}`, event, payload },
          { topic: topic, event, payload }
        ]
      })
    });
  } catch (err) {
    // Le temps réel ne doit jamais faire échouer une route API.
    console.error('[broadcast] échec', err);
  }
}
