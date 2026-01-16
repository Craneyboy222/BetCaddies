# BetCaddies - Golf Betting Intelligence Platform

A production-grade golf betting analysis platform that scrapes tournament data from major tours and generates bet recommendations using The Odds API.

## 🏗️ Architecture

### Pipeline Structure
```
src/
├── pipeline/           # Orchestration + weekly runs
├── sources/           # Data ingestion (scrapers + APIs)
│   ├── golf/         # Tour-specific scrapers
│   └── odds/         # The Odds API client
├── db/               # Database client + schema
├── domain/           # Business logic (normalization, selection)
├── observability/    # Logging + issue tracking
└── __tests__/       # Unit tests
```

### Data Flow
1. **Discovery**: Find current-week tournaments across PGA, LPGA, LIV
2. **Ingestion**: Scrape player fields, tee times, course data, weather
3. **Enrichment**: Fetch betting odds from The Odds API
4. **Analysis**: Generate bet selections with ML-style features
5. **Publication**: Output 30 bets (10 PAR, 10 BIRDIE, 10 EAGLE)

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database
- The Odds API key

### Installation

1. **Clone and install**
   ```bash
   git clone https://github.com/Craneyboy222/BetCaddies.git
   cd bet-caddies
   npm install
   ```

2. **Database setup**
   ```bash
   # Set up PostgreSQL database
   createdb bet_caddies

   # Generate Prisma client
   npm run db:generate

   # Run migrations
   npm run db:push
   ```

3. **Environment configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your DATABASE_URL and THE_ODDS_API_KEY
   ```

4. **Run the pipeline**
   ```bash
   # Smoke test (PGA only)
   npm run pipeline:smoke

   # Full weekly pipeline
   npm run pipeline:weekly
   ```

5. **Start the frontend**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `THE_ODDS_API_KEY` | The Odds API key | Yes |
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | No |
| `USER_AGENT` | HTTP User-Agent header | No |

### GitHub Secrets

For automated pipeline runs, add these secrets to your GitHub repository:

- `DATABASE_URL`: Your production database URL
- `THE_ODDS_API_KEY`: Your The Odds API key

## 📊 Pipeline Commands

### Manual Runs
```bash
# Run full weekly pipeline
npm run pipeline:weekly

# Run smoke test (PGA only)
npm run pipeline:smoke

# Run with custom run key
npm run pipeline:weekly custom_run_2024
```

### Automated Runs
The pipeline runs automatically every Monday at 06:00 UTC via GitHub Actions.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:ui

# Run specific test file
npm test player-normalizer.test.js
```

## 📈 Data Model

### Core Entities

- **Run**: Weekly pipeline execution
- **TourEvent**: Tournament instances (PGA Championship, etc.)
- **Player**: Canonical player records with aliases
- **FieldEntry**: Players in specific tournaments
- **OddsEvent/Market/Offer**: Betting data from The Odds API
- **BetRecommendation**: Generated bet selections
- **DataIssue**: Pipeline issues and warnings

### Bet Tiers

| Tier | Odds Range | Target Count |
|------|------------|--------------|
| PAR | ≤5/1 | 10 bets |
| BIRDIE | 6/1 - 10/1 | 10 bets |
| EAGLE | ≥11/1 | 10 bets |

### Tour Coverage

- **PGA Tour**: pgatour.com
- **LPGA**: lpga.com
- **LIV Golf**: livgolf.com

## 🔍 Monitoring & Observability

### Logs
Pipeline logs are written to:
- Console (with colors)
- `logs/pipeline.log` (structured JSON)
- GitHub Actions artifacts

### Issue Tracking
Data quality issues are tracked in the `DataIssue` table with severity levels:
- `error`: Pipeline-stopping issues
- `warning`: Data quality concerns
- `info`: Informational notes

### Run Reports
Each pipeline run generates a summary report including:
- Events discovered per tour
- Players ingested
- Odds markets collected
- Final bet counts
- Top data issues

## 🛠️ Development

### Adding a New Tour Scraper

1. Create scraper in `src/sources/golf/your-tour.js`
2. Implement the interface:
   ```javascript
   class YourTourScraper extends BaseScraper {
     async discoverEvent(weekWindow) { /* ... */ }
     async fetchField(event) { /* ... */ }
     async fetchTeeTimes(event) { /* ... */ }
     async fetchLeaderboard(event) { /* ... */ }
   }
   ```
3. Add to `src/sources/golf/index.js`
4. Update pipeline in `WeeklyPipeline`

### Database Changes

1. Update `prisma/schema.prisma`
2. Generate client: `npm run db:generate`
3. Create migration: `npm run db:migrate`

### Testing New Features

1. Add tests in `src/__tests__/`
2. Run tests: `npm test`
3. Update smoke test if needed

## 🚨 Troubleshooting

### Common Issues

**Pipeline fails with "No odds found"**
- Check THE_ODDS_API_KEY is valid
- Verify The Odds API coverage for the tournament
- Check tournament dates match API expectations

**Scraper blocked (403 errors)**
- Website may have anti-bot measures
- Consider implementing Playwright fallback
- Check USER_AGENT configuration

**Database connection issues**
- Verify DATABASE_URL format
- Ensure PostgreSQL is running
- Check database permissions

### Debug Mode

```bash
LOG_LEVEL=debug npm run pipeline:weekly
```

## 📋 Runbook

### Weekly Pipeline Checklist

- [ ] Monday 06:00 UTC automated run completes
- [ ] Check pipeline logs for errors
- [ ] Verify bet counts (30 total: 10/10/10)
- [ ] Review DataIssue table for critical issues
- [ ] Confirm tour distribution meets minimums
- [ ] Update frontend with new recommendations

### Emergency Procedures

**Pipeline fails completely:**
1. Check GitHub Actions logs
2. Review DataIssue table
3. Run manual pipeline with custom key
4. Contact The Odds API support if needed

**Data quality issues:**
1. Review DataIssue severity levels
2. Check scraper implementations
3. Update player normalization rules
4. Re-run pipeline for affected tours

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure pipeline runs successfully
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.