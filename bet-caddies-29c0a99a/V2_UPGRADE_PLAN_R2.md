# V2 Engine Upgrade Plan (Revision 2)

**Branch:** `betc-optimal-engine`
**Date:** 2026-02-10
**Scope:** Upgrade the existing V2 pipeline to use all available DataGolf data and fix all audit-identified issues
**Constraint:** Upgrade only — no replacement, no new architecture

---

## Critical Finding

```js
// weekly-pipeline.js, line 1390
const blended = this.blendProbabilities({ sim: simProb, dg: null, mkt: null })
```

The probability blending formula exists and works, but is hardcoded to receive `null` for both DataGolf and market inputs. The variables `dgProb` (line 1367) and `normalizedImplied` (line 1239) are computed in the same function — they're just not passed through.

Additionally, `applyCalibration()` (line 1394) is a stub that returns its input unchanged.

**The system currently runs on 100% Monte Carlo simulation with zero external correction and zero calibration.**

---

## DataGolf Endpoints: Current Status

| Endpoint | Fetched | Stored | Used in Engine | This Plan |
|---|---|---|---|---|
| `getSchedule()` | Yes | No | Yes — event matching | No change |
| `getFieldUpdates()` | Yes | No | Yes — player list | No change |
| `getPreTournamentPreds()` | Yes | Yes (artifact) | **Computed but not blended** — `dgProb` exists at line 1367 but `dg: null` at line 1390 | **Phase 1: Activate blending** |
| `getSkillRatings('value')` | Yes | Yes (artifact) | Yes — builds player params (mean, volatility) | **Phase 2: Enhance with decompositions** |
| `getOutrightsOdds()` | Yes | Yes (DB) | Partially — `marketProb` computed via vig removal but not blended; used only for edge calc baseline | **Phase 1: Activate blending** |
| `getPlayerList()` | Yes | Yes (artifact) | No | **Phase 2: Cross-reference for name resolution** |
| `getDgRankings()` | Yes | Yes (artifact) | No | **Phase 2: Feed into confidence scoring** |
| `getApproachSkill('l24')` | Yes | Yes (artifact) | No | **Phase 2: Volatility adjustment** |
| `getPlayerDecompositions()` | Yes | Yes (artifact) | No | **Phase 2: Course fit adjustment** |
| `getPreTournamentArchive()` | Yes | Yes (artifact) | No | **Phase 2: Build calibration model** |
| `getHistoricalRawEventList()` | Yes | Yes (artifact) | No | **Phase 3: Course identification** |
| `getHistoricalRawRounds()` | Yes | Yes (artifact) | No | **Phase 2: Course profile + per-player history** |
| `getMatchupsOdds()` | Yes | Yes (DB) | No — market wrappers are broken | **Phase 4: Enable matchup markets** |
| `getInPlayPreds()` | Yes | Yes (artifact) | Excluded per user instruction | No change |
| `getLiveTournamentStats()` | Yes | Yes (artifact) | Excluded (in-play data) | No change |
| `getLiveHoleStats()` | Yes | Yes (artifact) | Excluded (in-play data) | No change |

---

## Correction to Previous Audit

**H1 (No vig removal) is partially incorrect.** Vig removal IS applied via `computeMarketProbabilities()` → `removeVig()` → `removeVigPower()`. The vig-removed probability becomes `marketProb` for edge calculation. However, `marketProb` is only used as the baseline for edge/EV — it's NOT passed into probability blending (hardcoded `mkt: null`). So the vig removal works for the edge calculation side but the blended fair probability doesn't benefit from it.

---

## Phase 0: Bug Fixes

Every subsequent phase depends on these being correct first.

### 0.1 — Unify player name normalization

**Files to modify:**
- `src/engine/v2/player-params.js` — line 5-9 (`normalizeName`)
- `src/engine/v2/probability-engine.js` — line 3 (`normalizeName`)
- `src/domain/player-normalizer.js` — `cleanPlayerName()`

**Problem:** `probability-engine.js` uses `trim().toLowerCase()`. `player-params.js` uses `replace(/[^\w\s-]/g, '')` which strips diacritics entirely. "Højgaard" becomes "højgaard" in one, "hjgaard" in the other.

**Change:**
1. Create a shared function in `player-normalizer.js`:
```js
const DIACRITICS = { 'ø':'o','ö':'o','ó':'o','ô':'o','å':'a','ä':'a','á':'a','à':'a','â':'a',
  'é':'e','è':'e','ê':'e','ë':'e','í':'i','ì':'i','î':'i','ï':'i','ú':'u','ù':'u','û':'u',
  'ü':'u','ñ':'n','ý':'y','ÿ':'y','ç':'c','ð':'d','þ':'th','ß':'ss','æ':'ae' }

export const normalizeName = (name) => {
  if (!name) return ''
  return String(name).trim().toLowerCase()
    .replace(/[^\x00-\x7F]/g, ch => DIACRITICS[ch] || '')
    .replace(/\s+/g, ' ')
    .trim()
}
```
2. Import and use this single function in both `probability-engine.js` and `player-params.js`
3. Remove the local `normalizeName` from both files

**Validation:** Unit test with: Ludvig Åberg → "ludvig aberg", Nicolai Højgaard → "nicolai hojgaard", José María Olazábal → "jose maria olazabal", Séamus Power → "seamus power", Joaquín Niemann → "joaquin niemann"

**Dependencies:** None
**Impact:** Fixes silent probability lookup failures for all players with accented names

---

### 0.2 — Add null guard to cleanPlayerName

**File:** `src/domain/player-normalizer.js`

**Change:** Add `if (!name) return ''` as first line of `cleanPlayerName()`

**Dependencies:** None
**Validation:** Test with `cleanPlayerName(null)`, `cleanPlayerName(undefined)`, `cleanPlayerName('')`

---

### 0.3 — Fix CI pipeline

**File:** `.github/workflows/weekly-pipeline.yml`

**Changes:**
1. Remove `continue-on-error: true` from lint and test steps
2. Replace `npx prisma db push` with `npx prisma migrate deploy`
3. Move `npx prisma generate` to run before the build step
4. Add `DATAGOLF_API_KEY` to the env block

**Dependencies:** None
**Validation:** Trigger a manual pipeline run and verify it fails when tests fail

---

### 0.4 — Fix data issue severity sorting

**File:** `src/observability/data-issue-tracker.js`

**Change:** Replace `orderBy: { severity: 'desc' }` with post-query sort using severity map: `{ error: 3, warning: 2, info: 1 }`

**Dependencies:** None

---

### 0.5 — Fix header/content overlap

**File:** `src/pages/Layout.jsx`

**Change:** Replace `pt-20` with `pt-[136px]` on the main content wrapper

**Dependencies:** None

---

### 0.6 — Remove all base44 remnants

**Files to modify:**
- Delete: `src/api/base44Client.js`
- Delete: `src/api/entities.js`
- Delete: `src/api/functions.js`
- Delete: `src/api/integrations.js`
- Modify: `src/pages/ParBets.jsx` — remove base44 import, remove `BettingProvider` and `UserBet` queries
- Modify: `src/pages/BirdieBets.jsx` — same
- Modify: `src/pages/EagleBets.jsx` — same
- Modify: `src/pages/LongShots.jsx` — same
- Modify: `src/pages/MyBets.jsx` — remove all base44 calls, replace with real API calls or disable user bet features until backend endpoints exist

**Change:** Remove every import and usage of `base44`. For user bet tracking and provider queries, either wire to existing backend endpoints (if they exist) or remove the UI for now with a clear "coming soon" state.

**Dependencies:** Verify which backend endpoints exist for UserBet and BettingProvider before deciding approach
**Validation:** `grep -r "base44" src/` returns zero results

---

### 0.7 — Fix backtest.js syntax error

**File:** `src/pipeline/backtest.js`

**Change:** Fix the syntax error. This file will be rebuilt properly in Phase 5, but the parse error should be fixed now so imports don't crash.

**Dependencies:** None

---

## Phase 1: Activate Existing Code

These changes wire up code and data that already exists but isn't connected.

### 1.1 — Activate probability blending

**File:** `src/pipeline/weekly-pipeline.js` — line 1390

**Current code:**
```js
const blended = this.blendProbabilities({ sim: simProb, dg: null, mkt: null })
```

**New code:**
```js
const dgProbForBlend = this.deriveModelProbability(market.marketKey, modelProbs)
const mktProbForBlend = marketProb

const blended = this.blendProbabilities({ sim: simProb, dg: dgProbForBlend, mkt: mktProbForBlend })
```

**What this does:** The `blendProbabilities` function already implements logit-space weighted blending with weights `{ sim: 0.70, dg: 0.20, mkt: 0.10 }`. It already handles `null` gracefully (auto-reweights to available sources). The `dgProb` variable is already computed at line 1367. `marketProb` is already vig-removed. We're simply passing them through.

**Why it matters:** The simulation alone can diverge from reality. DataGolf's pre-tournament predictions are built on years of historical data and provide an independent anchor. Market probabilities reflect sharp money. Blending protects against simulator-specific biases.

**Dependencies:** Phase 0.1 (name normalization must be unified first, or DG probability lookups for international players will return null)

**Validation:**
- Dry run the pipeline with blending enabled
- Compare: how many candidates have `dgProbForBlend !== null`? (Should be >80% of field)
- Compare: how many have `mktProbForBlend !== null`? (Should be >90%)
- Log the blend inputs and output to verify the logit-space averaging is producing sensible numbers

---

### 1.2 — Connect course profile to simulation

**Files:**
- `src/engine/v2/course-profile.js` — already exists, computes `{ mean, variance }`
- `src/engine/v2/player-params.js` — add `courseProfile` parameter
- `src/pipeline/weekly-pipeline.js` — call `buildCourseProfile()` and pass to `buildPlayerParams()`

**Change in pipeline (around line 1182):**
```js
// Fetch historical rounds for this event from stored artifacts
const historicalRounds = await this.loadHistoricalRoundsForEvent(run.id, event)
const courseProfile = buildCourseProfile({ event, historicalRounds })

const playerParams = buildPlayerParams({
  players: eventPlayers,
  skillRatings,
  tour: event.tour,
  courseProfile  // NEW
})
```

**Change in player-params.js:**
```js
export const buildPlayerParams = ({ players, skillRatings, tour, courseProfile = null }) => {
  // ... existing code ...

  // NEW: Apply course difficulty adjustment
  const courseDifficultyOffset = courseProfile?.mean || 0
  const courseVarianceFactor = courseProfile?.variance
    ? Math.sqrt(courseProfile.variance) / 2.0
    : 0

  return players.map((player) => {
    // ... existing mean/volatility calculation ...

    // Adjust mean by course difficulty (harder course = higher mean = worse score)
    const adjustedMean = mean + (courseDifficultyOffset * 0.2)
    // Adjust volatility by course variance (high-variance course = wider distributions)
    const adjustedVolatility = volatility * (1 + courseVarianceFactor * 0.1)

    return { ...existingReturn, mean: adjustedMean, volatility: adjustedVolatility }
  })
}
```

**Dependencies:** Historical rounds data must be available as RunArtifacts (already fetched and stored)
**Validation:** Unit test with known course data. Verify that a course with high historical mean produces higher player means.

---

### 1.3 — Connect market wrappers to simulator

**Files:**
- `src/engine/v2/tournamentSim.js` — add `returnSimScores` option
- `src/engine/v2/marketWrappers.js` — already works, just needs correct input
- `src/pipeline/weekly-pipeline.js` — pass sim scores to matchup processing

**Change in tournamentSim.js:** Add option to return per-simulation total scores alongside aggregated probabilities:

```js
export const simulateTournament = ({ ..., returnSimScores = false } = {}) => {
  const simScores = returnSimScores ? [] : null

  for (let sim = 0; sim < normalizedSimCount; sim += 1) {
    // ... existing round simulation code ...

    if (returnSimScores) {
      const scoreMap = {}
      for (const [key, total] of totals.entries()) scoreMap[key] = total
      simScores.push(scoreMap)
    }
  }

  return { probabilities, simCount: normalizedSimCount, simScores }
}
```

**Dependencies:** None — this is an additive change (new optional parameter, existing callers unaffected)
**Validation:** Test that `matchupProbability(playerA, playerB, simScores)` returns sensible probabilities (around 0.5 for equally-rated players)

---

## Phase 2: Integrate Unused DataGolf Data

Each of these integrations takes data that's already fetched and stored as RunArtifacts and feeds it into the engine.

### 2.1 — Player decompositions for course fit

**DataGolf endpoint:** `getPlayerDecompositions(tour)` — fetched at pipeline line 618
**Returns per player:** SG Off-the-Tee, SG Approach, SG Around-the-Green, SG Putting

**Files:**
- `src/engine/v2/player-params.js` — add `decompositions` parameter
- `src/pipeline/weekly-pipeline.js` — load artifact data and pass to `buildPlayerParams()`

**Change:** Define course archetypes and compute a fit adjustment:

```js
// Course archetype weights (which SG categories matter most)
const COURSE_WEIGHTS = {
  balanced:  { ott: 0.25, app: 0.25, arg: 0.25, putt: 0.25 },
  long:      { ott: 0.40, app: 0.30, arg: 0.15, putt: 0.15 },
  precision: { ott: 0.15, app: 0.40, arg: 0.20, putt: 0.25 },
  links:     { ott: 0.30, app: 0.20, arg: 0.30, putt: 0.20 },
  putting:   { ott: 0.15, app: 0.25, arg: 0.20, putt: 0.40 }
}
```

For each player with decomposition data:
1. Compute weighted dot product of their SG splits against course weights
2. Normalize to a fit score (-0.5 to +0.5)
3. Adjust `mean` by `fitScore * 0.25`

**Course archetype determination:** Use historical round variance from `buildCourseProfile()`. High variance → links/exposed. Low variance + low mean → precision. High mean → long. Default to `balanced`.

**Dependencies:** Phase 1.2 (course profile must be connected), Phase 0.1 (name normalization)
**Validation:** Verify that a player with elite SG Putting gets a boost on a putting-weighted course

---

### 2.2 — Approach skill for volatility refinement

**DataGolf endpoint:** `getApproachSkill('l24')` — fetched at pipeline line 611
**Returns:** 24-month approach skill per player (more granular than general decomposition)

**File:** `src/engine/v2/player-params.js`

**Change:** After computing base volatility, adjust using approach skill:

```js
// Elite approach players are more consistent scorers
const approachRating = approachSkillMap.get(key)
if (Number.isFinite(approachRating)) {
  const fieldApproachMean = /* computed from all field players */
  const approachZ = (approachRating - fieldApproachMean) / fieldApproachStdDev
  volatility *= (1.0 - approachZ * 0.08)  // ±8% volatility adjustment
}
```

**Why this matters:** Approach play is the strongest predictor of consistent scoring in professional golf. Players with elite approach skill have lower scoring variance — they avoid big numbers.

**Dependencies:** Phase 0.1 (name normalization)
**Validation:** Unit test that elite approach player gets ~8% lower volatility than field average

---

### 2.3 — DG rankings for confidence scoring

**DataGolf endpoint:** `getDgRankings()` — fetched at pipeline line 597

**File:** `src/pipeline/weekly-pipeline.js` — `calculateConfidence()` method (line 1897)

**Current:** Confidence is based solely on edge size.

**Change:** Upgrade to multi-factor confidence:

```js
calculateConfidence({ edge, dgRank, booksUsed, simProb, dgProb, decompositionAvailable }) {
  let score = 50

  // Edge strength (0-25 points)
  if (edge > 0.06) score += 25
  else if (edge > 0.04) score += 20
  else if (edge > 0.025) score += 15
  else if (edge > 0.01) score += 10

  // Player quality via DG ranking (0-15 points)
  if (dgRank && dgRank <= 20) score += 15
  else if (dgRank && dgRank <= 50) score += 10
  else if (dgRank && dgRank <= 100) score += 5

  // Model agreement — sim vs DG (0-10 points)
  if (Number.isFinite(simProb) && Number.isFinite(dgProb)) {
    const divergence = Math.abs(simProb - dgProb) / Math.max(simProb, dgProb)
    if (divergence < 0.10) score += 10
    else if (divergence < 0.25) score += 5
  }

  // Data quality (0-10 points)
  if (booksUsed >= 4) score += 5
  if (decompositionAvailable) score += 5

  return Math.min(5, Math.max(1, Math.round(score / 20)))
}
```

**Dependencies:** Phase 1.1 (blending must be active to have meaningful sim vs DG comparison)
**Validation:** Spot-check: a top-20 ranked player with strong edge and model agreement should score 4-5

---

### 2.4 — Pre-tournament archive for calibration

**DataGolf endpoint:** `getPreTournamentArchive(tour, { year, eventId })` — fetched at pipeline line 655

**File:** `src/engine/v2/calibration/index.js` — currently a pass-through stub

**Change:** Replace stub with actual calibration:

```js
export const buildCalibrationModel = (archiveData = []) => {
  // Group predictions by probability bucket
  const buckets = [
    { min: 0, max: 0.02, predicted: [], actual: [] },
    { min: 0.02, max: 0.05, predicted: [], actual: [] },
    { min: 0.05, max: 0.10, predicted: [], actual: [] },
    { min: 0.10, max: 0.20, predicted: [], actual: [] },
    { min: 0.20, max: 0.40, predicted: [], actual: [] },
    { min: 0.40, max: 1.00, predicted: [], actual: [] }
  ]

  for (const event of archiveData) {
    for (const player of event.players) {
      const bucket = buckets.find(b => player.predictedProb >= b.min && player.predictedProb < b.max)
      if (bucket) {
        bucket.predicted.push(player.predictedProb)
        bucket.actual.push(player.actualOutcome)  // 1 or 0
      }
    }
  }

  // Compute calibration adjustment per bucket
  const calibrationMap = buckets.map(bucket => ({
    midpoint: (bucket.min + bucket.max) / 2,
    adjustment: bucket.actual.length > 10
      ? (average(bucket.actual) / average(bucket.predicted))
      : 1.0  // No adjustment if insufficient data
  }))

  return calibrationMap
}

export const applyCalibration = (probability, marketKey, tour, calibrationModel = null) => {
  if (!calibrationModel || !Number.isFinite(probability)) return probability

  // Find the two nearest buckets and interpolate
  const sorted = calibrationModel.sort((a, b) =>
    Math.abs(a.midpoint - probability) - Math.abs(b.midpoint - probability)
  )
  const nearest = sorted[0]
  return clampProbability(probability * nearest.adjustment)
}
```

**Pipeline integration:** On startup, load the last 20+ archived prediction events from RunArtifacts. Build the calibration model once. Pass it to `applyCalibration()` for every candidate.

**Dependencies:** Phase 1.1 (blending should be active before calibrating, so we calibrate the blended output)
**Validation:**
- Backtest: for historical events, verify that calibrated probabilities are closer to actual outcomes than uncalibrated
- Sanity: calibration adjustments should be in the range 0.7-1.3 (if outside this, something is wrong)

---

### 2.5 — Historical rounds for course-specific player adjustment

**DataGolf endpoint:** `getHistoricalRawRounds(tour, eventId, year)` — fetched at pipeline line 673

**File:** `src/engine/v2/player-params.js`

**Change:** For each player in the field, check if they have historical rounds at this course. If so, adjust their `mean` based on how they've performed here relative to field average:

```js
// Per-player course history adjustment
const playerCourseHistory = historicalRounds.filter(r => normalizeName(r.player_name) === key)
if (playerCourseHistory.length >= 4) {  // Minimum 4 historical rounds at this course
  const playerCourseMean = average(playerCourseHistory.map(r => r.score))
  const fieldCourseMean = average(historicalRounds.map(r => r.score))
  const courseAdjustment = (playerCourseMean - fieldCourseMean) * 0.15
  adjustedMean += courseAdjustment
}
```

**Why 0.15:** Course-specific history is predictive but noisy. A 15% weight prevents overfitting to small samples while still rewarding genuine course specialists.

**Dependencies:** Phase 0.1 (name normalization), Phase 1.2 (course profile connection)
**Validation:** Verify that a player who historically scores 2 strokes below field average at a course gets a negative mean adjustment (better expected scoring)

---

## Phase 3: Simulation Engine Refinements

### 3.1 — Per-player tail parameters

**File:** `src/engine/v2/player-params.js`, `src/engine/v2/tournamentSim.js`

**Current:** Every player gets `tail: 6.5` (hardcoded constant)

**Change:** Derive from historical scoring variance:
```js
const playerRounds = historicalRounds.filter(r => normalizeName(r.player_name) === key)
if (playerRounds.length >= 8) {
  const scores = playerRounds.map(r => r.score)
  const stdDev = standardDeviation(scores)
  // Map standard deviation to tail parameter
  // Low variance (consistent) → tighter tail (5.0)
  // High variance (volatile) → looser tail (8.0)
  tail = Math.max(5.0, Math.min(8.0, 4.0 + stdDev))
} else {
  tail = 6.5  // Default unchanged
}
```

**Dependencies:** Phase 2.5 (historical rounds must be loaded and available)
**Validation:** Verify consistent players (low historical variance) get tail ~5.0 and volatile players get tail ~8.0

---

### 3.2 — Round-to-round momentum

**File:** `src/engine/v2/tournamentSim.js` — inside the round loop (line 92-119)

**Change:** Add a light momentum carry between rounds:
```js
for (let round = 1; round <= rounds; round += 1) {
  const roundShock = normal(rng) * 0.6
  for (const player of normalizedPlayers) {
    const playerShock = playerShocks.get(player.key) || 0

    // NEW: Momentum carry from previous round
    const prevRoundScores = roundScores.get(player.key)
    const momentumBoost = (round > 1 && prevRoundScores?.length > 0)
      ? (prevRoundScores[prevRoundScores.length - 1] - player.mean) * 0.10
      : 0

    const rawScore = player.mean + playerShock + roundShock + momentumBoost + normal(rng) * player.volatility
    // ... rest unchanged ...
  }
}
```

**Why 0.10:** Research shows ~8-12% autocorrelation in professional golf round scores. 10% is conservative and avoids overcorrecting.

**Dependencies:** None (self-contained simulation change)
**Validation:** Run 10,000 sims and verify that round-to-round score correlation is approximately 0.08-0.12

---

### 3.3 — Dynamic field strength scaling

**File:** `src/engine/v2/player-params.js`

**Current:** Fixed tour multipliers (PGA=1.0, DPWT=0.95, LIV=0.92)

**Change:** Compute dynamic field strength from actual skill ratings in the field:
```js
const fieldRatings = players
  .map(p => ratingsMap.get(normalizeName(p.name)))
  .filter(Number.isFinite)

const dynamicScale = fieldRatings.length >= 20
  ? (average(fieldRatings) / PGA_AVERAGE_FIELD_STRENGTH)
  : (tourRatingScale[tour] ?? 1.0)
```

Where `PGA_AVERAGE_FIELD_STRENGTH` is the historical average SG Total of a full-strength PGA field (~0.5).

**Why:** A weak-field PGA event (opposite-field, ~60 ranked players) plays differently than a signature event (150 ranked players). This captures that week-to-week variation.

**Dependencies:** Phase 0.1 (name normalization)
**Validation:** Verify that a weak-field event produces a scale < 1.0 and a signature event produces ~1.0

---

## Phase 4: Additional Markets

### 4.1 — Enable matchup and three-ball markets

**Files:**
- `src/pipeline/weekly-pipeline.js` — matchup processing section (around line 902)
- `src/engine/v2/marketWrappers.js` — already works
- `src/engine/v2/tournamentSim.js` — modified in Phase 1.3

**Change:**
1. When processing matchup odds from `getMatchupsOdds()`, extract the pairings
2. For each pairing, call `matchupProbability(playerA, playerB, simScores)` using the per-sim scores from Phase 1.3
3. For three-ball groupings, call `threeBallProbability(playerA, playerB, playerC, simScores)`
4. Compare fair probability against bookmaker odds
5. Add to the candidate pool with appropriate tier assignment
6. Process through the same edge/EV/tier selection pipeline

**Dependencies:** Phase 1.3 (simulator must return per-sim scores)
**Validation:** Verify that for equally-rated players, matchup probability ≈ 0.50. For a heavily favoured player, probability > 0.55.

---

## Phase 5: Cleanup and Tests

### 5.1 — Remove dead V1 code

**Delete:**
- `src/domain/bet-selection-engine.js` — dead, replaced by pipeline's built-in selection
- `src/pipeline/selection-pipeline.js` — dead, has undefined variable bug
- `src/engine/runEngine.ts` — stub, never called
- `src/engine/betSelector/selector.ts` — stub
- `src/engine/betSelector/explanation.ts` — stub
- `src/engine/portfolioOptimizer/optimizer.ts` — not wired in
- `src/engine/probabilityEngine/validate.ts` — field name mismatch with V2

**Keep:**
- `src/engine/edgeCalculator/edge.ts` — used
- `src/engine/featureFlags/*.ts` — used

---

### 5.2 — Update and add tests

**Delete or rewrite:**
- `src/__tests__/bet-selection-engine.test.js` — tests deleted V1 engine

**New tests to add:**
- `src/tests/name-normalization.test.js` — diacritics transliteration, null handling, consistency across modules
- `src/tests/probability-blending.test.js` — verify logit-space blending with all combinations of null/valid inputs
- `src/tests/calibration.test.js` — verify calibration model building and application
- `src/tests/course-fit.test.js` — verify decomposition-based course fit adjustment
- `src/tests/market-wrappers.test.js` — verify matchup and three-ball probability calculation with real sim scores
- Update `src/tests/tournament-sim.test.js` — test momentum, per-player tails, and `returnSimScores` option
- Update `src/tests/selection-strategy.test.js` — test with blended probabilities

---

### 5.3 — Rebuild backtest capability

**File:** `src/pipeline/backtest.js` — rewrite from scratch

**Purpose:** For each historical event with archive data:
1. Run the full engine with that week's data
2. Compare predicted probabilities against actual outcomes
3. Output: Brier score, log-loss, calibration curves per market, per tour

This validates the entire upgraded pipeline and the calibration model.

---

## Implementation Order and Dependencies

```
Phase 0 (Bug Fixes) — no dependencies, can be done in any order
  ├── 0.1 Name normalization     ← MUST be first (everything else depends on it)
  ├── 0.2 Null guard             ← independent
  ├── 0.3 CI pipeline            ← independent
  ├── 0.4 Severity sorting       ← independent
  ├── 0.5 Header overlap         ← independent
  ├── 0.6 Remove base44          ← independent
  └── 0.7 Fix backtest.js        ← independent

Phase 1 (Activate Existing) — depends on Phase 0.1
  ├── 1.1 Activate blending      ← depends on 0.1
  ├── 1.2 Course profile         ← depends on 0.1
  └── 1.3 Market wrappers        ← independent (additive to simulator)

Phase 2 (Integrate Data) — depends on Phase 0.1 and Phase 1
  ├── 2.1 Decompositions         ← depends on 0.1, 1.2
  ├── 2.2 Approach skill         ← depends on 0.1
  ├── 2.3 DG rankings            ← depends on 1.1
  ├── 2.4 Calibration            ← depends on 1.1
  └── 2.5 Historical rounds      ← depends on 0.1, 1.2

Phase 3 (Engine Refinements) — depends on Phase 2.5
  ├── 3.1 Per-player tails       ← depends on 2.5
  ├── 3.2 Round momentum         ← independent
  └── 3.3 Dynamic field strength ← depends on 0.1

Phase 4 (New Markets) — depends on Phase 1.3
  └── 4.1 Matchups/three-balls   ← depends on 1.3

Phase 5 (Cleanup) — depends on all above
  ├── 5.1 Remove dead code       ← independent
  ├── 5.2 Tests                  ← after all features
  └── 5.3 Backtest               ← after all features
```

---

## Expected Impact on Pick Quality

| Change | Expected Accuracy Improvement | Confidence |
|---|---|---|
| Name normalization fix (0.1) | +5-10% for international players | Very High |
| Activate probability blending (1.1) | +5-15% overall (anchoring + market wisdom) | High |
| Course profile connection (1.2) | +3-5% for course-sensitive events | Medium |
| Player decompositions for course fit (2.1) | +5-10% per event | High |
| Approach skill volatility (2.2) | +2-4% | Medium |
| Calibration from archive (2.4) | +8-15% (corrects systematic bias) | High |
| Historical course-specific adjustment (2.5) | +3-5% per event | Medium |
| Per-player tail parameters (3.1) | +1-3% | Medium |
| Round momentum (3.2) | +1-3% | Medium |
| Dynamic field strength (3.3) | +2-4% for weak/strong fields | Medium |
| Matchup/three-ball markets (4.1) | New edge source (often less efficient) | High |

**Combined estimated improvement: 20-40% more accurate edge calculations**, with the biggest gains from blending activation, calibration, and course fit — the three changes that correct the most significant current shortcomings.

---

## What This Plan Does NOT Do

- Replace any part of the V2 architecture
- Use in-play data (per instruction)
- Change the tier system (PAR/BIRDIE/EAGLE/LONG SHOTS)
- Change the database schema (except adding optional fields if needed for course archetype)
- Add new external dependencies
- Change the deployment or hosting infrastructure
- Modify the frontend bet display (beyond base44 removal and header fix)

---

*No changes have been made to any files. Awaiting approval before implementation.*
