// Vercel serverless — EasyPost Tracker + early-route (~20%) fallback for registered TNs

const REGISTRY = {
  '1188187236402382053': {
    name: 'Peggy Palmer',
    street: '1201 Thomas Blvd',
    city: 'Elizabethton',
    state: 'TN',
    zip: '37643',
    phone: '423.491-0319',
    displayTn: '11881-87236-402382053',
    destLabel: 'Elizabethton, TN'
  },
  '4829155307918274036': {
    name: 'Anita Vincent',
    street: '4817 Friendly St',
    city: '',
    state: '',
    zip: '',
    phone: '',
    displayTn: '48291-55307-918274036',
    destLabel: '4817 Friendly St'
  }
};

function cleanTn(n) {
  return String(n || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function fmt(d) {
  return d.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function dayStr(d) {
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/** Early route (~20%) — ~7 hours from Houston, Texarkana corridor, checkpoint 2 */
function earlyRouteFallback(reg, trackingNumber) {
  const now = new Date();
  const t0 = new Date(now.getTime() - 36 * 3600000);
  const t1 = new Date(now.getTime() - 32 * 3600000);
  const t2 = new Date(now.getTime() - 30 * 3600000);
  const t3 = new Date(now.getTime() - 4 * 3600000);
  const eta = new Date(now.getTime() + 48 * 3600000);

  return {
    trackingNumber: reg.displayTn || trackingNumber,
    name: reg.name,
    street: reg.street,
    city: reg.city,
    state: reg.state,
    zip: reg.zip,
    phone: reg.phone,
    destLabel: reg.destLabel,
    carrier: 'Global Express',
    status: 'In Transit',
    statusDetail: 'Second checkpoint · approx. 7 hours from origin',
    progress: 20,
    isPreTransit: false,
    live: false,
    source: 'Registered network (~20% complete · 80% remaining)',
    lastScan: fmt(t3),
    eta: dayStr(eta),
    currentLocation: 'Texarkana, TX / AR corridor',
    events: [
      { title: 'Label Created', loc: 'Houston, TX US', time: fmt(t0), state: 'done' },
      { title: 'Picked Up', loc: 'Houston, TX', time: fmt(t1), state: 'done' },
      { title: 'Departed Origin Facility', loc: 'Houston, TX', time: fmt(t2), state: 'done' },
      {
        title: 'In Transit — Checkpoint 2',
        loc: 'Texarkana, TX / AR corridor · approx. 7 hours from Houston',
        time: fmt(t3),
        state: 'current'
      },
      { title: 'Out for Delivery', loc: reg.destLabel, time: '', state: 'pending' },
      { title: 'Delivered', loc: reg.destLabel, time: '', state: 'pending' }
    ]
  };
}

function progressFromStatus(status) {
  const s = (status || '').toLowerCase();
  if (/deliver/.test(s) && !/out|attempt|fail/.test(s)) return 100;
  if (/out.?for.?delivery|out_for_delivery/.test(s)) return 85;
  if (/in.?transit|transit|departed|arrived|hub|facility/.test(s)) return 50;
  if (/pre.?transit|label|unknown|info.?received|created/.test(s)) return 10;
  if (/return|exception|failure|fail/.test(s)) return 40;
  return 50;
}

function mapEasyPostEvents(details) {
  const list = (details || []).slice().reverse();
  return list.map((d, i) => {
    const title = (d.status || d.message || 'Update').replace(/_/g, ' ');
    const loc = [d.tracking_location?.city, d.tracking_location?.state, d.tracking_location?.country]
      .filter(Boolean)
      .join(', ');
    const time = d.datetime
      ? new Date(d.datetime).toLocaleString('en-US', {
          month: 'numeric',
          day: 'numeric',
          year: '2-digit',
          hour: 'numeric',
          minute: '2-digit'
        })
      : '';
    let state = 'done';
    if (i === 0) state = 'current';
    return { title, loc, time, state, desc: d.message || '' };
  });
}

async function trackEasyPost(trackingCode) {
  const key = process.env.EASYPOST_API_KEY;
  if (!key) return null;

  const auth = Buffer.from(`${key}:`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json'
  };

  let tracker = null;
  const createRes = await fetch('https://api.easypost.com/v2/trackers', {
    method: 'POST',
    headers,
    body: JSON.stringify({ tracker: { tracking_code: trackingCode } })
  });

  if (createRes.ok) {
    tracker = await createRes.json();
  } else {
    const listRes = await fetch(
      `https://api.easypost.com/v2/trackers?tracking_code=${encodeURIComponent(trackingCode)}`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    if (listRes.ok) {
      const list = await listRes.json();
      tracker = list.trackers?.[0] || null;
    }
  }

  if (!tracker || !tracker.tracking_code) return null;

  const status = tracker.status || tracker.status_detail || 'unknown';
  const events = mapEasyPostEvents(tracker.tracking_details);
  if (events.length && !events.some((e) => e.state === 'current')) {
    events[0].state = 'current';
  }

  const last = events[0];
  return {
    trackingNumber: tracker.tracking_code,
    carrier: tracker.carrier || 'EasyPost',
    status: String(status).replace(/_/g, ' '),
    statusDetail: tracker.status_detail || status,
    progress: progressFromStatus(status),
    isPreTransit: /pre.?transit|unknown|label/i.test(status),
    live: true,
    source: 'EasyPost Tracker',
    lastScan: last?.time || '',
    eta: tracker.est_delivery_date ? dayStr(new Date(tracker.est_delivery_date)) : '',
    events,
    mode: tracker.mode
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const raw = (req.query.number || req.query.tracking || '').trim();
  if (!raw) {
    return res.status(400).json({ error: 'Missing ?number=' });
  }

  const cleaned = cleanTn(raw);
  const reg = REGISTRY[cleaned];

  try {
    const live = await trackEasyPost(cleaned);
    if (live && live.live && live.events?.length) {
      if (reg) {
        live.name = reg.name;
        live.street = reg.street;
        live.city = reg.city;
        live.state = reg.state;
        live.zip = reg.zip;
        live.phone = reg.phone;
        live.destLabel = reg.destLabel;
        live.trackingNumber = reg.displayTn || live.trackingNumber;
      }
      return res.status(200).json(live);
    }
  } catch (e) {
    console.error('EasyPost track error', e.message);
  }

  if (reg) {
    return res.status(200).json(earlyRouteFallback(reg, raw));
  }

  return res.status(200).json({
    trackingNumber: raw,
    carrier: 'Unknown',
    status: 'Not found',
    statusDetail: 'No tracker data. Add EASYPOST_API_KEY for live carrier tracking.',
    progress: 0,
    live: false,
    source: 'No data',
    lastScan: '',
    eta: '',
    events: []
  });
}
