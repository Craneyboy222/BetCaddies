# Railway Production Audit: BetCaddiesV2

**Date:** 2026-02-10
**Environment:** Production
**Railway Project:** BetCaddiesV2
**Branch:** BetCaddies/betc-optimal-engine
**Live URL:** https://betcaddiesapp-production.up.railway.app

---

## 1. LIVE STATUS

**Health endpoint:** `GET /health` → `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2026-02-10T20:40:02.029Z",
  "uptime": "13975s"
}
```
Server is running. Uptime ~3.9 hours at time of check.

---

## 2. DEPLOYMENT CONFIGURATION

### railway.toml
| Setting | Value | Assessment |
|---------|-------|------------|
| Builder | NIXPACKS | OK |
| Build command | `npm run build` | Runs Vite build for React SPA |
| Start command | `npm run server` | Runs `prisma migrate deploy && node src/server/index.js` |
| Health check path | `/health` | OK - DB-independent endpoint |
| Health check timeout | 300s (5 min) | Very generous; consider reducing to 60-120s |
| Restart policy | ON_FAILURE | OK |

### Procfile
```
web: npm run server
```
**Issue (LOW):** Redundant — `railway.toml` already specifies `startCommand`. Railway uses `railway.toml` when present. The Procfile is ignored but could cause confusion.

### package.json `server` script
```
prisma migrate deploy && node src/server/index.js
```
**Good:** Runs DB migrations automatically on every deploy before starting the server.

---

## 3. ENVIRONMENT VARIABLES

### Required for Core Functionality
| Variable | Used In | Status |
|----------|---------|--------|
| `DATABASE_URL` | Prisma (PostgreSQL) | **REQUIRED** - server won't start without it |
| `PORT` | Express server | Defaults to 3000, Railway injects automatically |
| `JWT_SECRET` | Auth (JWT signing) | **REQUIRED** - server warns if missing, auth fails |
| `ADMIN_EMAIL` | Admin login | **REQUIRED** for admin access |
| `ADMIN_PASSWORD` | Admin login (plaintext comparison) | **REQUIRED** for admin access |
| `DATAGOLF_API_KEY` | DataGolf API client | **REQUIRED** for pipeline |

### Required for Payments
| Variable | Used In | Status |
|----------|---------|--------|
| `STRIPE_SECRET_KEY` | Stripe SDK | Optional - Stripe features disabled if missing |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | Needed for subscription lifecycle |
| `STRIPE_SUCCESS_URL` | Checkout redirect | Needed for checkout flow |
| `STRIPE_CANCEL_URL` | Checkout redirect | Needed for checkout flow |

### Required for Media (R2/Cloudflare)
| Variable | Used In | Status |
|----------|---------|--------|
| `R2_ACCOUNT_ID` | S3Client endpoint | Optional - media upload disabled if missing |
| `R2_ACCESS_KEY_ID` | S3Client credentials | Optional |
| `R2_SECRET_ACCESS_KEY` | S3Client credentials | Optional |
| `R2_BUCKET` | PutObjectCommand | Optional |
| `R2_PUBLIC_BASE_URL` | Public URL generation | Optional |

### Optional Configuration
| Variable | Default | Used In |
|----------|---------|--------|
| `CORS_ORIGIN` | `true` (allow all) | Express CORS middleware |
| `PIPELINE_CRON_ENABLED` | `'true'` | In-process cron scheduling |
| `CRON_SECRET` | `null` | External cron trigger auth |
| `LOG_LEVEL` | (not checked) | Logger configuration |
| `ALLOWED_BOOKS` | 5 UK books | Odds book filtering |
| `DEBUG_DATAGOLF` | `'false'` | DataGolf diagnostic logging |
| `ALLOW_DB_MOCK` | (not checked) | DB fallback for dev |

---

## 4. ISSUES FOUND

### CRITICAL (C)

**C1: Duplicate `/health` endpoint (line 752 + line 1440)**
Two `/health` route handlers are registered. Express uses the first match. The second handler on line 1440 (returns `{ ok: true }`) is dead code. This isn't a bug per se, but the duplicate registration is confusing and the second handler returns a different response shape which could cause debugging issues.

**C2: `prisma db push` in CI workflow (.github/workflows/weekly-pipeline.yml:41)**
The GitHub Actions workflow uses `prisma db push` which can **drop data** when schema changes conflict. Production should ONLY use `prisma migrate deploy` (which the Railway deploy start command correctly does). If this CI workflow ever runs against the production DB, it could destroy data.

**C3: CI workflow `continue-on-error: true` on lint and test (.github/workflows/weekly-pipeline.yml:28,32)**
Lint failures and test failures are silently ignored. The pipeline proceeds even if tests fail. This means broken code can reach production via this workflow path.

### HIGH (H)

**H1: Admin auth is plaintext password comparison (line 2117)**
```js
if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
  return res.status(401).json({ error: 'Invalid credentials' })
}
```
The admin password is stored as a plaintext env var and compared directly. No hashing, no bcrypt, no timing-safe comparison. If logs ever capture the request body or an attacker can exploit timing differences, the password is exposed.

**H2: CORS defaults to allow ALL origins (line 146-148)**
```js
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : true  // <-- allows ALL origins
```
If `CORS_ORIGIN` is not set in Railway env vars, the server accepts requests from any origin. For a production app with auth tokens and payment processing, this should be locked down.

**H3: Graceful shutdown doesn't await `$disconnect()` (line 4285-4292)**
```js
prisma.$disconnect()  // Returns a Promise
logger.info('Database connections closed')
process.exit(0)  // Exits before disconnect completes
```
`prisma.$disconnect()` is async but not awaited. The process exits immediately, potentially leaving database connections dangling. Railway will kill the process anyway, but this can cause connection pool exhaustion during frequent redeploys.

**H4: `autoArchiveOldBets` does N+1 upserts (lines 4355-4361)**
Each bet is archived via individual `prisma.betOverride.upsert()` in a loop. With hundreds of bets, this generates hundreds of individual DB queries on every server startup and every 6 hours. Should be batched.

**H5: Results endpoint calls DataGolf API on every request (lines 1142-1200)**
`GET /api/results` makes live DataGolf API calls (`getInPlayPreds`) for every unique tour on every request. This is slow, burns API quota, and could timeout. Should be cached or pre-fetched.

### MEDIUM (M)

**M1: No connection pooling configuration**
No `pgbouncer` or connection pool parameters in the DATABASE_URL. Railway PostgreSQL can hit connection limits under load, especially with the monolithic server pattern. Consider adding `?connection_limit=10&pool_timeout=20` to the DATABASE_URL or using PgBouncer.

**M2: Health check is DB-independent**
The `/health` endpoint at line 752 always returns `200 OK` even if the database is down. Railway will think the service is healthy when it can't actually serve requests. The admin-only `/api/health/db` endpoint exists but Railway doesn't use it. Consider adding a lightweight DB ping to the main health check.

**M3: Server is a 4,411-line monolith**
Everything — API routes, auth, Stripe webhooks, CMS, media uploads, live tracking, pipeline orchestration, cron scheduling, audit logging, HIO challenge logic — lives in one file. This makes deployments risky (any change redeploys everything) and debugging hard.

**M4: 300s health check timeout is excessive**
Railway waits 5 minutes for the health check before marking the deploy as failed. The startup sequence (CMS seed + auto-archive) should complete in <30s. A 60s timeout would catch startup failures faster.

**M5: No memory/CPU limits configured**
No Railway resource limits are set. The pipeline (10,000 Monte Carlo simulations) runs in the same process as the web server. A pipeline run could OOM the server process, taking down the API.

**M6: Stripe webhook endpoint has no rate limiting**
`POST /api/stripe/webhook` has no rate limiter. While signature verification prevents abuse, a flood of invalid requests would still consume resources.

**M7: `trust proxy` set to `1` (line 57)**
This tells Express to trust the first `X-Forwarded-For` header. Correct for Railway (single proxy), but should be verified — if Railway uses multiple proxies, this could give wrong client IPs in rate limiting and audit logs.

**M8: File uploads use memory storage with 10MB limit (line 181-184)**
`multer.memoryStorage()` holds entire file in RAM. Combined with M5 (no memory limits), large concurrent uploads could crash the server.

**M9: GitHub Actions CI workflow uses `ODDS_API_KEY` (line 49)**
The workflow env references `ODDS_API_KEY` but the actual codebase uses `DATAGOLF_API_KEY`. Either the secret name is wrong or there's a legacy reference that won't work.

### LOW (L)

**L1: Console.log statements in production (lines 26, 47, 4401-4402)**
Raw `console.log` calls alongside the structured logger. Minor, but clutters Railway logs.

**L2: `globalThis.File` polyfill (lines 28-40)**
A Node.js `File` class polyfill is injected at startup. This suggests Railway may be running an older Node version. Consider pinning Node 20+ in railway.toml or package.json `engines`.

**L3: Auto-archive runs every 6 hours via `setInterval` (line 4405)**
This won't survive process restarts and has no guard against concurrent execution. Not harmful but unreliable.

**L4: Impersonation endpoint exists (line 3297)**
`POST /api/entities/users/:id/impersonate` allows admins to generate tokens as any user. Standard for admin panels but should be audited periodically.

**L5: `runWeeklyPipeline` is fire-and-forget (line 531)**
```js
pipeline.run(runKey, ...).catch(err => { logger.error(...) })
```
The pipeline is launched asynchronously with only a `.catch()`. If it crashes mid-run, the only evidence is a log line. The Run record may be stuck in `running` status forever.

---

## 5. API ENDPOINT MAP

### Public (No Auth)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Railway health check |
| GET | `/api/bets/latest` | Featured bets (pinned) |
| GET | `/api/bets/tier/:tier` | Tier-filtered bets (par/birdie/eagle/longshots) |
| GET | `/api/results` | Historical results with outcomes |
| GET | `/api/tournaments` | Recent tournament list |
| GET | `/api/membership-packages` | Available membership plans |
| GET | `/api/site-content` | CMS content (all) |
| GET | `/api/site-content/:key` | CMS content (single) |
| GET | `/api/pages/:slug` | CMS page (published only) |
| GET | `/api/hio/challenge/active` | Active Hole In One challenge |
| POST | `/api/auth/login` | Admin login (rate limited) |
| POST | `/api/stripe/webhook` | Stripe webhook receiver |

### User Auth Required
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/auth/me` | Current user profile |
| PUT | `/api/users/me` | Update own preferences |
| GET | `/api/membership-subscriptions/me` | My subscription |
| POST | `/api/membership-subscriptions/checkout` | Start Stripe checkout |
| GET | `/api/hio/entries/me` | My HIO entry |
| POST | `/api/hio/entries` | Submit HIO entry |

### Live Tracking (Public)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/live-tracking/active` | Active in-play events |
| GET | `/api/live-tracking/event/:dgEventId` | Event leaderboard |

### Admin Only
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health/db` | Database health check |
| GET | `/api/health/pipeline` | Pipeline module status |
| POST | `/api/pipeline/run` | Trigger pipeline (rate limited) |
| POST | `/api/cron/pipeline` | Cron-triggered pipeline |
| GET/PUT/DELETE | `/api/entities/golf-bets/:id` | Bet management |
| GET/PUT/DELETE | `/api/entities/tour-events/:id` | Tournament management |
| GET | `/api/entities/odds-events` | Odds event browser |
| GET/PUT/DELETE | `/api/entities/odds-offers/:id` | Odds offer management |
| GET/POST/PUT/DELETE | `/api/entities/betting-providers/:id` | Bookmaker management |
| GET/PUT | `/api/entities/data-quality-issues/:id` | Data quality management |
| GET/POST/PUT | `/api/entities/users/:id` | User management |
| POST | `/api/entities/users/:id/impersonate` | User impersonation |
| GET/PUT/DELETE | `/api/entities/site-content/:key` | CMS content admin |
| GET/POST/PUT/DELETE | `/api/entities/pages/:id` | CMS page admin |
| GET | `/api/entities/pages/:id/revisions` | Page revision history |
| GET/POST/DELETE | `/api/entities/media-assets/:id` | Media management |
| POST | `/api/entities/media-assets/upload` | Direct file upload |
| POST | `/api/entities/media-assets/upload-url` | Pre-signed upload URL |
| GET | `/api/entities/audit-logs` | Audit log viewer |
| GET/POST/PUT/DELETE | `/api/entities/membership-packages/:id` | Package management |
| GET/PUT | `/api/entities/membership-subscriptions/:id` | Subscription management |
| GET/POST/PUT | `/api/entities/hio-challenges/:id` | HIO challenge management |
| POST | `/api/entities/hio-challenges/generate-weekly` | Auto-generate HIO |
| POST | `/api/entities/hio-challenges/:id/calculate-scores` | Score HIO entries |
| GET | `/api/entities/hio-entries` | HIO entry browser |
| GET | `/api/entities/research-runs` | Pipeline run history |
| POST | `/api/admin/archive-old-bets` | Manual archive trigger |
| POST | `/api/admin/consolidate-tour-events` | Deduplicate tour events |
| POST | `/api/admin/full-cleanup` | Full cleanup operation |
| POST | `/api/admin/live-tracking/refresh` | Clear live tracking cache |

---

## 6. CRON / SCHEDULING

| Schedule | Trigger | Action |
|----------|---------|--------|
| Monday 9am GMT | In-process `node-cron` | Pipeline run (CURRENT_WEEK mode) |
| Tuesday 9am GMT | In-process `node-cron` | Pipeline run (odds update) |
| Every 6 hours | `setInterval` | Auto-archive old bets |
| On startup | Direct call | CMS seed + Auto-archive |
| On demand | `POST /api/cron/pipeline` | Pipeline via CRON_SECRET |
| On demand | `POST /api/pipeline/run` | Pipeline via admin auth |
| Monday 6am UTC | GitHub Actions | CI pipeline (separate from Railway) |

**Observation:** The Monday cron fires at both 6am UTC (GitHub Actions) and 9am GMT (Railway in-process). These could both trigger pipeline runs for the same week, creating duplicate runs.

---

## 7. DATABASE

- **Provider:** PostgreSQL via Prisma
- **ORM:** Prisma Client (auto-generated)
- **Migrations:** `prisma migrate deploy` runs on every deploy (good)
- **Schema:** 28 models across runs, bets, odds, users, memberships, CMS, media, HIO, audit
- **Connection:** Single `DATABASE_URL` env var, no pooling config

---

## 8. RECOMMENDATIONS (PRIORITY ORDER)

1. **Set `CORS_ORIGIN`** in Railway env vars to your actual domain(s) — currently accepts all origins
2. **Remove `prisma db push`** from the GitHub Actions workflow — use `prisma migrate deploy` only
3. **Remove `continue-on-error: true`** from CI lint and test steps
4. **Fix duplicate `/health` endpoint** — remove the one on line 1440
5. **Await `prisma.$disconnect()`** in graceful shutdown
6. **Cache DataGolf API calls** in the results endpoint instead of calling live on every request
7. **Batch `autoArchiveOldBets`** into a single `updateMany` instead of N upserts
8. **Reduce health check timeout** from 300s to 60-120s
9. **Consider adding a DB ping** to the main `/health` endpoint
10. **Hash admin password** with bcrypt instead of plaintext comparison
11. **Add memory limits** in Railway to prevent pipeline OOM from killing the API server
12. **Fix CI env var** — `ODDS_API_KEY` should be `DATAGOLF_API_KEY`

---

*Report generated from source code audit of `src/server/index.js` (4,411 lines), `railway.toml`, `Procfile`, `package.json`, `.github/workflows/weekly-pipeline.yml`, and `prisma/schema.prisma`. Live health check confirmed at time of audit.*
