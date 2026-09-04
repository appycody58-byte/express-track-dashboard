# Express Track Dashboard

Standalone **mid-route** tracking dashboard for **Peggy Palmer** and **Anita Vincent**, with **EasyPost Tracker** live refresh when a real carrier tracking number is available.

## Shipments (~50% · half of the way)

| Recipient | Tracking | Destination | Default status |
|-----------|----------|-------------|----------------|
| Peggy Palmer | `11881-87236-402382053` | 1201 Thomas Blvd, Elizabethton, TN 37643 | In Transit · Regional hub |
| Anita Vincent | `48291-55307-918274036` | 4817 Friendly St | In Transit · Regional hub |

## EasyPost integration

1. Create an API key at [EasyPost](https://www.easypost.com/account/api-keys)
2. On Vercel: **Project → Settings → Environment Variables**
   - Name: `EASYPOST_API_KEY`
   - Value: your test or production key
3. Redeploy

### Behavior

| Tracking number | Result |
|-----------------|--------|
| Peggy / Anita registered TNs | Mid-route timeline (~50%) unless EasyPost has live events |
| Real UPS / FedEx / USPS / etc. | Live EasyPost Tracker events + progress |
| Unknown + no key | “Not found” message |

### API

```
GET /api/track?number=11881-87236-402382053
```

Response includes `status`, `progress`, `events[]`, `live`, `source`, `lastScan`, `eta`.

## Deploy

```bash
npx vercel --yes
```

Repo: https://github.com/appycody58-byte/express-track-dashboard
