import crypto from 'node:crypto';
import { env } from '../config/env.js';

const timeoutMs = 8_000;

export function n8nConfigured() {
  return Boolean(env.N8N_WEBHOOK_URL && env.N8N_WEBHOOK_SECRET);
}

export async function sendN8nEvent(event, payload = {}) {
  if (!n8nConfigured()) return { enabled: false };

  const timestamp = new Date().toISOString();
  const body = JSON.stringify({
    source: 'ostras',
    event,
    timestamp,
    data: payload,
  });
  const signature = crypto.createHmac('sha256', env.N8N_WEBHOOK_SECRET).update(body).digest('hex');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();

  try {
    const response = await fetch(env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ostras-event': event,
        'x-ostras-timestamp': timestamp,
        'x-ostras-signature': `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 240);
      throw new Error(`n8n returned ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    return { enabled: true, delivered: true };
  } finally {
    clearTimeout(timeout);
  }
}

export function notifyN8n(event, payload) {
  void sendN8nEvent(event, payload).catch((error) => {
    console.error(`Could not deliver ${event} to n8n:`, error.message);
  });
}
