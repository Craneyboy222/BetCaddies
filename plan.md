# HIO Challenge Upgrade Plan

## Audit Summary

**What works today:**
- 6 question types with 2-3 choice answers (Over/Under, Yes/No, Head-to-Head with 3 players, etc.)
- Question generation from real tournament/player data via pipeline
- Admin can: create challenges manually, edit questions inline, regenerate 1 or all questions, set correct answers, edit prize, calculate scores
- User quiz modal with progress tracking, one entry per user per challenge
- Database schema supports everything needed (HIOChallenge, HIOEntry, User.hioTotalPoints)

**What's missing / broken:**
1. No automatic weekly generation — admin must click a button manually
2. No way to regenerate a *selection* of questions (only 1 or all)
3. Admin cannot edit page text (hero title, tagline, "How It Works" content)
4. No winner notifications (push or email)
5. No leaderboard / points system (field exists but unused)
6. No auto-close of previous challenge when new one generates
7. Challenge doesn't auto-settle — admin must manually calculate scores

---

## Upgrade Plan

### 1. Auto-generate challenge every Tuesday at 12:00 PM GMT

**Why Tuesday:** The pipeline runs Monday 9am (discovery) and Tuesday 9am (odds update). By noon Tuesday, field data and odds are fresh. This gives users 2 full days before Thursday tournament starts — maximising entries.

**Changes:**

**`src/server/index.js`** — Add new cron job alongside existing ones:
```
cron.schedule('0 12 * * 2', ...) // Tuesday 12:00 PM
```
- Calls `createOrUpdateWeeklyChallenge()` from the question generator service
- Uses default prize or fetches the last challenge's prize as template
- Archives any existing active challenge automatically (this already works)
- Logs success/failure

**`src/services/hio-question-generator.js`** — Minor hardening:
- Add validation that at least 1 tour event exists before generating
- If no events found (off-season), skip generation and log warning instead of creating a challenge with generic fallback questions
- Ensure `createOrUpdateWeeklyChallenge` is idempotent (safe to call twice)

---

### 2. Admin: regenerate multiple (selected) questions

**Currently:** Admin can regenerate 1 question or all 10. No way to pick, say, questions 2, 5, and 8.

**Changes:**

**`src/components/admin/HIOChallengeAdmin.jsx`:**
- Add checkbox to each question card
- Add "Regenerate Selected" button (appears when 1+ checkboxes ticked)
- Button calls a new batch endpoint

**`src/server/index.js`** — New endpoint:
```
POST /api/entities/hio-challenges/:id/regenerate-questions
Body: { indices: [1, 4, 7] }
```
- Generates fresh questions for only the specified indices
- Keeps all other questions unchanged
- Returns updated challenge

**`src/services/hio-question-generator.js`:**
- New function `generateQuestionsForIndices(existingQuestions, indices)` that generates replacements only for the requested positions, preserving question type distribution

---

### 3. Admin: editable page content (prize + page text)

**Currently:** Admin can edit `prizeDescription`. Cannot edit hero title, tagline, or "How It Works" text.

**Changes:**

**Database — New model `SiteContent`:**
```prisma
model SiteContent {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt
}
```
New Prisma migration for this table.

**Seed data** — Insert defaults:
- `hio_hero_title`: "Hole-In-One Challenge"
- `hio_hero_tagline`: "Test your golf knowledge..."
- `hio_how_it_works`: { steps: [...] }
- `hio_prize_text`: Additional text/context shown with prize

**`src/server/index.js`** — New endpoints:
```
GET  /api/site-content/:key        (public)
PUT  /api/site-content/:key        (admin only)
GET  /api/site-content?keys=a,b,c  (public, batch fetch)
```

**`src/pages/HIOChallenge.jsx`:**
- Fetch `hio_hero_title`, `hio_hero_tagline`, `hio_how_it_works` from API
- Render dynamic text instead of hardcoded strings
- Fallback to current hardcoded values if fetch fails

**`src/components/admin/HIOChallengeAdmin.jsx`:**
- Add "Page Content" section with editable fields for:
  - Hero title
  - Hero tagline
  - How It Works steps
  - Prize text / description
- Inline editing with save button per field

---

### 4. Auto-close previous challenge + settle scores

**Currently:** Admin must manually "Calculate Scores & Close." Previous challenge is archived when new one generates, but scores aren't calculated first.

**Changes:**

**`src/services/hio-question-generator.js`** — Update `createOrUpdateWeeklyChallenge`:
- Before archiving the old active challenge, check if it has entries
- If it has entries AND all questions have `correct_answer` set, auto-calculate scores first
- Then archive it
- Log if skipping score calculation (no correct answers set — admin needs to set them)

**`src/server/index.js`** — In the Tuesday cron job:
- The auto-settle logic lives in the service, triggered automatically before new challenge creation

This means the admin workflow becomes:
1. Tuesday: New challenge auto-generates
2. During the week: Admin sets correct answers as tournament results come in (Sunday/Monday)
3. Next Tuesday: Old challenge auto-settles scores, new one generates

---

### 5. Winner notifications

**Changes:**

**`src/services/hio-question-generator.js`** — After score calculation:
- Query all entries with `isPerfect === true`
- For each winner, send push notification via existing `sendToUser()`
- Queue email notification via existing email queue system
- Email includes: congratulations, score, prize info, call to action

**Email template:** New template `hio-winner` with:
- Challenge name / tournament
- Score
- Prize description
- CTA to view results

---

### 6. Leaderboard and points

**Changes:**

**`src/server/index.js`** — New endpoints:
```
GET /api/hio/leaderboard          (public)
GET /api/hio/my-history           (auth required)
```

**Leaderboard endpoint:**
- Query users ordered by `hioTotalPoints` DESC, limit 50
- Return: rank, display name, total points, challenges entered, perfect scores

**My history endpoint:**
- Query all HIOEntry records for current user
- Join with HIOChallenge for tournament names and dates
- Return: list of past entries with scores, dates, tournament names

**Points allocation** — In score calculation:
- Perfect score (10/10): +10 points
- 8-9 correct: +5 points
- 5-7 correct: +2 points
- Under 5: +1 point (participation)
- Update `User.hioTotalPoints` automatically

**`src/pages/HIOChallenge.jsx`:**
- Add leaderboard section below the quiz (top 10 with "View Full" link)
- Add "My History" tab showing past entries and scores

**`src/components/admin/HIOChallengeAdmin.jsx`:**
- Show leaderboard stats in admin dashboard

---

## File Change Summary

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `SiteContent` model |
| `prisma/migrations/` | New migration for SiteContent |
| `src/server/index.js` | Tuesday cron job, batch regenerate endpoint, site-content CRUD endpoints, leaderboard/history endpoints |
| `src/services/hio-question-generator.js` | Idempotent generation, `generateQuestionsForIndices()`, auto-settle before archive, points allocation, winner notification trigger |
| `src/pages/HIOChallenge.jsx` | Dynamic page text from SiteContent, leaderboard section, my history tab |
| `src/components/admin/HIOChallengeAdmin.jsx` | Multi-select question regeneration, page content editor section |

## Execution Order

1. Database migration (SiteContent model)
2. Auto-generation cron job (Tuesday 12pm)
3. Batch question regeneration (admin)
4. Editable page content (SiteContent CRUD + admin UI + user page)
5. Auto-settle scores on new challenge creation
6. Winner notifications (push + email)
7. Leaderboard and points system
