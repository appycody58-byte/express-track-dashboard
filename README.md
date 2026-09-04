# Global Express Tracking

Professional shipment tracking pages. **Peggy Palmer is the primary shipment** (home page). Anita Vincent has a separate page.

## Pages

| Page | URL path | Tracking |
|------|----------|----------|
| **Peggy Palmer (primary)** | `/` or `/index.html` | `11881-87236-402382053` |
| Anita Vincent | `/anita.html` | `48291-55307-918274036` |

## Status model (registered network)

Early transit **~20%** — East Texas corridor after a late departure from Houston toward Tennessee.

## API

```
GET /api/track?number=11881-87236-402382053
```

Optional: set `EASYPOST_API_KEY` on Vercel for live carrier tracking on real numbers.

## Live

https://express-track-dashboard.vercel.app
