# Express Track Dashboard

Standalone tracking dashboard for **Peggy Palmer** and **Anita Vincent**.

## Shipments (mid-route · ~50%)

| Recipient | Tracking | Destination | Status |
|-----------|----------|-------------|--------|
| Peggy Palmer | `11881-87236-402382053` | 1201 Thomas Blvd, Elizabethton, TN 37643 | In Transit · halfway |
| Anita Vincent | `48291-55307-918274036` | 4817 Friendly St | In Transit · halfway |

## Status model

Both packages are **half of the way**:

1. Label Created (done)
2. Picked Up (done)
3. Departed Origin Facility — Houston, TX (done)
4. **Arrived at Regional Hub** ← current
5. Out for Delivery (pending)
6. Delivered (pending)

## Deploy

This is a static `index.html`. Deploy on Vercel, Netlify, or GitHub Pages.

```bash
npx vercel --yes
```

Repo: https://github.com/appycody58-byte/express-track-dashboard
