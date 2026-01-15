# BetCaddies Repository Audit Report

Date: 2026-01-15

## Scope
- Frontend (Vite + React)
- Backend API (Express)
- Data pipeline + scrapers
- Prisma data model + migrations
- CI/CD + deployment configuration
- Observability and testing

## Executive Summary
The repo contains a functional scaffold for a golf betting data pipeline and a React UI, but there are critical mismatches between the backend API, Prisma schema, and pipeline data flow that would prevent production correctness. There are also high-risk security issues (hardcoded admin credentials in the frontend, unauthenticated admin/pipeline endpoints) and reliability issues (inconsistent odds data modeling, mock database client fallback). The system will likely run with a mix of mock data and failing API calls unless these are addressed.

## Strengths
- Clear pipeline architecture and separation of concerns in src/pipeline, src/sources, src/domain, and src/observability.
- Prisma schema is reasonably structured for the pipeline domain objects.
- CI workflow schedules a weekly pipeline run with logs uploaded as artifacts.
- Centralized logging via Winston with JSON logs.

## Critical Findings

### 1) Hardcoded admin credentials in frontend
- Impact: Anyone can access admin features by reading the client bundle.
- Location: [src/api/base44Client.js](src/api/base44Client.js)
- Risk: Credential exposure and privilege escalation.
- Recommendation: Remove hardcoded credentials, implement real auth, and never store admin secrets in client code.

### 2) Public pipeline execution endpoint with no auth
- Impact: Anyone can trigger expensive pipeline runs or abuse resources.
- Location: [src/server/index.js](src/server/index.js)
- Recommendation: Require auth/authorization and implement rate limits and request validation.

### 3) Backend API uses Prisma models/fields that do not exist
- Impact: API routes will throw at runtime.
- Examples:
  - Uses `researchRun`, `bettingProvider`, `dataQualityIssue`, `user`, `membershipPackage` models that are not present in the schema.
  - Uses `betRecommendation.selectionName`, `confidenceRating`, `betTitle`, `tour`, `tournamentName` fields that are not in Prisma.
- Locations: [src/server/index.js](src/server/index.js), [prisma/schema.prisma](prisma/schema.prisma)
- Recommendation: Align API routes with Prisma schema or update schema/migrations accordingly.

## High Severity Findings

### 4) Odds ingestion pipeline is inconsistent and will fail
- Issues:
  - `OddsEvent` requires `runId` but pipeline creates it without `runId`.
  - `groupOffersBySelection()` groups by `selectionName` but pipeline treats keys as `marketKey`.
  - `BetSelectionEngine` expects `market.key` and `market.offers`, but odds markets returned from Prisma use `marketKey` and `oddsOffers`.
- Locations: [src/pipeline/weekly-pipeline.js](src/pipeline/weekly-pipeline.js), [src/sources/odds/the-odds-api.js](src/sources/odds/the-odds-api.js), [src/domain/bet-selection-engine.js](src/domain/bet-selection-engine.js)
- Recommendation: Normalize odds data shape end-to-end and ensure Prisma writes satisfy required fields.

### 5) API client uses undefined POST method
- Impact: `functions.invoke()` will throw because `this.client.post` is never defined.
- Location: [src/api/client.js](src/api/client.js)
- Recommendation: Implement `post()` in the client or refactor to a proper fetch wrapper.

### 6) Mock database client fallback masks production failures
- Impact: App can appear to run while data operations silently fail.
- Location: [src/db/client.js](src/db/client.js)
- Recommendation: Fail fast on DB connection errors in production; use mock only in local dev with explicit flag.

## Medium Severity Findings

### 7) Security hardening missing on Express server
- Gaps: No `helmet`, no rate limiting, no request size limits, permissive CORS.
- Location: [src/server/index.js](src/server/index.js)
- Recommendation: Add standard middleware hardening and configure CORS origins.

### 8) Mixed mock/production data sources in frontend
- Impact: UI behavior differs between local and deployed environments; tests and QA become unreliable.
- Locations: [src/api/client.js](src/api/client.js), [src/api/base44Client.js](src/api/base44Client.js)
- Recommendation: Use a single API abstraction; avoid client-side mock data in production builds.

### 9) Lack of input validation for API routes
- Impact: Untrusted input can break API or corrupt data.
- Location: [src/server/index.js](src/server/index.js)
- Recommendation: Add validation with `zod` or `express-validator` for request params and bodies.

## Low Severity Findings

### 10) No log rotation for file logs
- Impact: Logs may grow unbounded on long-lived hosts.
- Location: [src/observability/logger.js](src/observability/logger.js)
- Recommendation: Add rotation or ship logs to a central system.

### 11) Minimal test coverage
- Only two unit tests appear in src/__tests__.
- Location: [src/__tests__](src/__tests__)
- Recommendation: Add tests for pipeline ingestion, odds parsing, API routes, and critical domain logic.

### 12) API base URL defaults to production
- Impact: Local dev may accidentally hit production.
- Location: [src/api/client.js](src/api/client.js)
- Recommendation: Default to localhost in development; use env variables in deployment.

## Data Model Alignment Gaps
- Backend expects fields not present in Prisma models.
- Pipeline writes objects that do not match schema requirements.
- Frontend expects fields that the backend never returns (e.g., `bet_title`, `tournament_name`, `confidence_rating`).

Recommendation: Define an explicit API contract (OpenAPI or Zod schema) and enforce it at both ends.

## CI/CD Review
- Weekly GitHub Actions job runs pipeline and uploads logs.
- Missing: automated tests, lint checks, and build verification.
- Location: [.github/workflows/weekly-pipeline.yml](.github/workflows/weekly-pipeline.yml)

## Action Plan (Prioritized)

1) **Security & auth**
   - Remove hardcoded admin credentials.
   - Add auth to admin and pipeline endpoints.
   - Add rate limiting and request validation.

2) **Schema and API alignment**
   - Fix Prisma schema or server responses to match.
   - Make API contract explicit and test it.

3) **Fix odds pipeline data flow**
   - Align `OddsEvent` creation with schema.
   - Fix market/offer structure and selection engine expectations.

4) **Improve reliability and observability**
   - Fail fast on DB errors in production.
   - Add structured error handling and log rotation.

5) **Testing & CI**
   - Add unit/integration tests for pipeline and API.
   - Add lint/test/build steps to CI.

## Appendix: Files Reviewed
- [README.md](README.md)
- [bet-caddies-29c0a99a/README.md](bet-caddies-29c0a99a/README.md)
- [bet-caddies-29c0a99a/package.json](bet-caddies-29c0a99a/package.json)
- [src/server/index.js](src/server/index.js)
- [prisma/schema.prisma](prisma/schema.prisma)
- [src/pipeline/weekly-pipeline.js](src/pipeline/weekly-pipeline.js)
- [src/sources/odds/the-odds-api.js](src/sources/odds/the-odds-api.js)
- [src/domain/bet-selection-engine.js](src/domain/bet-selection-engine.js)
- [src/api/client.js](src/api/client.js)
- [src/api/base44Client.js](src/api/base44Client.js)
- [src/observability/logger.js](src/observability/logger.js)
- [src/db/client.js](src/db/client.js)
- [.github/workflows/weekly-pipeline.yml](.github/workflows/weekly-pipeline.yml)
