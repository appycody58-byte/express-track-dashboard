# FedEx webhook integration

## Endpoint

```
POST https://express-track-dashboard.vercel.app/api/webhooks/fedex
GET  https://express-track-dashboard.vercel.app/api/webhooks/fedex
```

GET returns health + recent accepted events.

## FedEx Developer Portal setup

1. Sign in at [developer.fedex.com](https://developer.fedex.com/).
2. Create or open a project.
3. Enable **Advanced Integrated Visibility** (Shipment Visibility / Tracking Webhook).
4. Create a webhook destination:
   - URL: `https://express-track-dashboard.vercel.app/api/webhooks/fedex`
   - Method: POST
5. (Recommended) Configure a shared secret and set the same value in Vercel:

```
FEDEX_WEBHOOK_SECRET=your-long-random-secret
```

6. Subscribe by **FedEx account number** or associate **tracking numbers** to the webhook project.

Official docs: https://developer.fedex.com/api/en-us/catalog/shipment-visibility-webhook/docs.html

## Security

When `FEDEX_WEBHOOK_SECRET` is set, the handler accepts:

- Header `x-fedex-webhook-secret: <secret>`
- Header `x-webhook-secret: <secret>`
- `Authorization: Bearer <secret>`
- HMAC `x-fedex-signature-256: sha256=<hex>` of the raw body

If the env var is **not** set, the endpoint accepts all POSTs (demo only).

## Test without FedEx

```bash
curl -X POST https://express-track-dashboard.vercel.app/api/webhooks/fedex \
  -H "Content-Type: application/json" \
  -H "x-fedex-webhook-secret: YOUR_SECRET" \
  -d '{
    "trackingNumber": "11881-87236-402382053",
    "status": "In transit",
    "currentLocation": "NASHVILLE, TN US",
    "events": [
      {
        "title": "At local FedEx facility",
        "loc": "NASHVILLE, TN US",
        "time": "Mon, Sep 7, 10:00 AM"
      }
    ]
  }'
```

Then track:

```bash
curl "https://express-track-dashboard.vercel.app/api/track?number=11881-87236-402382053"
```

Webhook data overrides the demo mid-route fallback for that tracking number (on the same warm serverless instance).

## Production note

Status is stored in memory (`globalThis`). On Vercel this can reset when the function goes cold. For durable updates use Vercel KV, Redis, or a database and swap `api/lib/store.js`.
