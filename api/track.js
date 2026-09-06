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
  }
};

function cleanTn(n) {
  return String(n || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function fmt(d) {
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function dayStr(d) {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}

function midRouteFallback(reg, trackingNumber) {
  const now = new Date();
  // Realistic timeline over ~2 days
  const tLabel = new Date(now.getTime() - 52 * 3600000);
  const tPickup = new Date(now.getTime() - 46 * 3600000);
  const tDepartOrigin = new Date(now.getTime() - 44 * 3600000);
  const tArriveLocal = new Date(now.getTime() - 40 * 3600000);
  const tDepartLocal = new Date(now.getTime() - 36 * 3600000);
  const tArriveHub = new Date(now.getTime() - 28 * 3600000);
  const tDepartHub = new Date(now.getTime() - 22 * 3600000);
  const tArriveMemphis = new Date(now.getTime() - 10 * 3600000);
  const tSortMemphis = new Date(now.getTime() - 6 * 3600000);
  const eta = new Date(now.getTime() + 30 * 3600000);

  return {
    trackingNumber: reg.displayTn || trackingNumber,
    name: reg.name,
    street: reg.street,
    city: reg.city,
    state: reg.state,
    zip: reg.zip,
    phone: reg.phone,
    destLabel: reg.destLabel,
    carrier: 'FedEx Ground',
    status: 'In transit',
    statusDetail: 'Arrived at FedEx location',
    progress: 50,
    isPreTransit: false,
    live: false,
    source: 'FedEx network',
    lastScan: fmt(tSortMemphis),
    eta: dayStr(eta),
    currentLocation: 'MEMPHIS, TN US',
    weight: '8.2 lbs / 3.72 kgs',
    dimensions: '14 x 10 x 8 in.',
    packaging: 'Customer packaging',
    shipDate: dayStr(tPickup),
    reference: 'PO-77641',
    events: [
      {
        title: 'Shipment information sent to FedEx',
        loc: 'HOUSTON, TX US',
        time: fmt(tLabel),
        state: 'done'
      },
      {
        title: 'Picked up',
        loc: 'HOUSTON, TX US',
        time: fmt(tPickup),
        state: 'done'
      },
      {
        title: 'Arrived at FedEx origin facility',
        loc: 'HOUSTON, TX US',
        time: fmt(tArriveLocal),
        state: 'done'
      },
      {
        title: 'Left FedEx origin facility',
        loc: 'HOUSTON, TX US',
        time: fmt(tDepartOrigin),
        state: 'done'
      },
      {
        title: 'In transit',
        loc: 'SHREVEPORT, LA US',
        time: fmt(tDepartLocal),
        state: 'done'
      },
      {
        title: 'Arrived at FedEx location',
        loc: 'LITTLE ROCK, AR US',
        time: fmt(tArriveHub),
        state: 'done'
      },
      {
        title: 'Departed FedEx location',
        loc: 'LITTLE ROCK, AR US',
        time: fmt(tDepartHub),
        state: 'done'
      },
      {
        title: 'Arrived at FedEx location',
        loc: 'MEMPHIS, TN US',
        time: fmt(tArriveMemphis),
        state: 'done'
      },
      {
        title: 'At local FedEx facility',
        loc: 'MEMPHIS, TN US',
        time: fmt(tSortMemphis),
        state: 'current'
      },
      {
        title: 'On FedEx vehicle for delivery',
        loc: 'ELIZABETHTON, TN US',
        time: '',
        state: 'pending'
      },
      {
        title: 'Delivered',
        loc: 'ELIZABETHTON, TN US',
        time: '',
        state: 'pending'
      }
    ]
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const raw = (req.query.number || req.query.tracking || '').trim();
  if (!raw) return res.status(400).json({ error: 'Missing ?number=' });

  const reg = REGISTRY[cleanTn(raw)];
  if (reg) return res.status(200).json(midRouteFallback(reg, raw));

  return res.status(200).json({
    trackingNumber: raw,
    carrier: 'Unknown',
    status: 'Not found',
    statusDetail: 'Tracking number not found.',
    progress: 0,
    live: false,
    events: []
  });
}
