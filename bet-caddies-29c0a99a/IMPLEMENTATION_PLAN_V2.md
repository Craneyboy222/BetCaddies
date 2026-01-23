# Implementation Plan: V2 Unified Simulator (DataGolf-Only)

This document defines the production-ready V2 (“unified simulator”) plan for a DataGolf-only, pre‑tournament weekly pipeline that publishes Par/Birdie/Eagle/Long Shots picks for PGA, DPWT (euro), Korn Ferry (kft), and LIV (alt/liv). It is explicit about modules, file paths, endpoint calls, schema changes, and acceptance tests. No in‑play endpoints are used.

Assumptions (explicit):
- Tours are mapped via a single DataGolf tour map (per endpoint category) and the pipeline skips unsupported endpoint/tour combinations with a `DataIssue` record.
- The pipeline remains triggered by `POST /api/pipeline/run` and `npm run pipeline:weekly`.
- Existing UI expects fields such as `bet_title`, `selection_name`, `odds_display_best`, `odds_decimal_best`, `provider_best_slug`, `course_fit_score`, `form_label`, `weather_label`, `ai_analysis_paragraph`, `ai_analysis_bullets`, `alternative_odds`.
- Pre‑tournament only: no in‑play endpoints.
- “This week” is evaluated in a fixed timezone (Europe/London), Monday 00:00–Sunday 23:59 local time.

---

## 1) Architecture Overview (how V2 plugs in)

**New modules and integration points**
- DataGolf client: `src/sources/datagolf/` (new)
- V2 engine core: `src/engine/v2/`
  - `ProbabilityEngine` interface + simulator + market wrappers
- Pipeline orchestration updates: `src/pipeline/weekly-pipeline.js`
- Optional warehouse refresh: `src/pipeline/warehouse-refresh.js`
- Odds/EV processing utilities: `src/engine/v2/odds/`
- Calibration utilities: `src/engine/v2/calibration/`

**Interface boundary**
- `ProbabilityEngineV2.run({ event, field, historicalRounds, dgSignals })` returns probabilities for **all supported markets** using one simulator:
  - `outrights`: win, top_5, top_10, top_20, make_cut, mc, frl
  - `matchups`: tournament_matchups, round_matchups (R1 only)
  - `3_balls`

**High‑level sequence diagram (text)**
1. `POST /api/pipeline/run` → `WeeklyPipeline.run(runKey)`
2. `WeeklyPipeline`:
   - load schedule + event metadata from DataGolf
   - fetch field updates + player list
   - fetch DG preds + skill signals
   - fetch DataGolf betting tools odds
   - run V2 simulator → `p_sim` per market
   - compute market consensus `p_mkt` (vig‑removed weighted median)
   - blend: `logit(p_fair)=α·logit(p_sim)+β·logit(p_dg)+γ·logit(p_mkt)`
   - apply calibration (Platt/isotonic)
   - compute EV/edge vs best odds per selection
   - tier portfolio builder → Par/Birdie/Eagle/Long Shots
3. Persist: `Run`, `TourEvent`, `FieldEntry`, `OddsEvent/Market/Offer`, `BetRecommendation`
4. UI: `GET /api/bets/latest` and `/api/bets/tier/:tier` serve picks

**Market availability timing (Monday-only policy)**
- If `round_matchups` or `3_balls` are not available on Monday, skip those markets for that run and log `DataIssue`.
- Tiers are filled using available outrights/placements/FRL only in those cases.

---

## 2) DataGolf Integration Layer (DataGolf-only)

Create **new module directory**: `src/sources/datagolf/`
- `client.js` (or `index.js`) exporting typed functions
- Use `DATAGOLF_API_KEY` from env
- Include request timeouts and retry/backoff for 429/5xx

**Tour code map (single source of truth)**
Define a `tourMap` in the client and reference it for each endpoint category. Skip unsupported combinations and log `DataIssue`.
- PGA: `{ preds: "pga", odds: "pga", schedule: "pga", field: "pga", raw: "pga", histOdds: "pga" }`
- DPWT: `{ preds: "euro", odds: "euro", schedule: "euro", field: "euro", raw: "euro", histOdds: "euro" }`
- KFT: `{ preds: "kft", odds: "kft", schedule: "kft", field: "kft", raw: "kft", histOdds: null }`
- LIV: `{ preds: "alt", odds: "alt", schedule: "alt", field: null, raw: "liv", histOdds: "alt" }`

**Endpoints and functions**
All endpoints include `key=<DATAGOLF_API_KEY>` and `file_format=json`.

**General Use**
- `getPlayerList()`
  - `https://feeds.datagolf.com/get-player-list?file_format=json&key=${KEY}`
- `getSchedule(tour)`
  - `https://feeds.datagolf.com/get-schedule?tour=${tour}&season=${season}&upcoming_only=${upcoming_only}&file_format=json&key=${KEY}`
- `getFieldUpdates(tour)`
  - `https://feeds.datagolf.com/field-updates?tour=${tour}&file_format=json&key=${KEY}`

**Model Predictions**
- `getDgRankings()`
  - `https://feeds.datagolf.com/preds/get-dg-rankings?file_format=json&key=${KEY}`
- `getSkillRatings(display=value)`
  - `https://feeds.datagolf.com/preds/skill-ratings?display=${display}&file_format=json&key=${KEY}`
- `getApproachSkill(period=l24)`
  - `https://feeds.datagolf.com/preds/approach-skill?period=${period}&file_format=json&key=${KEY}`
- `getPlayerDecompositions(tour)`
  - `https://feeds.datagolf.com/preds/player-decompositions?tour=${tour}&file_format=json&key=${KEY}`
- `getPreTournamentPreds(tour, options)`
  - `https://feeds.datagolf.com/preds/pre-tournament?tour=${tour}&add_position=${add_position}&dead_heat=${dead_heat}&odds_format=decimal&file_format=json&key=${KEY}`

**Betting Tools**
- `getOutrightsOdds(tour, market)`
  - `https://feeds.datagolf.com/betting-tools/outrights?tour=${tour}&market=${market}&odds_format=decimal&file_format=json&key=${KEY}`
- `getMatchupsOdds(tour, market)`
  - `https://feeds.datagolf.com/betting-tools/matchups?tour=${tour}&market=${market}&odds_format=decimal&file_format=json&key=${KEY}`
- `getMatchupsAllPairings(tour)` (optional)
  - `https://feeds.datagolf.com/betting-tools/matchups-all-pairings?tour=${tour}&odds_format=decimal&file_format=json&key=${KEY}`

**Historical Raw Data (warehouse + calibration)**
- `getHistoricalRawEventList(tour)`
  - `https://feeds.datagolf.com/historical-raw-data/event-list?tour=${tour}&file_format=json&key=${KEY}`
- `getHistoricalRawRounds(tour, event_id, year)`
  - `https://feeds.datagolf.com/historical-raw-data/rounds?tour=${tour}&event_id=${event_id}&year=${year}&file_format=json&key=${KEY}`

**Historical Odds (calibration; optional)**
- `getHistoricalOddsEventList(tour)`
  - `https://feeds.datagolf.com/historical-odds/event-list?tour=${tour}&file_format=json&key=${KEY}`
- `getHistoricalOutrights(tour,event_id,year,market,book)`
  - `https://feeds.datagolf.com/historical-odds/outrights?tour=${tour}&event_id=${event_id}&year=${year}&market=${market}&book=${book}&odds_format=decimal&file_format=json&key=${KEY}`
- `getHistoricalMatchups(tour,event_id,year,book)`
  - `https://feeds.datagolf.com/historical-odds/matchups?tour=${tour}&event_id=${event_id}&year=${year}&book=${book}&odds_format=decimal&file_format=json&key=${KEY}`

**Retries/timeouts**
- Timeout: 15–20s per request
- Backoff: exponential with jitter; max 3 retries for 429/5xx

---

## 3) Scheduling Strategy (Monday autonomous)

**Recommended approach**
- **Railway Cron** (preferred) to call `POST /api/pipeline/run` every Monday (e.g., 06:00 UTC)
- Keep manual admin trigger via existing endpoint

**Week window**
- “This week” is computed in Europe/London time (Mon 00:00–Sun 23:59) for schedule filtering.

**Idempotency**
- `Run.runKey` enforced unique (weekStart + tours + “weekly” string). RunKey prevents double-run writes.
- Pipeline should upsert or return early if an existing completed run for the same runKey exists.

---

## 4) Prisma / Database Changes (minimal but sufficient)

**Schema changes**
1) Add `Run.runKey` if missing; enforce `@unique` for idempotency.
2) Add `RunArtifact` table for lightweight metadata (hashes, params, small payloads only).
3) Add warehouse tables for historical rounds (optional but recommended).

**Proposed schema diff (prisma/schema.prisma)**
- `Run.runKey String @unique` (already exists; confirm uniqueness used for idempotency)
- New model: `RunArtifact`
  - `id`, `runId`, `tour`, `endpoint`, `paramsJson`, `payloadJson`, `payloadHash`, `payloadBytes`, `artifactRef`, `fetchedAt`
  - Store large payloads (odds/matchups/historical raw rounds) outside Postgres (S3/R2/local file store) and record `artifactRef` only.
  - Never store full historical rounds payload in `RunArtifact`; normalize into `HistoricalRound` only.
  - If `payloadJson` is used, keep it small and optionally gzip before storage.
- New model: `HistoricalRound`
  - `id`, `tour`, `eventId`, `year`, `playerId`, `round`, `statsJson`, `strokesGainedJson`, `teeTimeUtc`, `createdAt`
  - Indexes on `(tour,eventId,year)` and `(playerId)`

**Migration steps**
- `prisma migrate dev -n add_run_artifacts_and_historical_rounds`
- Run `prisma migrate deploy` in Railway

**Artifact retention**
- Keep only the most recent N runs (e.g., last 8) for stored artifacts; purge older refs and external files.

---

## 5) Warehouse Refresh Job (so Monday is fast)

**New script**: `src/pipeline/warehouse-refresh.js`
- Purpose: incrementally fetch historical rounds and (optionally) historical odds for calibration
- Logic:
  - For each tour, fetch `historical-raw-data/event-list`
  - For events not yet stored (or missing rounds), fetch `historical-raw-data/rounds`
  - Store in `HistoricalRound`
- Schedule:
  - Nightly or weekly via Railway Cron
  - Manual run via CLI: `node src/pipeline/warehouse-refresh.js`

**Retention policy**
- Rolling 24 months (configurable). Drop or ignore older data in queries.

---

## 6) V2 Player + Course Modeling (pre-simulation)

**Directory**: `src/engine/v2/`
- `player-params.js`: `BuildPlayerParams(field, historicalRounds, dgSkillSignals)`
- `course-profile.js`: `BuildCourseProfile(event, historicalCourseRounds)`

**Player params (defaults)**
- Expected mean (per-round SG proxy): blend of DG skill ratings + recent historical rounds
- Volatility: empirical std dev with shrinkage
- Tail parameter: Student‑t df=7 default (configurable)
- Cut‑risk param: derived from DG pre‑tournament make_cut probability (cut tours only)

**Course profile**
- Scoring mean/variance from historical course rounds (if available)
- Course identity weights from DG decompositions + approach buckets

**Fallbacks**
- If course history sparse: fall back to tour‑level averages
- If player lacks rounds: rely on DG rankings/skill ratings only

---

## 7) V2 Tournament Simulator (one engine)

**Module**: `src/engine/v2/tournamentSim.js`

**Supported formats**
- PGA/DPWT/KFT: 72 holes + cut after R2
- LIV: 54 holes, no cut

**Cut rules (tour defaults + event override)**
- `cutRuleByTour` defaults (override per event when known):
  - PGA: top 65 and ties (some events vary)
  - DPWT: top 65 and ties (varies)
  - KFT: top 65 and ties (varies)
  - LIV: no cut
- If the event-specific cut rule is unknown or differs, apply the tour default and log a `DataIssue` (event override support can be added later).

**Stochastic components**
- Round‑level field shock per round
- Player week‑level latent form
- Correlation structure for matchup realism (simple shared shocks per round)

**Config**
- `SIM_COUNT` env default 10,000
- `SIM_SEED` optional for reproducibility

**Outputs**
- Per-simulation totals + positions
- Derived market probabilities for all supported markets
- Optional compressed outputs stored in `RunArtifact` or separate table

---

## 8) Market Wrappers (derived from the same sims)

**Module**: `src/engine/v2/marketWrappers.js`

**Derived probabilities**
- Outrights/placements: win, top_5, top_10, top_20 from finish distributions
- Make/miss cut: from R2 cut outcomes (cut tours only)
- FRL: from round‑1 scores (tie handling via dead‑heat)
- Matchups: `P(A<B)+0.5*P(A=B)` (push rules)
- 3‑balls: joint probability A beats both B and C

**Dead heat**
- Apply dead heat adjustment where required (win/top‑N/FRL)

---

## 9) Odds Processing + EV Engine

**Refactor**: `src/pipeline/weekly-pipeline.js`
- Replace odds fetch with DataGolf betting tools endpoints
- Convert odds → implied probabilities
- Remove vig
  - Outrights/placements: power method (default, k=1.25 initial) with tuning from historical odds; allow Shin as alternative
  - Matchups: normalize two‑way
  - 3‑balls: three‑way normalize
- Market consensus: weighted median of vig‑removed probabilities
- Blend fair probability:
  - `logit(p_fair)=0.70·logit(p_sim)+0.20·logit(p_dg)+0.10·logit(p_mkt)`
- Apply calibration (Platt/isotonic) per market/tour using historical outcomes if enabled
  - Require separate calibration maps for win/FRL/top‑20/matchups per tour
  - Provide fallbacks for tours without historical odds coverage (e.g., KFT/LIV)
- Compute EV/edge for each selection using **best available odds**
- Enforce odds freshness via `ODDS_FRESHNESS_HOURS`

---

## 10) Tier Portfolio Builder (Par/Birdie/Eagle/Long Shots)

**Tier definitions (continuous bands, no gaps)**
- Par: decimal < 6.0 ( < 5/1 )
- Birdie: 6.0–10.0 (5/1–9/1)
- Eagle: > 10.0–60.0 (10/1–59/1)
- Long Shots: ≥ 61.0 (60/1+)

**Rules**
- Classification uses best available odds for each selection
- If tier can’t reach `MIN_PICKS_PER_TIER`, relax EV threshold and log `DataIssue`
- Add exposure caps:
  - max picks per player (default 2)
  - max per market type (default 5)
  - avoid redundant correlated exposure when possible

**Deterministic tier-fill fallback (never force bad picks)**
1. Use all available markets with strict EV threshold.
2. If short, lower EV threshold slightly (bounded).
3. If still short, widen eligible markets within the same tier (e.g., include more FRL in Eagle/Long Shots).
4. If still short, publish fewer picks and log a `DataIssue`.

**Persistence**
- Save picks into `BetRecommendation`
- Respect `BetOverride` tier overrides/pinning

---

## 11) UI/Data Contract Adjustments (minimal)

**Minimal UI behavior**
- Make optional fields safe: `weather_label`, `form_label`, `course_fit_score`
- Ensure backend formatting populates:
  - `bet_title`, `selection_name`, `odds_display_best`, `odds_decimal_best`, `provider_best_slug`, `ai_analysis_paragraph`, `ai_analysis_bullets`, `alternative_odds`

**Files**
- Backend formatter in `src/server/index.js` (existing output transformation)
- UI renders in `src/components/ui/BetCard.jsx`

---

## 12) Tests, Validation, and Acceptance Criteria

**Unit tests** (Vitest under `src/tests/`)
- Vig removal (outrights vs matchups vs 3‑balls)
- Weighted median consensus
- Logit blend + bounds checks
- Tier classification (Eagle up to 59/1, Long Shots ≥60/1)
- Simulator sanity (prob sums, monotonic top‑N)
- Matchup/3‑ball wrappers (tie handling)

**Test runner integration**
- Use Vitest (aligned with Vite).
- Add scripts: `npm run test`, `npm run test:watch`.
- Optional CI step to run `npm run test`.

**Integration tests**
- Add dry‑run mode: `PIPELINE_DRY_RUN=true`
  - Pull DataGolf data
  - Run simulator + EV + tier selection
  - Write nothing or store temp run artifacts only
  - Output summary (counts per tier, per tour/event, top edges)
- Add one dry‑run integration test that uses mocked DataGolf fixtures (no network calls).

**Acceptance criteria**
- `/api/pipeline/run` returns quickly, pipeline runs async
- `runKey` idempotency prevents duplicate weekly runs
- For each tour with an event: ≥ `MIN_PICKS_PER_TIER` for Par/Birdie/Eagle/Long Shots or a `DataIssue` explains shortage
- Logs show endpoint timings and failures
- UI renders picks even if optional fields are null

---

## Commit-by-commit sequence (recommended)
1. Add DataGolf client scaffold + env var handling
2. Add RunArtifact model + migration
3. Add HistoricalRound model + migration
4. Add warehouse refresh job script
5. Add V2 engine skeleton + ProbabilityEngine interface
6. Implement player params + course profile
7. Implement simulator + market wrappers
8. Add odds processing + vig removal utilities
9. Implement blending + calibration
10. Wire pipeline to DataGolf + V2 outputs
11. Update server formatting for BetCard data
12. Add dry‑run pipeline mode
13. Add unit tests
14. Add integration test coverage
15. Update docs + go‑live checklist

---

## Go‑live checklist (Railway)
- Set env vars:
  - `DATAGOLF_API_KEY` (secret)
  - `SIM_COUNT`, `ODDS_FRESHNESS_HOURS`, `MIN_PICKS_PER_TIER`
- Run Prisma migrations on Railway
- Configure Railway Cron to call `POST /api/pipeline/run` Monday 06:00 UTC
- Validate dry‑run in production
- Run live pipeline and confirm picks in UI

---

End of plan.
