import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/** POST /api/admin/webhooks/test — Envoie un ping de test vers l'URL spécifiée avec signature HMAC. */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    return NextResponse.json({ error: error.message ?? 'Accès refusé' }, { status: error.status ?? 403 });
  }

  const body = await request.json().catch(() => null);
  const { url, secret } = body ?? {};

  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return NextResponse.json({ error: 'URL de webhook invalide' }, { status: 400 });
  }

  const testPayload = {
    event: 'test.ping',
    created_at: new Date().toISOString(),
    platform: 'Luminae 2.0 (Made in France)',
    data: {
      message: 'Ping de test réussi depuis le cockpit d’administration Luminae.',
      timestamp: Date.now()
    }
  };

  const payloadString = JSON.stringify(testPayload);
  const signature = secret
    ? crypto.createHmac('sha256', secret).update(payloadString).digest('hex')
    : '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Luminae-Webhook-Bot/2.0',
        'X-Luminae-Signature': signature,
        'X-Luminae-Event': 'test.ping'
      },
      body: payloadString,
      signal: controller.signal
    });

    clearTimeout(timeout);

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      error: response.ok ? undefined : `Le serveur distant a répondu avec le statut HTTP ${response.status}`
    });
  } catch (fetchErr: unknown) {
    const error = fetchErr as { message?: string };
    return NextResponse.json({
      success: false,
      error: error.message ?? 'Délai d’attente dépassé ou erreur réseau lors du ping.'
    }, { status: 502 });
  }
}
