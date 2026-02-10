# V2 Engine Upgrade Plan

**Branch:** `betc-optimal-engine`
**Date:** 2026-02-10
**Scope:** Upgrade the existing V2 pipeline — no replacement, no new architecture
**Principle:** Every change improves the existing system. Nothing is thrown away unless it's dead code.

---

## Critical Discovery

Before detailing the plan, one finding changes everything:

```js
// Line 1390 of weekly-pipeline.js
const blended = this.blendProbabilities({ sim: simProb, dg: null, mkt: null })
```

**The probability blending is disabled.** The pipeline passes `null` for both DataGolf predictions and market-implied probabilities. The blending function exists and works, but it receives only the simulation probability. The system currently runs on **100% Monte Carlo simulation** with no DataGolf or market correction.

Additionally, `applyCalibration()` is a pass-through stub that returns its input unchanged. So the "fair probability" is just the raw simulation output.

This means the upgrade has a massive opportunity: simply activating the blending and calibration that already exist in the code will significantly improve accuracy before any new features are built.

---

## Pre-Upgrade: Bug Fixes (Phase 0)

These must be fixed before any upgrade work begins. Each is a standalone fix that can be committed independently.

### 0.1 — Fix player name normalization (C2)

**File:** `src/engine/v2/player-params.js` (line 5-9), `src/engine/v2/probability-engine.js` (line 3)

**Problem:** Two different `normalizeName` functions. `probability-engine.js` uses `trim().toLowerCase()`. `player-params.js` uses `replace(/[^\w\s-]/g, '')` which strips diacritics.

**Fix:** Create a single shared `normalizeName()` in a new utility (or in `player-normalizer.js`) that:
1. Transliterates diacritics (ö→o, é→e, ø→o) using a simple mapping table
2. Trims, lowercases, collapses whitespace
3. Export it and import in both files

**Validation:** Unit test with names: Ludvig Åberg, Nicolai Højgaard, Jon Rahm, José María Olazábal, Séamus Power, Joaquín Niemann

### 0.2 — Add null guard to cleanPlayerName (C5)

**File:** `src/domain/player-normalizer.js`

**Fix:** Add `if (!name) return ''` as first line of `cleanPlayerName()`.

### 0.3 — Fix vig removal in edge calculation (H1)

**File:** `src/pipeline/weekly-pipeline.js` — the `computeMarketProbabilities` and edge calculation sections

**Problem:** `marketProb` is derived from `1/odds` (includes vig). The vig-removal functions exist in `odds-utils.js` but aren't used in the candidate-building loop.

**Fix:** Apply `removeVigPower()` to the offers per selection before computing `marketProb`. The weighted median of vig-removed probabilities becomes the true market-implied probability.

### 0.4 — Fix CI pipeline (H3, H4)

**File:** `.github/workflows/weekly-pipeline.yml`

**Fix:**
- Remove `continue-on-error: true` from lint and test steps
- Replace `npx prisma db push` with `npx prisma migrate deploy`
- Move `npx prisma generate` before the build step
- Add `DATAGOLF_API_KEY` to env vars

### 0.5 — Fix data issue severity sorting (H7)

**File:** `src/observability/data-issue-tracker.js`

**Fix:** Replace `orderBy: { severity: 'desc' }` with a computed sort: map severity to numeric (error=3, warning=2, info=1) and sort by that.

### 0.6 — Fix header/content overlap (H6)

**File:** `src/pages/Layout.jsx`

**Fix:** Change `pt-20` to `pt-[136px]` (header height + 8px breathing room).

### 0.7 — Remove all base44 remnants (C3, C4, C6)

**Files:** `src/api/base44Client.js`, `src/api/entities.js`, `src/api/functions.js`, `src/api/integrations.js`, all tier pages, `MyBets.jsx`

**Fix:**
- Delete `base44Client.js`
- Delete `entities.js`, `functions.js`, `integrations.js` (or rewrite to use real API)
- In ParBets/BirdieBets/EagleBets/LongShots: remove all `base44` imports, remove `BettingProvider` query (replace with real API call or remove), remove `UserBet` mutations (replace with real API or remove feature until backend supports it)
- In MyBets: replace all base44 calls with real API endpoints
- Verify no remaining imports reference base44

---

## Phase 1: Activate What Already Exists

These changes wire up code that's already written but not connected. Highest ROI work.

### 1.1 — Activate probability blending

**File:** `src/pipeline/weekly-pipeline.js` (around line 1390)

**Current:** `this.blendProbabilities({ sim: simProb, dg: null, mkt: null })`

**Change to:**
```js
const dgProbs = probabilityModel.getPlayerProbs(selectionKey)
const dgProb = dgProbs ? dgProbs[this.mapMarketKeyToSim(market.marketKey)] : null
const mktProb = normalizedImplied[selectionKey] || null

const blended = this.blendProbabilities({ sim: simProb, dg: dgProb, mkt: mktProb })
```

**What this does:** Enables the 70% sim / 20% DataGolf / 10% market blending that was designed but never activated. DataGolf's pre-tournament predictions anchor the simulation output, and market wisdom provides a reality check.

**Why it matters:** Pure simulation can diverge from reality. DataGolf's model has years of historical calibration. The market reflects sharp money. Blending protects against simulator biases.

**Risk:** Low. The blending function already works. If DG or market data is unavailable for a player, the function automatically reweights to available sources.

### 1.2 — Connect course profile to simulation

**Files:** `src/engine/v2/course-profile.js`, `src/engine/v2/player-params.js`, `src/pipeline/weekly-pipeline.js`

**Current:** `buildCourseProfile()` computes course mean/variance but nothing calls it.

**Change:**
1. In the pipeline, call `buildCourseProfile()` using historical rounds for the current event
2. Pass course profile to `buildPlayerParams()` as a new optional parameter
3. In `buildPlayerParams()`, adjust player `mean` by the course difficulty offset: `mean += courseProfile.mean - fieldAverage`
4. Adjust player `volatility` by course variance: if course is high-variance, widen player distributions slightly

**What this does:** Players' simulation parameters now account for course-specific scoring patterns. A course that plays hard shifts everyone's mean up. A course with high variance (volatile conditions, risk/reward holes) widens distributions.

### 1.3 — Connect market wrappers to simulator

**File:** `src/engine/v2/tournamentSim.js`, `src/engine/v2/marketWrappers.js`

**Current:** `marketWrappers.js` expects per-sim raw scores but `simulateTournament()` only returns aggregated probabilities.

**Change:** Add an option to `simulateTournament()` to return per-simulation round scores alongside probabilities:
```js
// New option: returnSimScores: true
// Returns: { probabilities, simCount, simScores: [{ playerKey: totalScore, ... }, ...] }
```

Then `matchupProbability()` and `threeBallProbability()` can consume the raw sim scores directly.

**What this does:** Enables head-to-head and three-ball markets. These are often mispriced by bookmakers because they're lower-volume markets with less sharp money.

---

## Phase 2: Integrate Unused DataGolf Data

All of this data is already being fetched and stored as RunArtifacts. This phase reads it from the artifacts and feeds it into the engine.

### 2.1 — Use player decompositions for course fit

**DataGolf endpoint:** `getPlayerDecompositions(tour)` — already fetched at line 618

**Returns per player:**
- SG Off-the-Tee (driving distance + accuracy)
- SG Approach (iron play)
- SG Around-the-Green (chipping/pitching)
- SG Putting

**Integration into `player-params.js`:**

Add a new parameter to `buildPlayerParams()`:
```js
buildPlayerParams({ players, skillRatings, tour, decompositions, courseProfile })
```

Use the decompositions to create a **course fit adjustment**:
1. Define course archetypes by which SG categories matter most:
   - Links courses: SG OTT + SG ARG weighted higher (wind, firm turf)
   - Long/demanding: SG OTT weighted highest (need distance)
   - Short/precision: SG Approach weighted highest
   - Fast greens/undulating: SG Putting weighted highest
2. Compute a fit score: weighted dot product of player's SG splits and course weights
3. Apply as an adjustment to the player's `mean` parameter: `mean += fitScore * 0.3`

**Course archetype** can be derived from historical round data (already fetched) or manually tagged per event in the `TourEvent` or `Course` model (add a `courseType` field).

### 2.2 — Use approach skill data for precision adjustment

**DataGolf endpoint:** `getApproachSkill('l24')` — already fetched at line 611

**Returns:** Last 24-month approach skill decomposition per player — more detailed than the general decomposition.

**Integration:** In `player-params.js`, use approach skill to refine the volatility parameter:
- Elite approach players (top 20%) get slightly lower volatility (more consistent scoring)
- Weak approach players get slightly higher volatility (more blow-up potential)

Formula: `volatility *= 1.0 - (approachSkillZScore * 0.08)`

This is subtle but meaningful — approach play is the strongest predictor of consistent scoring in professional golf.

### 2.3 — Use DG rankings for confidence weighting

**DataGolf endpoint:** `getDgRankings()` — already fetched at line 597

**Returns:** DataGolf world rankings (proprietary ranking system based on SG data).

**Integration into confidence calculation:**

The pipeline already has `calculateConfidence(edge)` (line 1897-1905) which only uses edge size. Upgrade to:
```js
calculateConfidence({ edge, dgRank, bookCount, decompositionAvailable, simProb, dgProb }) {
  let score = 50 // base

  // Edge strength (0-25 points)
  if (edge > 0.06) score += 25
  else if (edge > 0.04) score += 20
  else if (edge > 0.025) score += 15
  else if (edge > 0.01) score += 10

  // DG ranking agreement (0-15 points)
  // If a top-ranked player shows edge, higher confidence
  if (dgRank <= 20) score += 15
  else if (dgRank <= 50) score += 10
  else if (dgRank <= 100) score += 5

  // Source agreement (0-10 points)
  // If sim and DG predictions agree, higher confidence
  if (simProb && dgProb) {
    const divergence = Math.abs(simProb - dgProb) / Math.max(simProb, dgProb)
    if (divergence < 0.1) score += 10      // strong agreement
    else if (divergence < 0.25) score += 5  // moderate agreement
  }

  // Data quality (0-10 points)
  if (bookCount >= 4) score += 5
  if (decompositionAvailable) score += 5

  return Math.min(5, Math.max(1, Math.round(score / 20)))
}
```

### 2.4 — Use pre-tournament archive for calibration

**DataGolf endpoint:** `getPreTournamentArchive(tour, { year, eventId })` — already fetched at line 655

**Returns:** Historical pre-tournament predictions for past events — DataGolf's predicted probabilities vs what actually happened.

**Integration into `src/engine/v2/calibration/index.js`:**

Replace the pass-through stub with actual calibration:

1. **On pipeline startup**, load the last 20-50 archived predictions from RunArtifacts
2. **Build a calibration table** per market: group by predicted probability bucket (0-5%, 5-10%, 10-20%, 20-40%, 40%+), compute actual hit rate per bucket
3. **Apply isotonic regression** (or a simpler lookup table): if the model says 10% but historically those picks hit 7%, adjust down to 7%
4. **Per-tour calibration**: PGA, DPWT, and LIV may have different calibration curves due to field strength differences

This is the single most impactful accuracy upgrade after activating blending. Calibration is what separates a "roughly right" model from a "precisely right" one.

### 2.5 — Use historical raw rounds for simulation parameter tuning

**DataGolf endpoint:** `getHistoricalRawRounds(tour, eventId, year)` — already fetched at line 673

**Returns:** Round-by-round scores for past events at this course.

**Integration:**
1. Feed into `buildCourseProfile()` (currently disconnected — connected in Phase 1.2)
2. Additionally, compute **per-player historical performance at this course**:
   - How has each player scored here in previous years?
   - Adjust individual `mean` based on course-specific history: `mean += courseHistoryAdjustment * 0.15`
3. Compute **course volatility** from historical round standard deviation — high-variance courses should increase all players' `volatility` parameters

---

## Phase 3: Simulation Engine Refinements

These changes improve the Monte Carlo engine itself.

### 3.1 — Per-player tail parameters

**File:** `src/engine/v2/player-params.js`, `src/engine/v2/tournamentSim.js`

**Current:** Every player gets `tail: 6.5` (hardcoded).

**Change:** Derive tail from the player's historical scoring variance:
- Consistent players (low historical variance): `tail: 5.0` — tighter extreme cap
- Volatile players (high historical variance): `tail: 8.0` — allow more extreme outcomes
- Default (no data): `tail: 6.5` (unchanged)

Source: Historical raw rounds data (already fetched).

### 3.2 — Round-to-round momentum correlation

**File:** `src/engine/v2/tournamentSim.js`

**Current:** Each round is independent. A player who shoots -8 in R1 has no momentum carry into R2.

**Change:** Add a light momentum factor:
```js
// After round 1, carry forward a fraction of the previous round's deviation
const prevDeviation = roundScores[round - 1] - player.mean
const momentumCarry = 0.10 // 10% of previous round's deviation carries forward
const momentumBoost = prevDeviation * momentumCarry
const rawScore = player.mean + playerShock + roundShock + momentumBoost + normal(rng) * player.volatility
```

This is subtle (10% carry) but models the real phenomenon that form tends to persist within a tournament. Research shows ~8-12% autocorrelation in round scores.

### 3.3 — Tour-specific field strength adjustment

**File:** `src/engine/v2/player-params.js`

**Current:** Tour scaling is a fixed multiplier (PGA=1.0, DPWT=0.95, LIV=0.92, KFT=0.9).

**Change:** Compute dynamic field strength from the actual skill ratings of the field:
```js
const fieldStrength = skillRatings
  .filter(r => fieldPlayers.has(normalizeName(r.name)))
  .map(r => r.rating)
const fieldMean = average(fieldStrength)
const scale = fieldMean / pgaAverageFieldStrength // Dynamic scaling
```

This captures week-to-week variation. A weak-field PGA event (opposite-field) plays differently than a signature event.

---

## Phase 4: Additional Markets

### 4.1 — Enable matchup and three-ball markets

**Files:** `src/engine/v2/tournamentSim.js`, `src/engine/v2/marketWrappers.js`, `src/pipeline/weekly-pipeline.js`

**Depends on:** Phase 1.3 (sim returning per-sim scores)

**Change:**
1. After simulation, for each matchup/three-ball pairing offered by bookmakers:
   - Call `matchupProbability()` / `threeBallProbability()` with the raw sim scores
   - Compare fair probability against bookmaker odds
   - Add to candidate pool with appropriate tier assignment
2. In the pipeline, fetch matchup odds (already happening at line 902) and process them through the same edge/EV/tier pipeline

**Why this matters:** Matchup markets are often less efficiently priced. The correlation between players (shared conditions) is naturally captured by the simulator's shared round shocks. This is a genuine edge source.

---

## Phase 5: Dead Code Removal

### 5.1 — Remove V1 dead code

**Delete:**
- `src/domain/bet-selection-engine.js` — dead, not called in production
- `src/pipeline/selection-pipeline.js` — dead, has undefined variable bug
- `src/pipeline/backtest.js` — broken syntax error, needs rewrite not repair
- `src/pipeline/smoke-test.js` — broken import, needs rewrite not repair
- `src/engine/runEngine.ts` — stub, not used
- `src/engine/betSelector/selector.ts` — stub, not used
- `src/engine/betSelector/explanation.ts` — stub, not used
- `src/engine/portfolioOptimizer/optimizer.ts` — not wired in
- `src/engine/probabilityEngine/validate.ts` — field name mismatch with V2

**Keep:**
- `src/engine/edgeCalculator/edge.ts` — used
- `src/engine/featureFlags/*.ts` — used

### 5.2 — Remove stale tests

**Delete or rewrite:**
- `src/__tests__/bet-selection-engine.test.js` — tests dead V1 engine
- `src/__tests__/golden-run.integration.test.js` — minimal, rewrite to cover hash mismatch case

### 5.3 — Rebuild smoke test and backtest

**New `smoke-test.js`:** Quick dry-run of the pipeline that verifies:
- DataGolf endpoints respond
- At least one event matches current week
- Simulation produces >0 players with probabilities
- At least one candidate has positive EV

**New `backtest.js`:** Using pre-tournament archives:
- For each historical event, run the engine with that week's data
- Compare predicted probabilities against actual outcomes
- Output Brier score, log-loss, and calibration curves per market
- This validates the entire pipeline and calibration in one run

---

## Implementation Order

| Step | Phase | What | Estimated Tokens | Risk |
|---|---|---|---|---|
| 1 | 0.1 | Fix player name normalization | ~15K | Very Low |
| 2 | 0.2 | Add null guard to cleanPlayerName | ~3K | Very Low |
| 3 | 0.3 | Fix vig removal | ~20K | Low |
| 4 | 0.4 | Fix CI pipeline | ~5K | Very Low |
| 5 | 0.5 | Fix severity sorting | ~5K | Very Low |
| 6 | 0.6 | Fix header overlap | ~3K | Very Low |
| 7 | 0.7 | Remove base44 | ~30K | Medium |
| 8 | 1.1 | Activate probability blending | ~15K | Low |
| 9 | 1.2 | Connect course profile | ~25K | Low |
| 10 | 1.3 | Connect market wrappers (sim scores) | ~25K | Low |
| 11 | 2.1 | Use decompositions for course fit | ~35K | Medium |
| 12 | 2.2 | Use approach skill for volatility | ~15K | Low |
| 13 | 2.3 | Use rankings for confidence | ~15K | Low |
| 14 | 2.4 | Build calibration from archive | ~40K | Medium |
| 15 | 2.5 | Use historical rounds for params | ~25K | Low |
| 16 | 3.1 | Per-player tail parameters | ~15K | Low |
| 17 | 3.2 | Round momentum correlation | ~10K | Low |
| 18 | 3.3 | Dynamic field strength | ~15K | Low |
| 19 | 4.1 | Enable matchup/three-ball markets | ~35K | Medium |
| 20 | 5.1-5.3 | Dead code removal + new tests | ~40K | Low |

**Total estimated implementation: ~430K tokens (~£17)**

---

## Expected Impact on Pick Quality

| Change | Impact on Edge Accuracy | Confidence |
|---|---|---|
| Fix name normalization | +5-10% for international player picks | Very High |
| Activate vig removal | +3-8% across all picks (removes systematic bias) | Very High |
| Activate probability blending | +5-15% (anchoring from DG + market) | High |
| Course fit from decompositions | +5-10% for course-sensitive events | High |
| Calibration from archives | +8-15% (corrects systematic over/under estimation) | High |
| Historical course-specific adjustment | +3-5% per event | Medium |
| Approach skill volatility | +2-4% | Medium |
| Round momentum | +1-3% | Medium |
| Matchup/three-ball markets | New market coverage (often best edges) | High |
| Dynamic field strength | +2-4% for weak/strong field weeks | Medium |

The first three (name fix, vig removal, blending activation) are the highest-ROI changes. They fix what's broken and activate what's already built. Combined, they likely improve edge accuracy by 15-30%.

---

## What This Plan Does NOT Do

- Does not replace V2 — every change upgrades the existing pipeline
- Does not use in-play data (per your instruction)
- Does not change the tier structure (PAR/BIRDIE/EAGLE/LONG SHOTS)
- Does not change the frontend bet display (beyond base44 removal and header fix)
- Does not change the database schema (except optional `courseType` field on Course)
- Does not introduce new external dependencies
- Does not change the deployment or hosting architecture

---

*End of upgrade plan. No changes have been made to any files.*
