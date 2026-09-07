/**
 * FedEx Advanced Integrated Visibility (Shipment Visibility) webhook receiver.
 *
 * Setup (FedEx Developer Portal):
 * 1. Create project → enable Advanced Integrated Visibility / Tracking Webhook
 * 2. Set destination URL to: https://YOUR_DOMAIN/api/webhooks/fedex
 * 3. Optionally set a shared secret; store as FEDEX_WEBHOOK_SECRET in Vercel
 * 4. Subscribe by account number or associate tracking numbers via FedEx UI/API
 *
 * Docs: https://developer.fedex.com/api/en-us/catalog/shipment-visibility-webhook/docs.html
 *
 * Test without FedEx:
 *   POST /api/webhooks/fedex
 *   Header: x-fedex-webhook-secret: <same as FEDEX_WEBHOOK_SECRET if set>
 *   Body: { "trackingNumber": "11881-87236-402382053", "status": "In transit",
 *           "currentLocation": "NASHVILLE, TN US",
 *           "events": [{ "title": "At local FedEx facility", "loc": "NASHVILLE, TN US", "time": "..." }] }
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { upsertFromWebhook, listRecentWebhookEvents } from '../lib/store.js';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySecret(req, rawBody) {
  const secret = process.env.FEDEX_WEBHOOK_SECRET;
  if (!secret) return { ok: true, mode: 'open' }; // no secret configured

  const headerSecret =
    req.headers['x-fedex-webhook-secret'] ||
    req.headers['x-webhook-secret'] ||
    req.headers['x-fedex-signature'] ||
    '';

  // Simple shared-secret header (common in portal test setups)
  if (headerSecret && headerSecret === secret) {
    return { ok: true, mode: 'header-secret' };
  }

  // HMAC-SHA256 of body if FedEx sends signature header
  const sig =
    req.headers['x-fedex-signature-256'] ||
    req.headers['x-hub-signature-256'] ||
    '';
  if (sig && rawBody) {
    const expected =
      'sha256=' +
      createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      const a = Buffer.from(String(sig));
      const b = Buffer.from(expected);
      if (a.length === b.length && timingSafeEqual(a, b)) {
        return { ok: true, mode: 'hmac' };
      }
    } catch (_) {
      /* fall through */
    }
  }

  // Authorization: Bearer <secret>
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${secret}`) {
    return { ok: true, mode: 'bearer' };
  }

  return { ok: false, mode: 'rejected' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-fedex-webhook-secret, x-webhook-secret, x-fedex-signature, x-fedex-signature-256'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Health / recent events (no secret required for GET in demo; lock down in production)
  if (req.method === 'GET') {
    return res.status(200).json({
      service: 'FedEx webhook receiver',
      status: 'ok',
      secretConfigured: Boolean(process.env.FEDEX_WEBHOOK_SECRET),
      recent: listRecentWebhookEvents()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let raw;
  let body;
  try {
    // Vercel often pre-parses JSON; prefer req.body when present
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) {
      body = req.body;
      raw = Buffer.from(JSON.stringify(req.body));
    } else if (typeof req.body === 'string') {
      raw = Buffer.from(req.body);
      body = JSON.parse(req.body || '{}');
    } else {
      raw = await readRawBody(req);
      body = raw.length ? JSON.parse(raw.toString('utf8') || '{}') : {};
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body', detail: e.message });
  }

  const auth = verifySecret(req, raw);
  if (!auth.ok) {
    return res.status(401).json({ error: 'Unauthorized webhook' });
  }

  // FedEx may send a challenge / validation ping
  if (body.challenge || body.validationCode || body.type === 'VALIDATION') {
    return res.status(200).json({
      accepted: true,
      challenge: body.challenge || body.validationCode || true
    });
  }

  const result = upsertFromWebhook(body);

  if (!result.ok) {
    // Still 200 so FedEx does not retry endlessly on our mapping issues
    return res.status(200).json({
      accepted: false,
      error: result.error,
      authMode: auth.mode
    });
  }

  return res.status(200).json({
    accepted: true,
    authMode: auth.mode,
    trackingNumber: result.record.trackingNumber,
    status: result.record.status,
    progress: result.record.progress,
    updatedAt: result.record.updatedAt
  });
}
