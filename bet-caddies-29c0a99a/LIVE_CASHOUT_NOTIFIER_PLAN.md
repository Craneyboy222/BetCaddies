# Live Cashout Notifier (Production Plan)

Role: Senior Staff Engineer + Quant Lead

End-goal (reframed): Build a fully automated **Estimated Exit Value Notifier** that monitors user pre‑tournament bets during in‑play events and emits CASH OUT / HOLD / WAIT recommendations using DataGolf live odds (allowed books only), in‑play probabilities, and live stats/leaderboard signals, with explainability, dedupe/cooldowns, DataIssues, scheduling on Railway, and production observability—while explicitly treating exit value as a **proxy** (not a true sportsbook cashout offer).

**Constraints for this document**
- Planning + validation only. No implementation in this phase.
- Evidence-first: anything stated as “exists today” is backed by repo excerpts.
- Anything not proven is explicitly labeled **UNKNOWN** and treated as a validation requirement/blocker.
- Manual cashout offers are **removed** by design (no offer endpoints/tables/inputs).

---

## 1) Verified Facts (evidence-backed only)

### 1.1 Node/Express API server exists and is the primary backend entry
- Express server, Prisma client, node-cron are used in the running backend: [src/server/index.js](src/server/index.js#L1-L16)
- The server starts an Express app and uses `PORT`: [src/server/index.js](src/server/index.js#L43-L47)

### 1.2 Admin auth middleware exists (Bearer JWT + role)
- JWT secret and admin credentials are read from env: [src/server/index.js](src/server/index.js#L79-L83)
- `authRequired` verifies Bearer token with `JWT_SECRET` and populates `req.user`: [src/server/index.js](src/server/index.js#L124-L156)
- `adminOnly` enforces `role === 'admin'`: [src/server/index.js](src/server/index.js#L158-L165)

### 1.3 “User” concept exists in Prisma and is referenced by API
- `/api/auth/me` resolves admin vs non-admin and loads a `prisma.user` record for non-admin: [src/server/index.js](src/server/index.js#L520-L553)

### 1.4 Cron scheduling exists in-process (node-cron)
- A weekly cron schedule runs inside the web process, controlled by `PIPELINE_CRON_ENABLED`: [src/server/index.js](src/server/index.js#L235-L251)

### 1.5 Railway/Procfile show a single “web” service start
- Railway starts `npm run server` and healthchecks `/health`: [railway.toml](railway.toml#L1-L11)
- Procfile has only `web: npm run server`: [Procfile](Procfile#L1)

### 1.6 Prisma schema conventions
- Snake-case DB tables are used via `@@map("...")`: `Run` maps to `runs`: [prisma/schema.prisma](prisma/schema.prisma#L13-L38)
- Column mapping uses `@map(...)` (example `OddsEvent.matchConfidence -> match_confidence`): [prisma/schema.prisma](prisma/schema.prisma#L140-L156)
- `Json` fields are used broadly (e.g., artifacts, raw payloads): [prisma/schema.prisma](prisma/schema.prisma#L40-L58)

### 1.7 DataIssue logging already exists and writes to DB + logs
- `DataIssueTracker.logIssue()` creates `dataIssue` rows and logs with severity: [src/observability/data-issue-tracker.js](src/observability/data-issue-tracker.js#L1-L49)

### 1.8 DataGolf client exists and **includes** required live endpoints
- DataGolf base URL and API key requirement: [src/sources/datagolf/client.js](src/sources/datagolf/client.js#L1-L41)
- Live probabilities endpoint exists: `getInPlayPreds()` calls `/preds/in-play`: [src/sources/datagolf/client.js](src/sources/datagolf/client.js#L92-L94)
- Live stats endpoint exists: `getLiveTournamentStats()` calls `/preds/live-tournament-stats`: [src/sources/datagolf/client.js](src/sources/datagolf/client.js#L95-L97)
- Live odds endpoint exists: `getOutrightsOdds()` calls `/betting-tools/outrights`: [src/sources/datagolf/client.js](src/sources/datagolf/client.js#L125-L134)

### 1.9 Allowed-books filtering exists in DataGolf odds parsing
- Parser imports `getAllowedBooksSet/isAllowedBook` and includes allowed books in KNOWN_BOOK_KEYS: [src/sources/datagolf/parsers.js](src/sources/datagolf/parsers.js#L1-L31)
- Parser filters offers to allowed books (`if (!isAllowedBook(book, ALLOWED_BOOKS_SET)) continue`): [src/sources/datagolf/parsers.js](src/sources/datagolf/parsers.js#L204-L214)

### 1.10 User notification *preferences* exist, but delivery channels are not proven
- Profile UI toggles “Push Notifications” + “Email Updates”: [src/pages/Profile.jsx](src/pages/Profile.jsx#L170-L212)
- API allows user to update those preference fields: [src/server/index.js](src/server/index.js#L742-L760)

---

## 2) Unknowns (must be validated; treated as blockers/requirements)

### 2.1 Live DataGolf payload shapes for p_live/stats
- **UNKNOWN** exact field names and shapes returned by `/preds/in-play` and `/preds/live-tournament-stats` in production.
- Why this matters: we must compute `p_live_internal` keyed by `dg_id` and link to `event_id` deterministically.
- Verification steps:
  - Run a single DataGolf live request in a controlled environment with a known in-play event (or capture `RunArtifact` payloads if the pipeline already fetches these endpoints).
  - Store a minimal redacted sample in a `run_artifacts` record and document the schema.

### 2.2 In-play detection logic
- **UNKNOWN** authoritative “event is in-play” rule: schedule fields + round state + timing.
- Verification steps:
  - Inspect schedule payload fields already stored for `TourEvent` and determine what indicates live state (if anything).
  - Cross-check DataGolf live endpoints: if they return an event_id and non-empty player rows, that can be used as a strong live signal.

### 2.3 Notification delivery mechanisms
- **UNKNOWN** whether any push/email/SMS delivery exists beyond preference flags.
- Verification steps:
  - Search codebase for provider integrations (SendGrid, SES, Twilio, FCM/APNS, WebSocket) and Railway env vars.
  - If absent, MVP must be **IN_APP** notifications only (DB + UI pull), until a provider is added.

### 2.4 User authentication model details
- We see user records are loaded via Prisma in `/api/auth/me` for non-admin, but **UNKNOWN** how end users obtain JWTs and what claims exist.
- Verification steps:
  - Identify user login/signup endpoints and JWT issuing logic for non-admin users.
  - Confirm what `req.user.sub` represents for real users.

### 2.5 True sportsbook cashout offer observability
- **UNKNOWN** whether any data source provides actual cashout offers.
- If not observable (likely), we can only compute an **Estimated Exit Value** proxy, not replicate exact bookmaker cashouts.
- Verification steps:
  - Confirm DataGolf does not expose cashout offers in any endpoint payload.
  - Confirm there is no other feed in the repo that provides cashout offers.

---

## 3) Blocker & Risk Register

| ID | Description | Severity | Evidence / Status | Impact | Mitigation (specific steps) | Owner |
|---|---|---:|---|---|---|---|
| R-001 | True sportsbook cashout offers unobservable → exit value is proxy only | P0 | No evidence of cashout offers in DataGolf client; treat as UNKNOWN | Cannot claim replication of bookmaker cashout | Explicit “Estimated Exit Value” framing; conservative policy; test via regret metrics | Quant |
| R-002 | Live endpoint payload shapes for `p_live`/stats unknown | P0 | Endpoints exist: [src/sources/datagolf/client.js](src/sources/datagolf/client.js#L92-L97) | Engine cannot compute key inputs reliably | Capture payload samples via artifacts; document schema; add strict validators + DataIssues | Data |
| R-003 | In-play detection rule unknown | P0 | No proven in-play rule | Worker may spam or miss windows | Define in-play = “live endpoints return expected event + rows”; otherwise EVENT_NOT_IN_PLAY | Eng |
| R-004 | Notification delivery not proven (only preferences exist) | P0 | Preferences exist: [src/pages/Profile.jsx](src/pages/Profile.jsx#L170-L212); delivery UNKNOWN | Cannot actually notify users | MVP: IN_APP notifications table + UI pull; add email/push later behind feature flag | Eng |
| R-005 | Worker duplication under retries or scaling | P0 | Web runs single service today; scale behavior unknown | Duplicate snapshots/notifications | Add run locks + unique snapshot buckets + dedupe keys | Eng |
| R-006 | Allowed books may be missing for a market (e.g., betfair absent) | P1 | Parser filters allowed books: [src/sources/datagolf/parsers.js](src/sources/datagolf/parsers.js#L204-L214) | Reduced odds coverage; confidence drops | DataIssue BOOK_NOT_AVAILABLE_FROM_DATAGOLF; proceed with remaining books | Data |
| R-007 | Rate limits / timeouts / retries during live polling | P1 | Retries exist: [src/sources/datagolf/client.js](src/sources/datagolf/client.js#L11-L31) | Snapshot lag, missed notifications | Backoff + per-run caps + monitoring on lag; batch by event/tour | Eng |
| R-008 | Snapshot storage growth | P2 | New time-series table will grow fast | DB cost/perf risk | Retention (e.g., 30–90 days) + summarization; indexes | Eng |

---

## 4) Options Comparison (3+ implementation strategies)

### Option A — Separate Railway worker service (recommended)
- Runtime components: web service + worker service (same repo, different start command).
- Scheduling: worker runs every 2–5 minutes, but only processes ACTIVE bets for in-play events.
- Idempotency: use per-bet time-bucket dedupe keys; safe retries.
- Observability: worker logs + DataIssues + a “run” record (pattern exists via `Run`).
- Failure modes: worker isolated from web latency; restarts resume.
- Tradeoff: higher infra/config complexity on Railway (multi-service).

### Option B — Railway cron hits an admin endpoint
- Runtime components: web service only; Railway scheduled job calls `POST /api/admin/cashout/run`.
- Pros: simple infra.
- Cons: job reliability tied to web service health; must protect endpoint with a cron token; must prevent overlapping invocations.

### Option C — In-process node-cron (like existing pipeline)
- Runtime components: web only; `node-cron` schedules frequent polls.
- Evidence cron exists already: [src/server/index.js](src/server/index.js#L235-L251)
- Cons: highest risk with restarts/scaling; duplicates across instances; less reliable for live notifications.

### Option D — Hybrid “dynamic polling windows”
- A scheduler discovers in-play windows (hourly) and enables tight polling only when in-play.
- Reduces API calls, but adds complexity; requires a robust in-play detector (UNKNOWN today).

---

## 5) Final Master Plan (optimized; identical end-goal, fully automated)

### Phase 0 — Validation & proofs (required before build)
1. Capture and document **real** payload samples for:
   - `/preds/in-play` (p_live)
   - `/preds/live-tournament-stats`
   - `/betting-tools/outrights`
2. Prove how we derive:
   - `event_id` (event identifier)
   - `dg_id` (player identifier)
   - allowed book keys (bet365, williamhill, skybet, unibet, betfair)
3. Confirm user auth:
   - how end users receive JWTs
   - what `req.user.sub` is for real users
4. Confirm notification delivery capabilities:
   - if none, commit MVP to **IN_APP** only

### Phase 1 — DB schema proposal (Prisma) (no manual cashout offers)
Add models (names reflect desired feature; exact naming should follow existing Prisma style using `@@map`/`@map`):

**CashoutBet**
- id (cuid)
- userId
- tour
- dgEventId
- dgPlayerId
- market (win/top_5/top_10/top_20/make_cut/… allowlist)
- book (allowlist: bet365, williamhill, skybet, unibet, betfair)
- stake (float)
- placedOddsDecimal (float)
- placedAt (datetime)
- status: ACTIVE, RESOLVED, UNRESOLVED_MAPPING, DATA_MISSING, SETTLED
- notes (optional)
- createdAt/updatedAt

**CashoutSnapshot** (time series)
- cashoutBetId
- capturedAt
- liveOddsDecimal (nullable)
- liveOddsBook (nullable)
- pLive (nullable)
- pLiveSource: DG_IN_PLAY / INTERNAL / NONE
- fairCashout (nullable)
- haircutApplied (nullable)
- cashoutProxy (nullable)
- holdValue (nullable)
- recommendation: CASH_OUT / HOLD / WAIT
- confidence: HIGH / MEDIUM / LOW
- evidenceJson (jsonb)
- dataIssues (jsonb array)

**CashoutNotification**
- cashoutBetId
- sentAt
- channel: IN_APP (plus PUSH/EMAIL/SMS only if proven)
- recommendation
- message
- dedupeKey
- createdAt

**CashoutHaircutCalibration**
- book, market, stage
- nSamples
- haircutEstimate
- updatedAt
- metadataJson

Indexes & retention
- Snapshots: index `(cashoutBetId, capturedAt desc)`
- Notifications: unique index on `dedupeKey`
- Retention: keep high-frequency snapshots 30–90 days (config), keep latest snapshot per bet indefinitely

### Phase 2 — Inputs & mapping rules (dg_id + event_id only)
- Bet placement must store `event_id` + `dg_id`.
- If upstream payload lacks `dg_id`, mark bet status `UNRESOLVED_MAPPING` and log DataIssue.
- **Allowed books only**: bet365, williamhill, skybet, unibet, betfair.
- If an allowed book is absent from DataGolf odds payload for a market, log **BOOK_NOT_AVAILABLE_FROM_DATAGOLF** and proceed with remaining allowed books.

### Phase 3 — Estimated Exit Value math (net convention; proxy only)
Definitions (single convention: net values):
- $S$ = stake
- $O_0$ = placed odds (decimal)
- $R_0 = S \cdot O_0$ (gross return if win)
- $p_{live}$ = **p_live_internal** (our best in-play probability estimate)
- $HoldEV_{net} = p_{live}(R_0 - S) - (1 - p_{live})S$
- $ExitValue_{gross}$ = estimated realizable exit amount (proxy)
- $ExitEV_{net} = ExitValue_{gross} - S$

Fair exit baselines (proxy):
- $fair_{market} = R_0 / O_t$ (if live odds $O_t$ present)
- $fair_{model} = p_{live} \cdot R_0$ (if p_live present)
- $fair = 0.7\cdot fair_{market} + 0.3\cdot fair_{model}$ (default blend)
- If one input missing, use the other; if both missing → DATA_MISSING + DataIssue, no recommendation

Haircut (policy table only in v1):
- $ExitValue_{gross} = fair \cdot (1 - haircut_{book,market,stage})$
- Calibration is hypothesis-only and must use observable outcomes (e.g., post-settlement regret), not unobservable cashout offers

Confidence bands:
- HIGH: mapping strong + Ot + p_live + stable stats
- MEDIUM: only one of Ot/p_live, or stats missing
- LOW: mapping low or sparse data; suppress notifications unless extreme threshold

**How live stats/leaderboard influence decisions**
- Primary: used to adjust confidence and/or thresholds.
- Optional hypothesis: bounded adjustment to $p_{live}$ (must be validated and capped).

### Phase 4 — Recommendation policy (net-consistent)
Inputs:
- $ExitEV_{net}$ vs $HoldEV_{net}$
- $buffer = \max(0.03S, 0.5)$
- cooldown_minutes default 30
- min_delta_to_notify threshold

Decision:
- CASH OUT if $ExitEV_{net} > HoldEV_{net} + buffer$ and confidence != LOW
- HOLD if $ExitEV_{net} < HoldEV_{net} - buffer$ and confidence == HIGH
- else WAIT

Explainability bullets (3–6):
- Odds move O0→Ot
- p_live change (if present)
- leaderboard rank/trend (if present)
- SG trend (if present)
- stage rule (validated)

Numeric walkthrough (symbolic example):
- $S=10$, $O_0=6.0$, $R_0=60$, $p_{live}=0.25$, $O_t=4.0$
- $fair_{market}=60/4=15$, $fair_{model}=0.25\cdot 60=15$, $fair=15$
- haircut 10% → $ExitValue_{gross}=13.5$, $ExitEV_{net}=3.5$
- $HoldEV_{net}=0.25(60-10)-0.75(10)=12.5-7.5=5.0$
- $buffer=\max(0.3,0.5)=0.5$ → HOLD (if HIGH confidence), else WAIT

### Phase 5 — Idempotency + locking (explicit)
- Run-level lock per `(tour, event_id, time_bucket)` to prevent overlapping worker runs.
- Unique snapshot key on `(cashoutBetId, capturedAt_bucket)` to prevent duplicates.
- Notification dedupe key on `(betId, recommendation, bucket, inputs_signature)` plus cooldown checks.
- Retry behavior: safe replays via unique constraints + upserts.

### Phase 6 — Worker & scheduling
Preferred: Option A (separate worker service).
- Poll cadence: 2–5 minutes
- Scope: only ACTIVE bets where event is in-play (validated rule)
- Output: write `CashoutSnapshot`, produce DataIssues, enqueue notifications

Admin control endpoints (must be adminOnly)
- `POST /api/admin/cashout/run` manual trigger
- `POST /api/admin/cashout/calibrate` haircut calibration trigger

### Phase 7 — API endpoints (no manual offer API)
- `POST /api/cashout/bets` create a bet (reject disallowed books)
- `GET /api/cashout/bets` list user bets + latest snapshot
- `GET /api/cashout/bets/:id/recommendation` latest rec + why
- `POST /api/admin/cashout/run` admin trigger worker
- `POST /api/admin/cashout/calibrate` admin trigger calibration

### Phase 8 — Frontend UX
MVP (assuming existing React app):
- Cashout page: create bet (select event/player), list bets with status + rec + confidence + bullets
- Admin page: trigger run/calibration + view recent DataIssues for cashout steps

### Phase 9 — Monitoring, alerting, rollout
- Monitor snapshot lag per ACTIVE bet
- Monitor DataIssue volumes by type
- Monitor notification volume + dedupe suppression
- Drift monitoring: calibration changes and recommendation flip rates
- Feature-flag rollout; start IN_APP only; expand channels after proven

---

## 6) Acceptance Criteria + Proof Checklist

**Functional**
- Users can create bets with `event_id` + `dg_id` + stake + placed odds + allowed book.
- Worker computes snapshots during in-play windows.
- System computes Estimated Exit Value and net hold value with consistent conventions.
- Recommendation policy (CASH OUT/HOLD/WAIT) matches spec.
- Notifications obey cooldown + dedupe rules.

**Data quality + guardrails**
- DataIssues are created for:
  - ODDS_MISSING
  - ODDS_BOOK_NOT_ALLOWED
  - BOOK_NOT_AVAILABLE_FROM_DATAGOLF
  - P_LIVE_MISSING
  - STATS_MISSING
  - EVENT_NOT_IN_PLAY
  - MAPPING_LOW_CONFIDENCE
  - TOUR_NOT_SUPPORTED
  - MARKET_NOT_SUPPORTED
- LOW confidence suppresses notifications except extreme threshold.

**Proof checklist (evidence required)**
- Saved payload samples for `/preds/in-play` and `/preds/live-tournament-stats`.
- Demonstrated book filtering behavior when betfair is missing.
- Demonstrated UNRESOLVED_MAPPING behavior when dg_id missing.
- Demonstrated worker idempotency (no duplicate snapshots).
- Demonstrated monitoring dashboards/queries for lag and issue rates.

---

## 7) Validation Checklist (must be proven before build)

1. Confirm payload fields for `/preds/in-play` (p_live, dg_id, event_id).
2. Confirm payload fields for `/preds/live-tournament-stats` (leaderboard/stats fields).
3. Confirm payload fields for `/betting-tools/outrights` (book keys + dg_id).
4. Confirm in-play detection rule from verified payload fields.
5. Confirm non-admin JWT issuance flow and claims.
6. Confirm notification delivery channels (or lock MVP to IN_APP only).
7. Confirm allowed book keys exactly: bet365, williamhill, skybet, unibet, betfair.
8. Confirm db locking/idempotency strategy is compatible with Prisma + Postgres.

---

## 8) No-Guess List (do not implement until validated)

- DataGolf payload field names for event_id, dg_id, p_live, stats, leaderboard position.
- Exact in-play detection rule.
- Non-admin JWT issuance + user identity mapping.
- Notification delivery channels beyond IN_APP.
- Any claim of “book-accurate cashout.”
- Any calibration that depends on true cashout offers.

---

## 9) Open Questions (only if unavoidable)

- What is the existing non-admin login/signup flow that issues JWTs?
- What notification channels can we actually ship on (IN_APP only vs email/push)?
- What is the definitive in-play signal we can prove from DataGolf payloads?
- Which markets are supported for cashout bets in v1 (strict allowlist)?
