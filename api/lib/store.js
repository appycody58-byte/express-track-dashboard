/**
 * In-memory tracking store for webhook updates.
 * On Vercel serverless this persists only within a warm instance.
 * For production, replace with Redis / Vercel KV / a database.
 */

const g = globalThis;

if (!g.__fxTrackStore) {
  g.__fxTrackStore = {
    byTracking: Object.create(null),
    events: [] // last N webhook payloads for debugging
  };
}

const MAX_EVENTS = 50;

export function cleanTn(n) {
  return String(n || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function getByTracking(trackingNumber) {
  const key = cleanTn(trackingNumber);
  return g.__fxTrackStore.byTracking[key] || null;
}

export function upsertFromWebhook(payload) {
  const normalized = normalizeFedExWebhook(payload);
  if (!normalized.trackingNumber) {
    return { ok: false, error: 'No tracking number in payload' };
  }

  const key = cleanTn(normalized.trackingNumber);
  const prev = g.__fxTrackStore.byTracking[key] || {};

  const merged = {
    ...prev,
    ...normalized,
    events: mergeEvents(prev.events, normalized.events),
    updatedAt: new Date().toISOString(),
    source: 'FedEx webhook'
  };

  g.__fxTrackStore.byTracking[key] = merged;

  g.__fxTrackStore.events.unshift({
    at: merged.updatedAt,
    trackingNumber: merged.trackingNumber,
    status: merged.status
  });
  if (g.__fxTrackStore.events.length > MAX_EVENTS) {
    g.__fxTrackStore.events.length = MAX_EVENTS;
  }

  return { ok: true, record: merged };
}

function mergeEvents(prev, next) {
  const a = Array.isArray(prev) ? prev : [];
  const b = Array.isArray(next) ? next : [];
  if (!b.length) return a;
  if (!a.length) return b;
  // Prefer webhook as newest-first if it sent a full list
  const seen = new Set();
  const out = [];
  for (const e of [...b, ...a]) {
    const id = (e.title || '') + '|' + (e.time || '') + '|' + (e.loc || '');
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(e);
  }
  return out.slice(0, 40);
}

/**
 * Accept common FedEx webhook / Track API shaped payloads.
 * FedEx Advanced Integrated Visibility payloads vary by subscription;
 * this normalizer is defensive.
 */
export function normalizeFedExWebhook(body) {
  const root = body?.output || body?.body || body || {};
  const results =
    root.completeTrackResults ||
    root.trackResults ||
    root.trackingInfo ||
    (Array.isArray(root) ? root : null);

  let piece = null;
  if (Array.isArray(results) && results[0]) {
    piece = results[0].trackResults?.[0] || results[0].completeTrackResults?.[0] || results[0];
  } else if (root.trackResult || root.shipment) {
    piece = root.trackResult || root.shipment;
  } else if (root.trackingNumber || root.tracking_number) {
    piece = root;
  }

  // Flat test / simplified payload
  if (!piece && (body.trackingNumber || body.tracking_number)) {
    piece = body;
  }

  if (!piece) {
    return { trackingNumber: '', status: '', events: [] };
  }

  const tn =
    piece.trackingNumber ||
    piece.tracking_number ||
    piece.trackingNumberInfo?.trackingNumber ||
    piece.trackingInfo?.trackingNumber ||
    body.trackingNumber ||
    '';

  const statusDesc =
    piece.latestStatusDetail?.description ||
    piece.latestStatusDetail?.statusByLocale ||
    piece.statusDetail?.description ||
    piece.status ||
    piece.derivedStatus ||
    body.status ||
    'In transit';

  const statusCode =
    piece.latestStatusDetail?.code ||
    piece.statusDetail?.code ||
    body.statusCode ||
    '';

  const scans =
    piece.scanEvents ||
    piece.scans ||
    piece.events ||
    body.scanEvents ||
    body.events ||
    [];

  const events = (Array.isArray(scans) ? scans : []).map((s, i) => {
    const title =
      s.eventDescription ||
      s.description ||
      s.status ||
      s.title ||
      'Update';
    const loc = [s.scanLocation?.city, s.scanLocation?.stateOrProvinceCode, s.scanLocation?.countryCode]
      .filter(Boolean)
      .join(', ') ||
      s.location ||
      s.loc ||
      '';
    const time = s.date || s.timestamp || s.time || '';
    return {
      title,
      loc,
      time: typeof time === 'string' ? time : '',
      state: i === 0 ? 'current' : 'done'
    };
  });

  const locFromStatus =
    piece.latestStatusDetail?.scanLocation?.city ||
    piece.lastUpdatedDestinationAddress?.city ||
    body.currentLocation ||
    (events[0] && events[0].loc) ||
    '';

  const progress = progressFromCode(statusCode, statusDesc);

  return {
    trackingNumber: String(tn),
    status: String(statusDesc).replace(/_/g, ' '),
    statusDetail: statusDesc,
    statusCode,
    currentLocation: locFromStatus,
    progress,
    eta:
      piece.dateAndTimes?.find?.((d) => d.type === 'ESTIMATED_DELIVERY')?.dateTime ||
      piece.estimatedDeliveryTimestamp ||
      body.eta ||
      '',
    carrier: 'FedEx Ground',
    events,
    live: true
  };
}

function progressFromCode(code, desc) {
  const s = `${code} ${desc}`.toLowerCase();
  if (/dl|deliver/.test(s) && !/out|attempt|exception|fail/.test(s)) return 100;
  if (/od|out.?for.?delivery/.test(s)) return 85;
  if (/it|transit|arrived|depart|facility|hub/.test(s)) return 50;
  if (/pu|pick/.test(s)) return 20;
  if (/oc|label|info|created|pre/.test(s)) return 10;
  return 50;
}

export function listRecentWebhookEvents() {
  return g.__fxTrackStore.events.slice(0, 20);
}
