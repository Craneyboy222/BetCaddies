# BetCaddies Full Codebase Audit Report

**Branch:** `betc-optimal-engine`
**Date:** 2026-02-10
**Scope:** Complete codebase audit — architecture, workflows, frontend, backend, engine, database, tests, CI/CD, observability, security

---

## Table of Contents

1. [Repository Overview](#1-repository-overview)
2. [Complete Workflow Map](#2-complete-workflow-map)
3. [Workflow-Impacting Issues](#3-workflow-impacting-issues)
4. [Frontend Issues (All Pages)](#4-frontend-issues-all-pages)
5. [Backend / Admin Dashboard Issues](#5-backend--admin-dashboard-issues)
6. [10 High-Impact, Low-Risk Enhancements](#6-10-high-impact-low-risk-enhancements)
7. [10 Feature Recommendations for User Experience](#7-10-feature-recommendations-for-user-experience)
8. [Appendix: File Inventory](#appendix-file-inventory)

---

## 1. Repository Overview

### Architecture Summary

BetCaddies is a **golf betting recommendation platform** that ingests data from the DataGolf API, runs Monte Carlo tournament simulations, calculates betting edges against sportsbook odds, and delivers tiered bet recommendations to users through a React web app.

| Layer | Technology | Key Files |
|---|---|---|
| **Frontend** | React 18, Vite 6, Tailwind CSS, TanStack Query, Framer Motion, shadcn/ui | `src/pages/*.jsx`, `src/components/**` |
| **Backend** | Express 4, Node.js 20 | `src/server/index.js` (4,410 lines) |
| **Engine (V2)** | JavaScript Monte Carlo simulation | `src/engine/v2/*.js` |
| **Engine (TS)** | TypeScript scaffolding layer | `src/engine/*.ts` |
| **Pipeline** | Weekly batch processing | `src/pipeline/weekly-pipeline.js` (2,456 lines) |
| **Data Source** | DataGolf API (predictions, odds, field data) | `src/sources/datagolf/*` |
| **Database** | PostgreSQL via Prisma ORM (28 models) | `prisma/schema.prisma` |
| **Deployment** | Railway (NIXPACKS), GitHub Actions CI | `railway.toml`, `.github/workflows/` |
| **Observability** | Winston logging, data issue tracker | `src/observability/*` |
| **Payments** | Stripe (membership subscriptions) | Stripe SDK integration |

### Database Schema (28 Models)

**Pipeline Domain:** Run, SelectionRun, TourEvent, OddsEvent, OddsMarket, OddsOffer, OddsSnapshot, RunArtifact, BetRecommendation, BetOverride, SelectionResult, SelectionOutcomeMetric, Prediction, HistoricalRound, Course, Weather

**User Domain:** User, MembershipPackage, MembershipSubscription, UserBetRecord

**Content Domain:** Page, PageRevision, MediaAsset, SiteContent, HIOChallenge

**Observability Domain:** DataIssue, AuditLog

### Key Metrics

- **Total source files:** ~80+
- **Server:** 4,410-line monolith (`index.js`)
- **Weekly pipeline:** 2,456 lines
- **Frontend pages:** 14 routes
- **Admin tabs:** 14 management panels
- **Test files:** 13 (across `src/__tests__/` and `src/tests/`)
- **Prisma models:** 28

---

## 2. Complete Workflow Map

### Workflow 1: Weekly Pipeline (Core Business Logic)

```
TRIGGER: GitHub Actions cron (Monday 06:00 UTC) OR Admin manual trigger
    │
    ▼
[WeeklyPipeline.run()] ── src/pipeline/weekly-pipeline.js
    │
    ├── 1. Create Run record in DB (status: 'running')
    │
    ├── 2. Determine week window (Monday-Sunday, Europe/London TZ)
    │
    ├── 3. For each supported tour (PGA, DPWT, LIV):
    │       │
    │       ├── 3a. Fetch tournament schedule from DataGolf
    │       ├── 3b. Match current-week event
    │       ├── 3c. Check if event is in-play (exclude if started)
    │       ├── 3d. Upsert TourEvent record
    │       │
    │       ├── 3e. Fetch field updates (player list)
    │       ├── 3f. Fetch pre-tournament predictions
    │       ├── 3g. Fetch skill ratings
    │       ├── 3h. Fetch outright betting odds
    │       │
    │       ├── 3i. Parse odds → extract UK/EU book offers
    │       │       Uses: parsers.js, allowed-books.js, book-utils.js
    │       │
    │       ├── 3j. Build probability engine (DataGolf preds → true probs)
    │       │       Uses: probability-engine.js, odds-utils.js
    │       │
    │       ├── 3k. Build player parameters (skill → sim params)
    │       │       Uses: player-params.js
    │       │
    │       ├── 3l. Run Monte Carlo simulation (10,000 tournaments)
    │       │       Uses: tournamentSim.js
    │       │       Output: win, top5, top10, top20, makeCut, FRL probs
    │       │
    │       ├── 3m. Blend probabilities:
    │       │       logit(p_fair) = 0.70*logit(p_sim) + 0.20*logit(p_dg) + 0.10*logit(p_mkt)
    │       │
    │       ├── 3n. Calculate edge per player per market:
    │       │       edge = fair_prob - implied_book_prob
    │       │       EV = (fair_prob × payout) - 1
    │       │
    │       └── 3o. Select tier candidates:
    │               PAR tier:        odds < 6.0     (high confidence)
    │               BIRDIE tier:     odds 6.0-10.0  (medium confidence)
    │               EAGLE tier:      odds 10.0-60.0 (value plays)
    │               LONG SHOTS tier: odds ≥ 61.0    (high odds specials)
    │               Each tier: up to 10 picks, sorted by EV desc
    │               Fallback filling if insufficient positive-EV candidates
    │
    ├── 4. Write BetRecommendation records to DB
    │      (player, tier, market, odds, edge, EV, explanation, provider links)
    │
    ├── 5. Store RunArtifacts (raw API responses for audit trail)
    │
    ├── 6. Update Run record (status: 'completed', stats)
    │
    └── 7. Log completion, record data issues
```

### Workflow 2: Live Bet Tracking

```
TRIGGER: User visits /live-tracking page (API call with 5-min refetch)
    │
    ▼
[LiveTrackingService.getActiveEvents()] ── src/live-tracking/live-tracking-service.js
    │
    ├── 1. Query latest completed Run
    ├── 2. Find BetRecommendations from that Run (non-archived)
    ├── 3. For each tour with active bets:
    │       │
    │       ├── 3a. Fetch current leaderboard from DataGolf
    │       ├── 3b. Match recommended players to leaderboard positions
    │       ├── 3c. Fetch current live odds from DataGolf
    │       ├── 3d. Compare current odds vs. opening odds (movement tracking)
    │       ├── 3e. Build tracking rows:
    │       │       - Player position, score, round scores (R1-R4)
    │       │       - Current odds vs. opening odds (drift direction)
    │       │       - Win/loss outcome status
    │       │       - Elimination status (missed cut)
    │       │
    │       └── 3f. Cache results (5-min TTL)
    │
    └── Return structured tracking data to frontend
```

### Workflow 3: Results / Outcome Tracking

```
TRIGGER: User visits /results page OR admin resolves bets
    │
    ▼
[Server: GET /api/results/settled]
    │
    ├── 1. Query BetRecommendations with outcome != null
    ├── 2. Group by week/tournament
    ├── 3. Fetch final tournament standings from DataGolf
    ├── 4. Calculate win/loss stats per tier, per tour
    └── Return: weekly results with category breakdowns
```

### Workflow 4: User Registration & Onboarding

```
TRIGGER: User clicks Join
    │
    ▼
[Join.jsx] ── 3-step wizard
    │
    ├── Step 1: Select preferred tours (PGA, DPWT, LIV)
    ├── Step 2: Set risk profile (Conservative/Moderate/Aggressive)
    ├── Step 3: Acknowledge responsible gambling policy
    │
    ├── Save preferences via api.users.me.update()
    └── Redirect to home
```

### Workflow 5: Membership & Payments

```
TRIGGER: User selects a membership package
    │
    ▼
[Memberships.jsx] → api.membershipSubscriptions.checkout()
    │
    ├── 1. Create Stripe Checkout Session (server-side)
    ├── 2. Redirect user to Stripe hosted checkout
    ├── 3. Stripe webhook → update MembershipSubscription status
    └── 4. User returns to app with active subscription
```

### Workflow 6: HIO (Hole-in-One) Weekly Challenge

```
TRIGGER: Admin creates weekly challenge OR cron generates questions
    │
    ▼
[hio-question-generator.js]
    │
    ├── 1. Fetch current tournament field from DB
    ├── 2. Generate 10 multiple-choice questions (6 types)
    ├── 3. Archive any existing active challenge
    ├── 4. Create new HIOChallenge record
    │
    ▼
[HIOChallenge.jsx] ── User-facing
    │
    ├── 1. Load active challenge
    ├── 2. User answers 10 questions
    ├── 3. Submit entry
    └── 4. View results when scored by admin
```

### Workflow 7: Admin Dashboard Operations

```
[Admin.jsx] ── 14 tabs
    │
    ├── Runs: Trigger pipeline, view run history, health checks
    ├── Bets: CRUD on recommendations, toggle featured/listed, archive
    ├── Tour Events: Manage tournament records
    ├── Odds: Browse/edit odds events and offers
    ├── Providers: Manage sportsbook providers
    ├── Issues: View/resolve data quality issues
    ├── Content: Edit site content (hero, features, FAQs)
    ├── Pages: CMS page builder (block-based)
    ├── Media: Upload/manage images and files
    ├── Users: User management, impersonation
    ├── Audit: View audit trail
    ├── Packages: Manage membership tiers
    ├── Subscriptions: CRM dashboard (MRR, churn, pause/cancel)
    └── HIO Challenge: Generate/edit questions, score entries
```

---

## 3. Workflow-Impacting Issues

These are issues that directly affect the core business workflows — from data ingestion through to user-facing output.

### CRITICAL

| # | Issue | Impact | Location |
|---|---|---|---|
| C1 | **Triple selection engine divergence** — Three separate implementations exist: `weekly-pipeline.js` (active, V2), `selection-pipeline.js` (unused V2 alternate), `bet-selection-engine.js` (legacy domain). Each uses different tier schemas, different odds thresholds, and different portfolio constraints. | Confusion about which engine is authoritative. Tests cover the legacy engine but production uses the pipeline engine. | `src/pipeline/`, `src/domain/` |
| C2 | **Player name normalization mismatch** — `probability-engine.js` uses simple `trim().toLowerCase()` while `player-params.js` uses aggressive regex `[^\w\s-]` that strips diacritics. A player like "Højgaard" becomes "hjgaard" in one system and "højgaard" in the other. | Players with accented names silently fail to match between probability lookup and simulation parameters, producing fallback probabilities instead of real ones. | `src/engine/v2/probability-engine.js:L~15`, `src/engine/v2/player-params.js:L~3` |
| C3 | **Dual API client — user bets stored only in localStorage** — ParBets, BirdieBets, EagleBets, LongShots, and MyBets pages use the `base44Client.js` (localStorage mock) for user bets and providers instead of the real API client. | User bets are never synced to the server. Clearing browser data loses all user bet history. Providers show hardcoded sample data (Tiger Woods, Rory McIlroy). | `src/api/base44Client.js`, `src/pages/ParBets.jsx`, etc. |
| C4 | **`entities.js`, `functions.js`, `integrations.js` export `undefined`** — These barrel files re-export from `base44Client` properties that don't exist (`ResearchRun`, `TournamentSnapshot`, `weeklyResearchPipeline`, `SendEmail`, etc.). | Any import of these named exports produces `undefined`, causing runtime crashes when methods are called. | `src/api/entities.js`, `src/api/functions.js`, `src/api/integrations.js` |
| C5 | **`cleanPlayerName(null)` crashes** — The player normalizer calls `.replace()` on input without null check. | Pipeline crash when DataGolf returns a player with null/undefined name field. | `src/domain/player-normalizer.js:L~10` |

### HIGH

| # | Issue | Impact | Location |
|---|---|---|---|
| H1 | **No vig removal in edge calculation** — `edge.ts` computes `bookProb = 1/odds` (raw implied probability including vig). The vig-removal utilities exist in `odds-utils.js` but are not wired in. | Systematically underestimates true edge for all bets. Some positive-edge bets may be classified as negative-edge and excluded. | `src/engine/edgeCalculator/edge.ts` |
| H2 | **Calibration is unimplemented** — `calibration/index.js` is a pass-through stub. | No correction for systematic model biases. The probability engine's outputs go directly to edge calculation without calibration. | `src/engine/v2/calibration/index.js` |
| H3 | **CI pipeline ignores test failures** — `continue-on-error: true` on lint and test steps means the weekly pipeline executes against production data even when tests fail. | Broken code runs against production database and generates potentially erroneous recommendations. | `.github/workflows/weekly-pipeline.yml` |
| H4 | **CI uses `prisma db push` instead of `prisma migrate deploy`** — `db push` can drop columns/data on schema changes. | Risk of production data loss during schema evolution. The server start script correctly uses `migrate deploy`, but CI uses the dangerous command. | `.github/workflows/weekly-pipeline.yml` |
| H5 | **FRL outcome determination bug** — Live tracking incorrectly determines First Round Leader outcomes using incomplete logic. | FRL bets show incorrect win/loss status on the live tracking page. | `src/live-tracking/live-tracking-service.js` |
| H6 | **Layout header/content overlap** — Main content has `pt-20` (80px padding) but the fixed header is `h-32` (128px). | Top ~48px of page content is hidden behind the header on every page. | `src/pages/Layout.jsx` |
| H7 | **Severity sorting bug in data issue tracker** — `orderBy: { severity: 'desc' }` sorts alphabetically, placing `warning` above `error`. | Admin issue dashboard shows warnings before errors, obscuring critical issues. | `src/observability/data-issue-tracker.js` |
| H8 | **`backtest.js` has a syntax error** — The file contains broken code that will throw on import. | Backtesting functionality is completely non-functional. | `src/pipeline/backtest.js` |

### MEDIUM

| # | Issue | Impact | Location |
|---|---|---|---|
| M1 | **`smoke-test.js` references non-existent `scrapers` module** | Smoke testing is broken — cannot be run. | `src/pipeline/smoke-test.js` |
| M2 | **`selection-pipeline.js` uses undefined `dgProb` variable** | The alternate selection pipeline will crash if invoked. | `src/pipeline/selection-pipeline.js` |
| M3 | **Subscription CRM pause/cancel doesn't sync with Stripe** — DB status is updated but Stripe subscription is not paused/cancelled. | Billing continues even after admin "pauses" a subscription. Revenue leakage risk. | `src/components/admin/SubscriptionCRM.jsx` |
| M4 | **Live tracking UI claims "updates every 60s" but actual interval is 5 minutes (300,000ms)** | Misleading to users; they may refresh repeatedly expecting more frequent updates. | `src/pages/LiveBetTracking.jsx` |
| M5 | **Home page `addBetMutation` is a no-op** — Logs to console and resolves without persisting. | Users clicking "Add Bet" on featured picks get no actual functionality. | `src/pages/Home.jsx` |
| M6 | **No shared auth context** — Each page independently loads user from `api.auth.me()` or localStorage. | Auth state can be inconsistent across pages. Unnecessary API calls on every navigation. | Multiple pages |
| M7 | **Admin.jsx is a 1000+ line monolith** with 25+ state variables and 14 tabs in a single component. | Extremely difficult to maintain, debug, or extend. Any change risks breaking unrelated tabs. | `src/pages/Admin.jsx` |
| M8 | **Course profile module is disconnected** — Computes course statistics but nothing consumes them. | Course-specific adjustments are not applied to simulations. | `src/engine/v2/course-profile.js` |
| M9 | **Market wrappers incompatible with simulator output** — `marketWrappers.js` expects per-sim raw scores but `tournamentSim.js` outputs aggregated probabilities only. | Head-to-head and three-ball markets cannot be served. | `src/engine/v2/marketWrappers.js` |
| M10 | **Mock DB client returns `[]` for `findFirst`/`findUnique`** — Should return `null`. | Code checking `if (result)` on `[]` evaluates truthy, causing logic errors in non-production environments. | `src/db/client.js` |

---

## 4. Frontend Issues (All Pages)

### Page-by-Page Issues

#### Home (`/`)
- `addBetMutation` is a no-op mock (console.log only)
- Providers query always resolves to `[]`
- Category grid uses `md:grid-cols-3` for 4 cards — asymmetric on medium screens
- Long Shots filter uses `>= 61` here but `> 60` on the LongShots page (off-by-one)

#### Layout (All Pages)
- Fixed header `h-32` (128px) with only `pt-20` (80px) content padding — content hidden behind header
- Mobile menu `top-16` (64px) doesn't align with `h-32` header — dropdown overlaps
- Admin check is client-side only (localStorage role can be manipulated)
- Hamburger button has no `aria-label` or `aria-expanded`
- Login modal lacks focus trap and `aria-describedby`

#### ParBets, BirdieBets, EagleBets, LongShots (`/par-bets`, `/birdie-bets`, `/eagle-bets`, `/long-shots`)
- Uses `base44Client` for providers and user bets (localStorage-only, not synced to server)
- Heavy code duplication — four nearly identical pages
- User auth loaded independently on each page (no shared context)
- Sort dropdown has no accessible label
- Filter buttons lack `aria-pressed` state

#### LiveBetTracking (`/live-tracking`)
- UI text says "Live updates every 60s" but refetch is 300,000ms (5 minutes)
- 16-column table is unusable on mobile (horizontal scroll with no sticky headers)
- No `<caption>` on data tables

#### Results (`/results`)
- `new Date()` on null/invalid `tournament_end_date` produces "Invalid Date" display
- Stats use large fonts but no semantic markup (`<dl>` term/value pairs)

#### MyBets (`/my-bets`)
- All data stored in localStorage only — never reaches the server
- Delete has no confirmation dialog
- Currency shows `$` but Memberships page uses GBP — inconsistent
- Edit and Delete buttons are icon-only with no `aria-label`
- `api.auth.redirectToLogin()` navigates to `/` instead of showing login

#### HIOChallenge (`/hio-challenge`)
- Uses `alert()` for validation instead of proper UI feedback
- Question count `10` hardcoded in multiple places — fragile
- No error display for submission failures
- Question navigation dots are `<button>` with no text or aria-label

#### Memberships (`/memberships`)
- Uses `alert()` for checkout errors
- Empty packages array shows infinite loading spinner (no empty state)
- `iframe` detection is fragile

#### Join (`/join`)
- `responsible_gambling_acknowledged` saved to localStorage only, not sent to server
- `alert()` for errors
- Step indicators have no text alternative

#### Profile (`/profile`)
- Rapid toggle clicking causes race conditions (immediate mutation per toggle)
- No success/error feedback for updates
- Tour preference buttons lack `aria-pressed`

#### Admin (`/admin`)
- 1000+ line monolith component
- 14+ queries fire simultaneously on load (burst of API requests)
- Console.log debugging statements in production code
- `window.location.href = '/'` for non-admin redirect bypasses React Router
- HIO question generator produces hardcoded generic questions with placeholder players
- SubscriptionCRM churn calculation is incorrect (cancelled / total all-time, not period-based)
- Export button has no implementation (no onClick handler)

### Cross-Cutting Frontend Issues

| Category | Issue |
|---|---|
| **Accessibility** | No ARIA roles on tab navigation, no keyboard shortcuts, missing focus management in modals, icon-only buttons without labels, no skip-to-content link |
| **Authentication** | No shared auth context — duplicated across pages. `redirectToLogin()` just navigates to `/`. |
| **Currency** | Inconsistent — `$` on MyBets, GBP on Memberships |
| **Error Handling** | `alert()` used on HIOChallenge, Join, Memberships. Silent failures elsewhere. |
| **Code Duplication** | Par/Birdie/Eagle/LongShots are 4 nearly identical components |
| **Dead Code** | `getMockData()` in client.js (100+ lines never called), unused CategoryTabs component |
| **TourFilter** | Shows PGA/DPWT/LIV but codebase also references KFT — inconsistent |

---

## 5. Backend / Admin Dashboard Issues

### Server (`src/server/index.js` — 4,410 lines)

| # | Issue | Severity |
|---|---|---|
| 1 | **Monolithic file** — All routes, middleware, and business logic in one 4,410-line file | Medium |
| 2 | **Public pipeline execution endpoint** — Pipeline can be triggered without admin auth (per previous audit) | High |
| 3 | **Hardcoded admin credentials** — Per previous audit, still unresolved | Critical |
| 4 | **No request body validation** — `zod` is a dependency but no evidence of schema validation on API inputs | High |
| 5 | **No rate limiting** on API endpoints | Medium |
| 6 | **`helmet` in dependencies but usage unverified** — CSP headers may not be configured | Medium |

### Database Issues

| # | Issue | Impact |
|---|---|---|
| 1 | No FK between `MembershipSubscription.userEmail` and `User.email` | Orphaned subscriptions possible |
| 2 | No FK between `TourEvent.courseName` and `Course.name` | No relational course data joins |
| 3 | `HistoricalRound` has no unique constraint | Duplicate rows on warehouse refresh |
| 4 | `Prediction` lacks `runId` field | Cannot scope predictions to a specific run |
| 5 | Duplicate player identity systems (`Player.dgId` vs `BetRecommendation.dgPlayerId`) with no FK | Player data integrity risk |
| 6 | `@@unique([runId, tour])` on `TourEvent` | Limits one event per tour per run |
| 7 | Missing `updatedAt` on most models | Cannot detect stale data |
| 8 | Dual run systems (`Run` + `SelectionRun`) | Confusion about authoritative source |

### Admin Dashboard Gaps

| # | Gap |
|---|---|
| 1 | No dashboard overview / KPI summary page |
| 2 | No bet performance analytics (ROI, hit rate over time) |
| 3 | No automated alerting for pipeline failures |
| 4 | Subscription management doesn't sync with Stripe (DB-only changes) |
| 5 | HIO question generator produces generic placeholder content |
| 6 | No user engagement metrics or activity monitoring |
| 7 | Audit log model exists but no evidence of population in reviewed code |
| 8 | No admin-facing data quality dashboard (issues exist but buried in Issues tab) |

### CI/CD Issues

| # | Issue |
|---|---|
| 1 | `continue-on-error: true` on lint/test — pipeline runs despite failures |
| 2 | `prisma db push` in CI (unsafe) vs `prisma migrate deploy` in server (safe) — inconsistent |
| 3 | Prisma generate runs after build — build may fail if Prisma client needed at build time |
| 4 | Missing `DATAGOLF_API_KEY` in CI env vars |
| 5 | No concurrency controls — overlapping pipeline runs possible |
| 6 | No failure notifications (Slack, email, webhook) |
| 7 | No deployment workflow — Railway deploys independently from CI |

### Security Concerns

| # | Concern | Severity |
|---|---|---|
| 1 | Hardcoded admin credentials (per previous audit) | Critical |
| 2 | Public pipeline execution endpoint (per previous audit) | High |
| 3 | No input validation framework on server routes | High |
| 4 | `allowedHosts: true` in Vite dev server | Low |
| 5 | Dual bcrypt libraries (`bcrypt` + `bcryptjs`) — unclear which is used | Medium |
| 6 | `playwright` in production dependencies (expands attack surface) | Low |
| 7 | Client-side admin role check (localStorage-manipulable) | Medium |
| 8 | DataGolf API key in query params (appears in logs) | Low |

---

## 6. 10 High-Impact, Low-Risk Enhancements

These improvements deliver significant value with minimal risk of breaking existing functionality.

| # | Enhancement | Impact | Risk | Effort |
|---|---|---|---|---|
| **E1** | **Fix player name normalization** — Unify `probability-engine.js` and `player-params.js` to use the same `cleanPlayerName()` function from `player-normalizer.js`. Add diacritics transliteration (e.g., `ö` → `o`) instead of stripping. | Fixes silent probability lookup failures for international players (Højgaard, Hovland, García, etc.) | Very Low — isolated change, improves correctness | 2 hours |
| **E2** | **Fix header/content overlap** — Change `pt-20` to `pt-36` (or `pt-[128px]`) in Layout.jsx to match `h-32` header height. | Fixes content being hidden behind the header on every single page | Very Low — single CSS change | 15 minutes |
| **E3** | **Wire vig removal into edge calculation** — Use `removeVigPower()` from `odds-utils.js` in `edge.ts` before computing `bookProb`. | More accurate edge calculations, fewer false negatives in bet selection | Low — mathematical improvement, no structural change | 1 hour |
| **E4** | **Remove `continue-on-error: true` from CI** — Let lint and test failures block pipeline execution. | Prevents broken code from generating erroneous production recommendations | Very Low — YAML config change | 15 minutes |
| **E5** | **Replace `prisma db push` with `prisma migrate deploy` in CI** — Align CI with the server start script. | Eliminates risk of production data loss during schema changes | Very Low — single command change | 15 minutes |
| **E6** | **Fix data issue severity sorting** — Replace `orderBy: { severity: 'desc' }` with a CASE expression or add a numeric `severityLevel` field that sorts correctly (error=3, warning=2, info=1). | Errors appear first in the admin Issues tab instead of being buried below warnings | Very Low — isolated query change | 30 minutes |
| **E7** | **Add null guard to `cleanPlayerName()`** — Add `if (!name) return ''` at the top of the function. | Prevents pipeline crashes when DataGolf returns null player names | Very Low — one-line defensive check | 10 minutes |
| **E8** | **Fix live tracking refresh interval display** — Change UI text from "every 60s" to "every 5 minutes" (or change `refetchInterval` to 60000 to match the claim). | Eliminates user confusion about update frequency | Very Low — text or config change | 10 minutes |
| **E9** | **Consolidate the 4 tier pages into a single parameterized component** — Create `TierPage.jsx` that accepts `tier` as prop. | Eliminates 75% code duplication across Par/Birdie/Eagle/LongShots pages. Future changes apply everywhere. | Low — refactor, no functional change | 3 hours |
| **E10** | **Replace `base44Client` with real API calls for user bets and providers** — Migrate `UserBet` CRUD and `BettingProvider` queries to use `client.js` (the real backend). | User bets actually persist to the server. Provider data comes from real DB. Core user functionality works properly. | Medium — requires backend endpoints to exist (verify first) | 4 hours |

---

## 7. 10 Feature Recommendations for User Experience

| # | Feature | Description | User Value |
|---|---|---|---|
| **F1** | **Bet Performance Dashboard** — A `/performance` page showing historical ROI, win rate by tier, profit/loss charts over time, and streak tracking. | Users can assess BetCaddies' track record, building trust and retention. Currently there's no way to see overall platform performance. | High |
| **F2** | **Push Notifications for Odds Movement** — Alert users when a recommended bet's odds move favorably (drift up) by a configurable threshold (e.g., 10%). | Users can act on value before odds shorten. Currently they must manually check the live tracking page. | High |
| **F3** | **Personalised Bet Feed** — Use the user's tour preferences and risk profile (from the Join wizard) to filter and rank the homepage feed. Show PAR bets first for conservative users, EAGLE/Long Shots first for aggressive users. | Removes friction of manual filtering. Each user sees the most relevant picks immediately. | High |
| **F4** | **In-App Bet Slip / Stake Calculator** — Let users build a virtual bet slip from recommended picks, enter stake amounts, and see potential returns, combined parlay odds, and Kelly criterion optimal stakes. | Converts passive browsing into active engagement. Helps users make informed staking decisions. | High |
| **F5** | **Tournament Countdown & Preview** — For each upcoming event, show a pre-tournament preview with course profile, weather forecast, key stats, and which BetCaddies picks have the strongest course fit. | Builds anticipation and engagement between pipeline runs. Uses data already in the DB (weather, course profiles) that's currently unused. | Medium |
| **F6** | **Social Proof & Community** — Add anonymized community stats: "87% of BetCaddies users are backing this pick", "Most popular pick this week", and a simple leaderboard for HIO Challenge. | Creates social engagement and FOMO. The HIO Challenge already exists but lacks a leaderboard. | Medium |
| **F7** | **Email Digest** — Weekly email sent after the pipeline completes, summarizing the week's top picks across all tiers, with direct links to each bet page. | Brings users back to the platform without requiring them to check manually. Drives engagement and retention. | High |
| **F8** | **Multi-Week Accumulator Builder** — Allow users to combine picks across multiple tournaments into multi-event accumulators, with combined probability and edge calculations. | Appeals to recreational bettors who enjoy accumulator betting. Differentiates from competitors who only show single-event picks. | Medium |
| **F9** | **Dark Mode** — Add a system-preference-aware dark mode toggle. The app already uses Tailwind CSS, making this straightforward with `dark:` variants. | Reduces eye strain for evening/night users (common during tournament weekends). A frequently requested feature in modern web apps. | Low-Medium |
| **F10** | **Bet Outcome Alerts** — When a tournament completes and outcomes are resolved, send an in-app notification (and optional push/email) showing which picks won, with links to the results page. | Closes the feedback loop. Users currently have to manually check the Results page to see outcomes. | Medium-High |

---

## Appendix: File Inventory

### Server & Pipeline
| File | Lines | Status |
|---|---|---|
| `src/server/index.js` | 4,410 | Active — monolithic |
| `src/pipeline/weekly-pipeline.js` | 2,456 | Active — primary pipeline |
| `src/pipeline/selection-pipeline.js` | 1,020 | Unused — alternate pipeline |
| `src/pipeline/golden-run.js` | 75 | Active — input invariant |
| `src/pipeline/smoke-test.js` | 44 | Broken — references missing module |
| `src/pipeline/backtest.js` | 81 | Broken — syntax error |
| `src/pipeline/warehouse-refresh.js` | 82 | Active |

### Engine (V2 — JavaScript)
| File | Purpose | Status |
|---|---|---|
| `src/engine/v2/probability-engine.js` | DataGolf → true probabilities | Active |
| `src/engine/v2/tournamentSim.js` | Monte Carlo simulation | Active |
| `src/engine/v2/player-params.js` | Skill → sim parameters | Active |
| `src/engine/v2/course-profile.js` | Course statistics | Disconnected |
| `src/engine/v2/marketWrappers.js` | Matchup/3-ball probabilities | Disconnected |
| `src/engine/v2/odds/odds-utils.js` | Odds/probability utilities | Active |
| `src/engine/v2/calibration/index.js` | Probability calibration | Stub |

### Engine (TypeScript Layer)
| File | Purpose | Status |
|---|---|---|
| `src/engine/runEngine.ts` | Engine orchestrator | Stub |
| `src/engine/betSelector/selector.ts` | Tier assignment | Stub |
| `src/engine/betSelector/explanation.ts` | Bet explanations | Stub |
| `src/engine/edgeCalculator/edge.ts` | Edge calculation | Active but no vig removal |
| `src/engine/portfolioOptimizer/optimizer.ts` | Portfolio selection | Active but basic |
| `src/engine/probabilityEngine/validate.ts` | Probability validation | Field name mismatch with V2 |
| `src/engine/featureFlags/*.ts` | Feature flags | Active |

### Data Sources
| File | Purpose | Status |
|---|---|---|
| `src/sources/datagolf/client.js` | DataGolf HTTP client | Active |
| `src/sources/datagolf/parsers.js` | Response parsing | Active |
| `src/sources/datagolf/tourMap.js` | Tour code mapping | Active |
| `src/sources/odds/allowed-books.js` | Sportsbook allow-list | Active (UK-focused) |
| `src/sources/odds/book-utils.js` | Book key normalization | Active |

### Frontend Pages (14 routes)
| File | Route | Status |
|---|---|---|
| `src/pages/Home.jsx` | `/` | Active — mock addBet |
| `src/pages/ParBets.jsx` | `/par-bets` | Active — base44 user bets |
| `src/pages/BirdieBets.jsx` | `/birdie-bets` | Active — base44 user bets |
| `src/pages/EagleBets.jsx` | `/eagle-bets` | Active — base44 user bets |
| `src/pages/LongShots.jsx` | `/long-shots` | Active — base44 user bets |
| `src/pages/LiveBetTracking.jsx` | `/live-tracking` | Active — timing mismatch |
| `src/pages/Results.jsx` | `/results` | Active |
| `src/pages/MyBets.jsx` | `/my-bets` | Active — localStorage only |
| `src/pages/HIOChallenge.jsx` | `/hio-challenge` | Active |
| `src/pages/Memberships.jsx` | `/memberships` | Active |
| `src/pages/Join.jsx` | `/join` | Active |
| `src/pages/Profile.jsx` | `/profile` | Active |
| `src/pages/Admin.jsx` | `/admin` | Active — monolith |
| `src/pages/Layout.jsx` | (shell) | Active — header overlap |

### Tests (13 files)
| File | Covers | Quality |
|---|---|---|
| `src/__tests__/bet-selection-engine.test.js` | Legacy selection engine | Basic (1 test) |
| `src/__tests__/golden-run.integration.test.js` | Input invariants | Basic (2 tests) |
| `src/__tests__/player-normalizer.test.js` | Name normalization | Good |
| `src/__tests__/selection-pipeline.integration.test.js` | DB integration | Requires live DB |
| `src/tests/current-week-mode.test.js` | Week mode pipeline | Good |
| `src/tests/datagolf-parsers.test.js` | Odds parsing | Basic (1 test) |
| `src/tests/live-tracking-service.test.js` | Live tracking | Basic (1 test) |
| `src/tests/odds-utils.test.js` | Odds utilities | Moderate |
| `src/tests/pipeline-dry-run.test.js` | Dry run mode | Basic |
| `src/tests/selection-strategy.test.js` | Tier selection | Best coverage |
| `src/tests/tournament-sim.test.js` | Monte Carlo sim | Loose bounds |

### Not Tested
- Express API routes
- Authentication / authorization
- Stripe webhook handling
- CMS endpoints
- HIO challenge creation
- User registration
- Audit logging
- Media upload
- Full end-to-end pipeline orchestration
- Error recovery and retry logic

---

*End of audit. No changes have been made to any files.*
