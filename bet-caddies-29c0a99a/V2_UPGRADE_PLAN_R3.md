# V2 Engine Upgrade Plan (Revision 3 — Final)

**Branch:** `betc-optimal-engine`
**Date:** 2026-02-10
**Scope:** Upgrade the existing V2 pipeline to use all available DataGolf data and fix all audit-identified issues
**Constraint:** Upgrade only — no replacement, no new architecture
**Source:** DataGolf API documentation at https://datagolf.com/api-access verified 2026-02-10

---

## Critical Findings

### Finding 1: Probability blending is disabled
```js
// weekly-pipeline.js, line 1390
const blended = this.blendProbabilities({ sim: simProb, dg: null, mkt: null })
```
The blending formula exists and works. The variables `dgProb` (line 1367) and `normalizedImplied` (line 1239) are computed in the same scope. They're just not passed through. The system runs on 100% Monte Carlo simulation with zero external correction.

### Finding 2: Calibration is a stub
```js
// calibration/index.js — entire file
export const applyCalibration = (probability, marketKey, tour) => {
  return probability
}
```

### Finding 3: Historical odds endpoints are NOT forbidden
The codebase contains comments stating `"STRICTLY FORBIDDEN per DataGolf API Agreement"` on three historical odds methods (`getHistoricalOddsEventList`, `getHistoricalOutrights`, `getHistoricalMatchups`). **The DataGolf API documentation lists these as standard endpoints with no usage restrictions.** These endpoints return actual bet outcomes (`bet_outcome_numeric`, `close_odds`, `open_odds`) — exactly what's needed for calibration and backtesting.

### Finding 4: The client is missing 7 endpoints
The DataGolf API offers endpoints that aren't in our client at all:
- `historical-event-data/event-list`
- `historical-event-data/events`
- `historical-dfs-data/event-list`
- `historical-dfs-data/points`
- `preds/fantasy-projection-defaults`
- `betting-tools/matchups-all-pairings` (includes DataGolf's own fair odds)
- `historical-raw-data/holes` (exists in client but unused)

### Finding 5: Book allowlist is too restrictive for probability calculation
Currently only 5 UK books are allowed (bet365, betfair, williamhill, skybet, unibet). The API supports 16 books. More books = better vig removal = more accurate market-implied probabilities. The UK filter makes sense for user-facing sportsbook links, but internal probability calculation should use all available books.

### Finding 6: Pre-tournament predictions have unparse fields
The API returns `top_17`, `top_23`, `sample_size`, and `first_round_leader` — none of which we currently parse.

---

## Complete DataGolf Endpoint Map

### Currently fetched and used
| Endpoint | Used For |
|---|---|
| `getSchedule()` | Event matching |
| `getFieldUpdates()` | Player list |
| `getSkillRatings('value')` | Simulation parameters (mean, volatility) |
| `getOutrightsOdds()` | Sportsbook odds for edge calculation |

### Currently fetched, stored as artifact, but NOT used in engine
| Endpoint | Available Data | This Plan |
|---|---|---|
| `getPreTournamentPreds()` | Win, top5/10/17/20/23, make_cut, FRL probabilities, `sample_size` | **Phase 1.1**: Activate blending (20% weight) |
| `getPlayerList()` | Master player DB with `dg_id`, `country`, `amateur` status | **Phase 2.1**: Cross-reference for name resolution |
| `getDgRankings()` | DG rank, `dg_skill_estimate`, OWGR rank per player | **Phase 2.3**: Confidence scoring |
| `getApproachSkill('l24')` | SG per shot, proximity, GIR, good/poor shot rates by yardage/lie | **Phase 2.2**: Volatility refinement |
| `getPlayerDecompositions()` | SG OTT, SG Approach, SG ARG, SG Putting per player | **Phase 2.1**: Course fit adjustment |
| `getPreTournamentArchive()` | Historical predictions + actual finish (`fin_text`) | **Phase 2.4**: Calibration model |
| `getHistoricalRawEventList()` | Event IDs for historical data | **Phase 2.5**: Course history lookup |
| `getHistoricalRawRounds()` | Round-level scores, stats, strokes-gained (1983+) | **Phase 1.2 + 2.5**: Course profile + player course history |
| `getMatchupsOdds()` | Head-to-head and three-ball sportsbook odds | **Phase 4.1**: Enable matchup markets |

### Currently BLOCKED (wrongly marked as forbidden)
| Endpoint | Available Data | This Plan |
|---|---|---|
| `getHistoricalOddsEventList()` | Event list with flags for available odds/matchups/archived preds | **Phase 2.4**: Identify calibration data sources |
| `getHistoricalOutrights()` | Open/close odds + `bet_outcome_numeric` (1=win, 0=loss) per book | **Phase 2.4 + 5.3**: Calibration + backtesting with actual outcomes |
| `getHistoricalMatchups()` | Open/close matchup odds + outcomes per pairing | **Phase 4.1 + 5.3**: Matchup calibration + backtesting |

### NOT in client — need to add
| Endpoint | Available Data | This Plan |
|---|---|---|
| `historical-event-data/events` | Event finishes, earnings, FedExCup/DG Points (2025-2026) | **Phase 2.5**: Recent form metric |
| `betting-tools/matchups-all-pairings` | DataGolf's own fair matchup odds + sportsbook odds for ALL pairings | **Phase 4.1**: Independent matchup probability source |
| `preds/fantasy-projection-defaults` | DFS projections with ownership% and ceiling/floor | **Phase 3.3**: Ownership as popularity/field-strength proxy |
| `historical-dfs-data/points` | Historical DFS salaries and scoring (2017-2025) | Not used — low priority |

### Excluded per user instruction
| Endpoint | Reason |
|---|---|
| `getInPlayPreds()` | In-play data excluded |
| `getLiveTournamentStats()` | In-play data excluded |
| `getLiveHoleStats()` | In-play data excluded |
| `preds/live-strokes-gained` | Deprecated by DataGolf |

---

## Phase 0: Bug Fixes

Every subsequent phase depends on these being correct first. Each is a standalone commit.

### 0.1 — Unify player name normalization

**Files to modify:**
- `src/engine/v2/player-params.js` — lines 5-9
- `src/engine/v2/probability-engine.js` — line 3
- `src/domain/player-normalizer.js`

**Problem:** Two different `normalizeName` functions produce different keys for the same player. `probability-engine.js` uses `trim().toLowerCase()`. `player-params.js` uses `replace(/[^\w\s-]/g, '')` which strips diacritics entirely.

**Change:**
1. Add to `player-normalizer.js`:
```js
const DIACRITICS = {
  'ø':'o','ö':'o','ó':'o','ô':'o','õ':'o',
  'å':'a','ä':'a','á':'a','à':'a','â':'a','ã':'a',
  'é':'e','è':'e','ê':'e','ë':'e',
  'í':'i','ì':'i','î':'i','ï':'i',
  'ú':'u','ù':'u','û':'u','ü':'u',
  'ñ':'n','ý':'y','ÿ':'y','ç':'c','ð':'d',
  'þ':'th','ß':'ss','æ':'ae','œ':'oe'
}

export const normalizeName = (name) => {
  if (!name) return ''
  return String(name).trim().toLowerCase()
    .replace(/[^\x00-\x7F]/g, ch => DIACRITICS[ch] || '')
    .replace(/\s+/g, ' ')
    .trim()
}
```
2. Import and use in both `probability-engine.js` and `player-params.js`, replacing their local versions

**Validation:** Unit test: Ludvig Åberg → "ludvig aberg", Nicolai Højgaard → "nicolai hojgaard", José María Olazábal → "jose maria olazabal", Séamus Power → "seamus power"

**Dependencies:** None — must be done first

---

### 0.2 — Add null guard to cleanPlayerName

**File:** `src/domain/player-normalizer.js`

**Change:** Add `if (!name) return ''` as first line of `cleanPlayerName()`

**Dependencies:** None

---

### 0.3 — Fix CI pipeline

**File:** `.github/workflows/weekly-pipeline.yml`

**Changes:**
1. Remove `continue-on-error: true` from lint and test steps
2. Replace `npx prisma db push` with `npx prisma migrate deploy`
3. Move `npx prisma generate` before the build step
4. Add `DATAGOLF_API_KEY` to env block

**Dependencies:** None

---

### 0.4 — Fix data issue severity sorting

**File:** `src/observability/data-issue-tracker.js`

**Change:** Replace `orderBy: { severity: 'desc' }` with post-query sort: `{ error: 3, warning: 2, info: 1 }`

**Dependencies:** None

---

### 0.5 — Fix header/content overlap

**File:** `src/pages/Layout.jsx`

**Change:** Replace `pt-20` with `pt-[136px]` on main content wrapper

**Dependencies:** None

---

### 0.6 — Remove all base44 remnants

**Files:**
- Delete: `src/api/base44Client.js`, `src/api/entities.js`, `src/api/functions.js`, `src/api/integrations.js`
- Modify: `src/pages/ParBets.jsx`, `BirdieBets.jsx`, `EagleBets.jsx`, `LongShots.jsx` — remove base44 imports and queries
- Modify: `src/pages/MyBets.jsx` — replace all base44 calls with real API or disable with "coming soon" state

**Validation:** `grep -r "base44" src/` returns zero results

**Dependencies:** Verify which backend endpoints exist for UserBet and BettingProvider first

---

### 0.7 — Un-block historical odds endpoints

**File:** `src/sources/datagolf/client.js` — lines 163-211

**Problem:** Three methods throw `FORBIDDEN` errors with comments claiming these endpoints are banned. DataGolf API documentation lists them as standard endpoints with no restrictions.

**Change:** Replace the three throwing methods with real implementations:
```js
async getHistoricalOddsEventList(tour) {
  return request('/historical-odds/event-list', { tour }, { endpointName: 'historical-odds/event-list' })
},
async getHistoricalOutrights(tour, eventId, year, market, book) {
  return request('/historical-odds/outrights', {
    tour, event_id: eventId, year, market, book, odds_format: 'decimal'
  }, { endpointName: 'historical-odds/outrights' })
},
async getHistoricalMatchups(tour, eventId, year, book) {
  return request('/historical-odds/matchups', {
    tour, event_id: eventId, year, book, odds_format: 'decimal'
  }, { endpointName: 'historical-odds/matchups' })
}
```

**Dependencies:** None
**Validation:** Call `getHistoricalOddsEventList('pga')` and verify it returns data without error

---

### 0.8 — Add missing endpoints to client

**File:** `src/sources/datagolf/client.js`

**Add 3 new methods:**
```js
async getHistoricalEventList(tour) {
  return request('/historical-event-data/event-list', { tour }, { endpointName: 'historical-event-data/event-list' })
},
async getHistoricalEvents(tour, eventId, year) {
  return request('/historical-event-data/events', {
    tour, event_id: eventId, year
  }, { endpointName: 'historical-event-data/events' })
},
async getMatchupsAllPairings(tour) {
  // Already exists at line 138 but add if missing
  if (!assertSupported('betting-tools/matchups', tour)) return null
  return request('/betting-tools/matchups-all-pairings', {
    tour, odds_format: 'decimal'
  }, { endpointName: 'betting-tools/matchups-all-pairings' })
}
```

**Dependencies:** None
**Note:** `getMatchupsAllPairings` already exists in the client (line 138-143). Verify it works. The other two are new.

---

## Phase 1: Activate Existing Code

### 1.1 — Activate probability blending

**File:** `src/pipeline/weekly-pipeline.js` — line 1390

**Current:**
```js
const blended = this.blendProbabilities({ sim: simProb, dg: null, mkt: null })
```

**New:**
```js
const dgProbForBlend = dgProb  // Already computed at line 1367
const mktProbForBlend = normalizedImplied.get(selectionKey) || null

const blended = this.blendProbabilities({ sim: simProb, dg: dgProbForBlend, mkt: mktProbForBlend })
```

**What this does:** Activates the logit-space weighted blending: 70% simulation + 20% DataGolf + 10% market. The function already handles null gracefully (auto-reweights to available sources). Both `dgProb` and `normalizedImplied` are already computed in the same function scope.

**Note on `marketProb` vs `normalizedImplied`:** The `marketProb` variable (line 1283) is the vig-removed consensus probability used for edge calculation. For blending, we use `normalizedImplied` (raw market-implied, normalized to sum to 1) as the market signal. This keeps the two uses conceptually separate: `normalizedImplied` informs the model's fair probability estimate, `marketProb` is the benchmark the edge is measured against.

**Dependencies:** Phase 0.1 (name normalization must be unified, or DG lookups fail for international players)

**Validation:**
- Dry run: log blend inputs and outputs for 20 candidates
- Verify >80% of candidates have non-null `dgProbForBlend`
- Verify >90% have non-null `mktProbForBlend`
- Blended probability should be between sim and market for most candidates

---

### 1.2 — Connect course profile to simulation

**Files:**
- `src/engine/v2/course-profile.js` — enhance to accept historical rounds
- `src/engine/v2/player-params.js` — add `courseProfile` parameter
- `src/pipeline/weekly-pipeline.js` — call `buildCourseProfile()` and pass result

**Change in pipeline (around line 1182):**
```js
const historicalRounds = await this.loadHistoricalRoundsForEvent(run.id, event)
const courseProfile = buildCourseProfile({ event, historicalRounds })

const playerParams = buildPlayerParams({
  players: eventPlayers,
  skillRatings,
  tour: event.tour,
  courseProfile
})
```

**Change in player-params.js:**
```js
export const buildPlayerParams = ({ players, skillRatings, tour, courseProfile = null }) => {
  const courseDifficultyOffset = courseProfile?.mean || 0
  const courseVarianceFactor = courseProfile?.variance
    ? Math.sqrt(courseProfile.variance) / 2.0 : 0

  return players.map((player) => {
    // ... existing mean/volatility calculation ...
    const adjustedMean = mean + (courseDifficultyOffset * 0.2)
    const adjustedVolatility = volatility * (1 + courseVarianceFactor * 0.1)
    return { ...existing, mean: adjustedMean, volatility: adjustedVolatility }
  })
}
```

**Dependencies:** Historical rounds already fetched and stored as artifacts
**Validation:** Course with historically high scoring average → higher player means

---

### 1.3 — Enable per-simulation score export from simulator

**File:** `src/engine/v2/tournamentSim.js`

**Change:** Add `returnSimScores` option:
```js
export const simulateTournament = ({ ..., returnSimScores = false } = {}) => {
  const simScores = returnSimScores ? [] : null

  for (let sim = 0; sim < normalizedSimCount; sim += 1) {
    // ... existing code ...
    if (returnSimScores) {
      const scoreMap = {}
      for (const [key, total] of totals.entries()) scoreMap[key] = total
      simScores.push(scoreMap)
    }
  }

  return { probabilities, simCount: normalizedSimCount, simScores }
}
```

**Why:** `marketWrappers.js` (matchup/three-ball probability) needs per-simulation scores. This is an additive change — existing callers are unaffected since `returnSimScores` defaults to `false`.

**Dependencies:** None
**Validation:** With `returnSimScores: true`, verify `simScores.length === simCount` and each entry has a score for every player

---

### 1.4 — Expand book allowlist for internal probability calculation

**Files:**
- `src/sources/odds/allowed-books.js` — add `INTERNAL_ALLOWED_BOOKS`
- `src/pipeline/weekly-pipeline.js` — use expanded list for `computeMarketProbabilities`

**Current:** Only 5 UK books: bet365, betfair, williamhill, skybet, unibet

**Change:** Create two tiers:
```js
// For user-facing sportsbook links (UK-focused)
export const USER_FACING_BOOKS = Object.freeze([
  'bet365', 'betfair', 'williamhill', 'skybet', 'unibet'
])

// For internal probability calculation (all available books = better vig removal)
export const INTERNAL_BOOKS = Object.freeze([
  'bet365', 'betfair', 'williamhill', 'skybet', 'unibet',
  'betmgm', 'caesars', 'draftkings', 'fanduel', 'pinnacle',
  'bovada', 'betonline', 'circa', 'betway', 'betcris'
])
```

In the pipeline, use `INTERNAL_BOOKS` for `computeMarketProbabilities()` (vig removal and consensus probability). Use `USER_FACING_BOOKS` for `bestOffer` selection (the odds shown to users).

**Why:** More books means more data points for vig removal. Pinnacle in particular is the sharpest book in golf — its odds are the closest to true probability. Including it in the vig removal improves market probability accuracy significantly.

**Dependencies:** None
**Validation:** Compare market probabilities computed with 5 books vs 15 books. The 15-book version should have tighter confidence intervals.

---

## Phase 2: Integrate Unused DataGolf Data

### 2.1 — Player decompositions for course fit

**DataGolf endpoint:** `getPlayerDecompositions(tour)` — already fetched at pipeline line 618

**Returns per player:** SG Off-the-Tee, SG Approach, SG Around-the-Green, SG Putting

**Files:**
- `src/engine/v2/player-params.js` — add `decompositions` parameter
- `src/pipeline/weekly-pipeline.js` — load artifact, pass to `buildPlayerParams()`

**Change:** Define course archetypes and compute fit adjustment:
```js
const COURSE_WEIGHTS = {
  balanced:  { ott: 0.25, app: 0.25, arg: 0.25, putt: 0.25 },
  long:      { ott: 0.40, app: 0.30, arg: 0.15, putt: 0.15 },
  precision: { ott: 0.15, app: 0.40, arg: 0.20, putt: 0.25 },
  links:     { ott: 0.30, app: 0.20, arg: 0.30, putt: 0.20 },
  putting:   { ott: 0.15, app: 0.25, arg: 0.20, putt: 0.40 }
}
```

For each player with decomposition data:
1. Compute weighted dot product of SG splits against course weights
2. Normalize to a fit score (-0.5 to +0.5)
3. Adjust `mean` by `fitScore * 0.25`

**Course archetype determination:** Derive from historical round data (course profile variance, scoring pattern). High variance → links/exposed. Low variance + low mean → precision. High mean → long. Default: `balanced`.

**Dependencies:** Phase 0.1 (name normalization), Phase 1.2 (course profile)
**Validation:** Player with elite SG Putting gets boost on putting-weighted course

---

### 2.2 — Approach skill for volatility refinement

**DataGolf endpoint:** `getApproachSkill('l24')` — already fetched at pipeline line 611

**Returns:** 24-month approach performance: SG per shot, proximity, GIR, good/poor shot rates by yardage/lie buckets

**File:** `src/engine/v2/player-params.js`

**Change:**
```js
const approachRating = approachSkillMap.get(key)
if (Number.isFinite(approachRating)) {
  const approachZ = (approachRating - fieldApproachMean) / (fieldApproachStdDev || 1)
  volatility *= (1.0 - approachZ * 0.08)  // ±8% volatility adjustment
}
```

**Why:** Approach play is the strongest predictor of scoring consistency. Elite approach players avoid big numbers.

**Dependencies:** Phase 0.1
**Validation:** Elite approach player gets ~8% lower volatility

---

### 2.3 — DG rankings for confidence scoring

**DataGolf endpoint:** `getDgRankings()` — already fetched at pipeline line 597

**Returns per player:** `datagolf_rank`, `dg_skill_estimate`, `owgr_rank`

**File:** `src/pipeline/weekly-pipeline.js` — `calculateConfidence()` method (line 1897)

**Change:** Upgrade from edge-only to multi-factor:
```js
calculateConfidence({ edge, dgRank, booksUsed, simProb, dgProb, hasDecomposition }) {
  let score = 50
  // Edge strength (0-25 pts)
  if (edge > 0.06) score += 25
  else if (edge > 0.04) score += 20
  else if (edge > 0.025) score += 15
  else if (edge > 0.01) score += 10
  // Player ranking (0-15 pts)
  if (dgRank && dgRank <= 20) score += 15
  else if (dgRank && dgRank <= 50) score += 10
  else if (dgRank && dgRank <= 100) score += 5
  // Model agreement (0-10 pts)
  if (Number.isFinite(simProb) && Number.isFinite(dgProb)) {
    const divergence = Math.abs(simProb - dgProb) / Math.max(simProb, dgProb)
    if (divergence < 0.10) score += 10
    else if (divergence < 0.25) score += 5
  }
  // Data quality (0-10 pts)
  if (booksUsed >= 4) score += 5
  if (hasDecomposition) score += 5
  return Math.min(5, Math.max(1, Math.round(score / 20)))
}
```

**Dependencies:** Phase 1.1 (blending active for meaningful sim vs DG comparison)
**Validation:** Top-20 player with strong edge and model agreement → confidence 4-5

---

### 2.4 — Historical data for calibration model

**DataGolf endpoints:**
- `getHistoricalOddsEventList(tour)` — un-blocked in Phase 0.7
- `getHistoricalOutrights(tour, eventId, year, market, book)` — un-blocked in Phase 0.7
- `getPreTournamentArchive(tour, { year, eventId })` — already fetched

**What we now have access to:**
- Pre-tournament predicted probabilities (archive) + actual finish positions (`fin_text`)
- Historical sportsbook odds + actual bet outcomes (`bet_outcome_numeric`: 1=win, 0=loss)

**File:** `src/engine/v2/calibration/index.js` — replace stub

**Change:**
```js
export const buildCalibrationModel = (historicalData = []) => {
  // historicalData: array of { predictedProb, actualOutcome (1 or 0), market, tour }

  const buckets = [
    { min: 0.00, max: 0.02, predictions: [], outcomes: [] },
    { min: 0.02, max: 0.05, predictions: [], outcomes: [] },
    { min: 0.05, max: 0.10, predictions: [], outcomes: [] },
    { min: 0.10, max: 0.20, predictions: [], outcomes: [] },
    { min: 0.20, max: 0.40, predictions: [], outcomes: [] },
    { min: 0.40, max: 1.00, predictions: [], outcomes: [] }
  ]

  for (const entry of historicalData) {
    const bucket = buckets.find(b => entry.predictedProb >= b.min && entry.predictedProb < b.max)
    if (bucket) {
      bucket.predictions.push(entry.predictedProb)
      bucket.outcomes.push(entry.actualOutcome)
    }
  }

  return buckets.map(bucket => ({
    midpoint: (bucket.min + bucket.max) / 2,
    sampleSize: bucket.outcomes.length,
    adjustment: bucket.outcomes.length >= 30
      ? (average(bucket.outcomes) / average(bucket.predictions))
      : 1.0  // No adjustment with insufficient data
  }))
}

export const applyCalibration = (probability, marketKey, tour, calibrationModel = null) => {
  if (!calibrationModel || !Number.isFinite(probability)) return probability
  // Interpolate between nearest buckets
  const sorted = [...calibrationModel]
    .filter(b => b.sampleSize >= 30)
    .sort((a, b) => Math.abs(a.midpoint - probability) - Math.abs(b.midpoint - probability))
  if (sorted.length === 0) return probability
  return clampProbability(probability * sorted[0].adjustment)
}
```

**Pipeline integration:**
1. On pipeline startup (once per run), fetch historical outrights for the last 2-3 years via `getHistoricalOutrights()` with outcome data
2. Cross-reference with pre-tournament archive predictions
3. Build calibration model per market (win, top_5, top_10, top_20, make_cut)
4. Pass to `applyCalibration()` for every candidate
5. Store the calibration model as a RunArtifact for auditability

**Dependencies:** Phase 0.7 (un-block historical odds), Phase 1.1 (calibrate blended output, not raw sim)
**Validation:**
- Calibration adjustments should be in range 0.7-1.3 (flag if outside)
- After calibration, re-run historical data: Brier score should improve vs uncalibrated
- Sanity: for "win" market, if model predicts 5% and historical hit rate for that bucket is 3.5%, adjustment = 0.70

---

### 2.5 — Historical rounds for course-specific player adjustment

**DataGolf endpoint:** `getHistoricalRawRounds(tour, eventId, year)` — already fetched at pipeline line 673

**File:** `src/engine/v2/player-params.js`

**Change:**
```js
const playerCourseHistory = historicalRounds.filter(r => normalizeName(r.player_name) === key)
if (playerCourseHistory.length >= 4) {  // Minimum 4 rounds at this course
  const playerCourseMean = average(playerCourseHistory.map(r => r.score))
  const fieldCourseMean = average(historicalRounds.map(r => r.score))
  const courseAdjustment = (playerCourseMean - fieldCourseMean) * 0.15
  adjustedMean += courseAdjustment
}
```

**Why 0.15:** Course-specific history is predictive but noisy. 15% weight prevents overfitting while rewarding genuine course specialists.

**Dependencies:** Phase 0.1 (name normalization), Phase 1.2 (course profile)
**Validation:** Player who historically scores 2 strokes below field average at a course → negative mean adjustment

---

### 2.6 — Parse additional pre-tournament prediction fields

**Files:**
- `src/engine/v2/probability-engine.js` — extend `buildMapFromPreds()`
- `src/pipeline/weekly-pipeline.js` — use `sample_size` for confidence

**Change:** Parse the additional fields the API returns but we currently ignore:
```js
const entry = {
  win: normalizeImpliedOddsToProbability(impliedWinOdds),
  top5: normalizeImpliedOddsToProbability(impliedTop5Odds),
  top10: normalizeImpliedOddsToProbability(impliedTop10Odds),
  top17: normalizeImpliedOddsToProbability(Number(row.top_17)),        // NEW
  top20: normalizeImpliedOddsToProbability(impliedTop20Odds),
  top23: normalizeImpliedOddsToProbability(Number(row.top_23)),        // NEW
  makeCut: normalizeImpliedOddsToProbability(impliedMakeCutOdds),
  frl: normalizeImpliedOddsToProbability(Number(row.first_round_leader)), // NEW
  sampleSize: Number(row.sample_size) || null                          // NEW
}
```

**Why:** `top_17` and `top_23` provide finer-grained probability brackets for tier assignment. `sample_size` indicates DataGolf's confidence in their prediction — low sample size means less reliable DG probability, which should reduce its blending weight. `frl` gives us DG's FRL probability for blending.

**Dependencies:** None
**Validation:** Verify new fields are non-null for >80% of players in a typical event

---

### 2.7 — Use player list for cross-reference name resolution

**DataGolf endpoint:** `getPlayerList()` — already fetched at pipeline line 583

**Returns:** Master database with `dg_id`, `player_name`, `country`, `amateur`

**File:** `src/pipeline/weekly-pipeline.js` — enhance `groupOffersBySelection()`

**Change:** Build a lookup from the player list to map `dg_id` ↔ canonical name. When matching odds selections to simulation players, try dg_id match first (exact), then name match (fuzzy). This supplements the existing `playerByDgId` map.

**Dependencies:** Phase 0.1
**Validation:** Count of unmatched selections should decrease vs current

---

## Phase 3: Simulation Engine Refinements

### 3.1 — Per-player tail parameters from historical data

**File:** `src/engine/v2/player-params.js`

**Current:** `tail: 6.5` for everyone

**Change:**
```js
const playerRounds = historicalRounds.filter(r => normalizeName(r.player_name) === key)
if (playerRounds.length >= 8) {
  const scores = playerRounds.map(r => r.score)
  const stdDev = standardDeviation(scores)
  tail = Math.max(5.0, Math.min(8.0, 4.0 + stdDev))
} else {
  tail = 6.5
}
```

**Dependencies:** Phase 2.5 (historical rounds loaded)
**Validation:** Consistent players → tail ~5.0, volatile players → tail ~8.0

---

### 3.2 — Round-to-round momentum

**File:** `src/engine/v2/tournamentSim.js` — inside round loop (line 92)

**Change:**
```js
const prevRoundScores = roundScores.get(player.key)
const momentumBoost = (round > 1 && prevRoundScores?.length > 0)
  ? (prevRoundScores[prevRoundScores.length - 1] - player.mean) * 0.10
  : 0

const rawScore = player.mean + playerShock + roundShock + momentumBoost + normal(rng) * player.volatility
```

**Why 0.10:** Research shows ~8-12% autocorrelation in professional golf round scores. 10% is conservative.

**Dependencies:** None
**Validation:** Run 10,000 sims, compute round-to-round correlation, verify ~0.08-0.12

---

### 3.3 — Dynamic field strength scaling

**File:** `src/engine/v2/player-params.js`

**Current:** Fixed multipliers (PGA=1.0, DPWT=0.95, LIV=0.92)

**Change:**
```js
const fieldRatings = players
  .map(p => ratingsMap.get(normalizeName(p.name)))
  .filter(Number.isFinite)

const PGA_AVERAGE_FIELD = 0.5  // Historical avg SG Total for full-strength PGA field
const dynamicScale = fieldRatings.length >= 20
  ? (average(fieldRatings) / PGA_AVERAGE_FIELD)
  : (tourRatingScale[tour] ?? 1.0)
```

**Dependencies:** Phase 0.1
**Validation:** Weak-field opposite event → scale < 1.0; signature event → scale ~1.0

---

## Phase 4: Additional Markets

### 4.1 — Enable matchup and three-ball markets

**Files:**
- `src/engine/v2/marketWrappers.js` — already works
- `src/pipeline/weekly-pipeline.js` — matchup processing (around line 902)

**Change:**
1. Call `simulateTournament()` with `returnSimScores: true` (Phase 1.3)
2. Fetch `getMatchupsOdds()` (already happening) and `getMatchupsAllPairings()` (new, gives DataGolf's own fair odds)
3. For each pairing offered by bookmakers:
   - Call `matchupProbability(playerA, playerB, simScores)` for head-to-head
   - Call `threeBallProbability(playerA, playerB, playerC, simScores)` for three-balls
   - Use DataGolf's own matchup fair price from `matchups-all-pairings` as a blending input
   - Compare blended fair probability against sportsbook odds
   - Add to candidate pool with tier assignment and edge/EV calculation
4. Process through same selection pipeline

**Why this matters:** Matchup markets are often less efficiently priced by bookmakers. The simulator's shared round shocks naturally capture player correlation. DataGolf's `matchups-all-pairings` gives us their independent fair odds for free — an extra validation layer.

**Dependencies:** Phase 1.3 (sim scores), Phase 0.8 (matchups-all-pairings client method)
**Validation:** Equally-rated players → matchup prob ≈ 0.50. Heavily favoured → >0.55.

---

## Phase 5: Cleanup and Validation

### 5.1 — Remove dead V1 code

**Delete:**
- `src/domain/bet-selection-engine.js`
- `src/pipeline/selection-pipeline.js`
- `src/pipeline/smoke-test.js` (broken, will rewrite)
- `src/pipeline/backtest.js` (broken, will rewrite)
- `src/engine/runEngine.ts`
- `src/engine/betSelector/selector.ts`
- `src/engine/betSelector/explanation.ts`
- `src/engine/portfolioOptimizer/optimizer.ts`
- `src/engine/probabilityEngine/validate.ts`

**Keep:**
- `src/engine/edgeCalculator/edge.ts` — used
- `src/engine/featureFlags/*.ts` — used

---

### 5.2 — New and updated tests

**Delete:**
- `src/__tests__/bet-selection-engine.test.js` — tests deleted V1 engine

**New tests:**
- `name-normalization.test.js` — diacritics, null, consistency across modules
- `probability-blending.test.js` — logit-space blending with all null/valid combos
- `calibration.test.js` — model building and application
- `course-fit.test.js` — decomposition-based adjustment
- `market-wrappers.test.js` — matchup/three-ball with real sim scores
- `historical-odds-integration.test.js` — verify historical endpoint returns data

**Update:**
- `tournament-sim.test.js` — momentum, per-player tails, `returnSimScores`
- `selection-strategy.test.js` — blended probabilities, new confidence scoring

---

### 5.3 — Build backtest capability

**File:** `src/pipeline/backtest.js` — full rewrite

**Using historical odds data (now un-blocked):**
1. For each historical event (2019-2025):
   - Load pre-tournament archive predictions (predicted probabilities)
   - Load historical outright odds (sportsbook odds + actual outcomes)
   - Run the full engine pipeline: blend, calibrate, compute edge
   - Record: predicted probability, edge, actual outcome
2. Output:
   - **Brier score** per market (lower = better calibrated)
   - **Log-loss** per market
   - **ROI at recommended edge thresholds** (what profit would we have made?)
   - **Calibration curves** — predicted probability vs actual hit rate
   - **Per-tour breakdown**

**Dependencies:** Phase 0.7 (historical odds un-blocked), Phase 2.4 (calibration), all engine upgrades
**Validation:** This IS the validation — it proves whether the upgraded engine would have been profitable historically

---

### 5.4 — Rebuild smoke test

**File:** `src/pipeline/smoke-test.js` — rewrite

**Quick health check that verifies:**
1. DataGolf endpoints respond (schedule, field, preds, odds)
2. At least one event matches current week
3. Simulation produces >0 players with probabilities
4. Blending produces non-null fair probabilities for >50% of candidates
5. Calibration model loads successfully
6. At least one candidate has positive EV

---

## Implementation Order and Dependencies

```
Phase 0 (Bug Fixes)
  ├── 0.1 Name normalization        ← FIRST (everything depends on this)
  ├── 0.2 Null guard                ← independent
  ├── 0.3 CI pipeline               ← independent
  ├── 0.4 Severity sorting          ← independent
  ├── 0.5 Header overlap            ← independent
  ├── 0.6 Remove base44             ← independent
  ├── 0.7 Un-block historical odds  ← independent
  └── 0.8 Add missing endpoints     ← independent

Phase 1 (Activate Existing)
  ├── 1.1 Activate blending          ← depends on 0.1
  ├── 1.2 Course profile             ← depends on 0.1
  ├── 1.3 Sim score export           ← independent
  └── 1.4 Expand book allowlist      ← independent

Phase 2 (Integrate Data)
  ├── 2.1 Decompositions/course fit  ← depends on 0.1, 1.2
  ├── 2.2 Approach skill/volatility  ← depends on 0.1
  ├── 2.3 DG rankings/confidence     ← depends on 1.1
  ├── 2.4 Historical calibration     ← depends on 0.7, 1.1
  ├── 2.5 Historical course rounds   ← depends on 0.1, 1.2
  ├── 2.6 Parse extra pred fields    ← independent
  └── 2.7 Player list cross-ref      ← depends on 0.1

Phase 3 (Engine Refinements)
  ├── 3.1 Per-player tails           ← depends on 2.5
  ├── 3.2 Round momentum             ← independent
  └── 3.3 Dynamic field strength     ← depends on 0.1

Phase 4 (New Markets)
  └── 4.1 Matchups/three-balls       ← depends on 0.8, 1.3

Phase 5 (Cleanup + Validation)
  ├── 5.1 Remove dead code           ← independent
  ├── 5.2 Tests                      ← after all features
  ├── 5.3 Backtest                   ← depends on 0.7, 2.4, all engine upgrades
  └── 5.4 Smoke test                 ← after all features
```

---

## Estimated Implementation Cost

| Phase | Steps | Est. Tokens | Est. Cost (£) |
|---|---|---|---|
| Phase 0 | 8 bug fixes | ~120K | ~£3.00 |
| Phase 1 | 4 activations | ~100K | ~£2.50 |
| Phase 2 | 7 integrations | ~200K | ~£5.00 |
| Phase 3 | 3 refinements | ~80K | ~£2.00 |
| Phase 4 | 1 market expansion | ~80K | ~£2.00 |
| Phase 5 | 4 cleanup/validation | ~100K | ~£2.50 |
| **Total** | **27 steps** | **~680K** | **~£17.00** |

---

## Expected Impact on Pick Quality

| Change | Accuracy Improvement | Confidence |
|---|---|---|
| Name normalization (0.1) | +5-10% for international players | Very High |
| Activate blending (1.1) | +5-15% overall | High |
| Expand book allowlist (1.4) | +2-5% for market probability accuracy | High |
| Course fit from decompositions (2.1) | +5-10% per event | High |
| Approach skill volatility (2.2) | +2-4% | Medium |
| Calibration from historical outcomes (2.4) | +8-15% (corrects systematic bias) | High |
| Course-specific player history (2.5) | +3-5% per event | Medium |
| Additional pred fields (2.6) | +1-2% for FRL and mid-tier markets | Medium |
| Per-player tails (3.1) | +1-3% | Medium |
| Round momentum (3.2) | +1-3% | Medium |
| Dynamic field strength (3.3) | +2-4% for weak/strong fields | Medium |
| Matchup/three-ball markets (4.1) | New edge source (often best edges) | High |

**Combined estimated improvement: 25-45% more accurate edge calculations**

The three highest-ROI changes: activating blending (1.1), implementing calibration with real outcomes (2.4), and course fit from decompositions (2.1).

---

## What This Plan Does NOT Do

- Replace any part of the V2 architecture
- Use in-play data
- Change the tier system (PAR/BIRDIE/EAGLE/LONG SHOTS)
- Add new external dependencies or frameworks
- Change the deployment or hosting infrastructure
- Modify the frontend bet display beyond base44 removal and header fix
- Change the database schema beyond optional minor additions

---

*No changes have been made to any files. Awaiting approval before implementation.*
