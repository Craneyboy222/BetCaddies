# Domain Frameworks Reference

When generating a skill for a common task type, use this reference as a starting point
for domain research. These are the authoritative frameworks and exhaustive coverage
dimensions for each domain. Always expand beyond this list based on the specific task.

---

## Table of Contents

1. [Code Audit](#code-audit)
2. [Security Review](#security-review)
3. [Performance Analysis](#performance-analysis)
4. [Architecture Review](#architecture-review)
5. [API Review](#api-review)
6. [Database Review](#database-review)
7. [Frontend Review](#frontend-review)
8. [DevOps / Infrastructure](#devops--infrastructure)
9. [Data Analysis](#data-analysis)
10. [Documentation Review](#documentation-review)
11. [Test Suite Review](#test-suite-review)
12. [Migration Planning](#migration-planning)

---

## Code Audit

### Authoritative Frameworks
- OWASP Top 10 (web security)
- SANS CWE Top 25 (software weaknesses)
- SonarQube quality rules
- Language-specific style guides (PEP 8, Google Style Guides, Airbnb JS)
- SOLID principles, DRY, KISS

### Coverage Dimensions
**Security** (see Security Review for deep dive)
- Injection vulnerabilities (SQL, command, LDAP, XPath)
- Authentication and session management
- Access control and authorization
- Cryptographic practices
- Input validation and output encoding
- Sensitive data handling

**Code Quality**
- Cyclomatic complexity (functions > 10 = flag)
- Function/method length (> 50 lines = flag)
- Class/module size (> 500 lines = flag)
- Nesting depth (> 4 levels = flag)
- Dead code and unreachable branches
- Code duplication (DRY violations)
- Naming conventions and consistency
- Magic numbers and hardcoded values
- Comment quality (outdated, misleading, absent)
- Error handling patterns (swallowed exceptions, generic catches)

**Architecture**
- Dependency direction (clean architecture violations)
- Circular dependencies
- Layer violations (UI calling DB directly)
- Coupling analysis (afferent/efferent)
- Cohesion assessment (single responsibility)
- Configuration management (hardcoded vs externalized)

**Reliability**
- Null/undefined handling
- Resource lifecycle (open/close, memory leaks)
- Concurrency issues (race conditions, deadlocks)
- State management correctness
- Boundary conditions

**Maintainability**
- Test coverage and quality
- Documentation coverage
- Onboarding complexity (how long to understand?)
- Change risk (what breaks when you modify X?)
- Technical debt indicators

---

## Security Review

### Authoritative Frameworks
- OWASP Top 10 (2021)
- OWASP ASVS (Application Security Verification Standard)
- NIST SP 800-53
- CIS Benchmarks
- STRIDE threat model

### Coverage Dimensions
**CRITICAL Priority**
- SQL injection (any string concatenation in queries)
- Cross-site scripting (XSS) — reflected, stored, DOM-based
- Authentication bypass vectors
- Insecure direct object references (IDOR)
- Server-side request forgery (SSRF)
- Remote code execution paths
- Deserialization of untrusted data
- Hardcoded secrets, API keys, credentials

**HIGH Priority**
- CSRF protection on state-changing operations
- Authorization checks on every endpoint
- Session management (fixation, expiry, rotation)
- File upload validation (type, size, content)
- Path traversal in file operations
- Command injection in system calls
- XML External Entity (XXE) processing
- Sensitive data in logs, URLs, or error messages

**MEDIUM Priority**
- HTTP security headers (CSP, HSTS, X-Frame-Options)
- CORS configuration
- Rate limiting on sensitive endpoints
- Account enumeration prevention
- Password policy enforcement
- Dependency vulnerabilities (outdated packages)
- TLS configuration
- Cookie security flags (Secure, HttpOnly, SameSite)

**LOW Priority**
- Information disclosure in error messages
- Directory listing enabled
- Unnecessary HTTP methods enabled
- Missing security.txt
- Subresource integrity on CDN assets

---

## Performance Analysis

### Authoritative Frameworks
- Google Core Web Vitals (LCP, FID, CLS)
- Lighthouse performance scoring
- Database EXPLAIN analysis
- Profiling methodologies (CPU, memory, I/O)

### Coverage Dimensions
**Database**
- N+1 query patterns
- Missing indexes on filtered/sorted/joined columns
- Full table scans on large tables
- Unbounded SELECT without LIMIT
- Expensive JOIN operations
- Connection pool sizing
- Query result caching opportunities
- Schema denormalization opportunities

**Application**
- Algorithmic complexity (O(n²) or worse in hot paths)
- Memory allocation patterns (object creation in loops)
- Synchronous blocking in async contexts
- Unbounded collection growth
- String concatenation in loops (vs. builders)
- Redundant computation (missing memoization)
- Resource pooling (HTTP clients, DB connections)
- Serialization/deserialization overhead

**Network/I/O**
- Payload sizes (over-fetching)
- Request waterfall patterns
- Missing compression (gzip, brotli)
- Missing caching headers (ETags, Cache-Control)
- Unnecessary round trips (N+1 at API level)
- Connection reuse and keep-alive
- CDN utilization

**Frontend** (if applicable)
- Bundle size and code splitting
- Render-blocking resources
- Image optimization (format, size, lazy loading)
- DOM size and depth
- Layout thrashing (forced reflows)
- Memory leaks (event listeners, closures)

---

## Architecture Review

### Authoritative Frameworks
- AWS Well-Architected Framework (6 pillars)
- TOGAF Architecture Development Method
- C4 Model (Context, Container, Component, Code)
- 12-Factor App methodology
- Domain-Driven Design

### Coverage Dimensions
- Component boundaries and responsibilities
- Data flow and dependency direction
- Scalability vectors (horizontal, vertical, data partitioning)
- Failure modes and resilience (circuit breakers, retries, fallbacks)
- Observability (logging, metrics, tracing, alerting)
- Deployment architecture (environments, promotion, rollback)
- Security architecture (trust boundaries, authentication flow)
- Data consistency strategy (ACID, eventual, saga patterns)
- API contract stability and versioning
- Technology selection justification
- Operational complexity assessment
- Cost analysis and optimization opportunities

---

## API Review

### Coverage Dimensions
- Endpoint naming consistency and RESTful conventions
- HTTP method usage correctness
- Status code usage (proper 4xx vs 5xx, specific codes)
- Request/response schema consistency
- Authentication and authorization on every endpoint
- Rate limiting and throttling
- Pagination on list endpoints
- Filtering, sorting, and field selection
- Error response format standardization
- Versioning strategy
- HATEOAS / discoverability
- Idempotency on mutating operations
- Bulk operation support where needed
- Webhook/callback design (if applicable)
- Documentation completeness (OpenAPI/Swagger)
- Breaking change risk assessment
- Performance characteristics per endpoint

---

## Database Review

### Coverage Dimensions
- Schema normalization assessment
- Index coverage and efficiency
- Foreign key and constraint completeness
- Data type appropriateness
- Migration safety (backward compatible?)
- Query performance (slow query analysis)
- Connection management
- Backup and recovery strategy
- Data retention and archival
- Access control (principle of least privilege)
- Encryption at rest and in transit
- Audit logging for sensitive data access

---

## Frontend Review

### Coverage Dimensions
- Accessibility (WCAG 2.1 AA compliance)
- Responsive design and breakpoint coverage
- Browser compatibility
- Performance (Core Web Vitals)
- State management patterns
- Component architecture (reusability, composition)
- Error boundary coverage
- Loading and error state handling
- Internationalization readiness
- SEO fundamentals (meta tags, semantic HTML, structured data)
- Asset optimization
- Progressive enhancement / graceful degradation

---

## DevOps / Infrastructure

### Coverage Dimensions
- CI/CD pipeline completeness and speed
- Infrastructure as Code coverage
- Environment parity (dev/staging/prod)
- Secret management (no plaintext, rotation strategy)
- Monitoring and alerting coverage
- Log aggregation and searchability
- Disaster recovery and backup verification
- Scaling automation (auto-scaling policies)
- Cost optimization (right-sizing, reserved instances)
- Security patching cadence
- Container security (base images, scanning)
- Network security (segmentation, firewalls)

---

## Data Analysis

### Coverage Dimensions
- Data profiling (types, distributions, cardinality)
- Quality assessment (completeness, consistency, accuracy, timeliness)
- Statistical summary (central tendency, dispersion, shape)
- Correlation and relationship analysis
- Anomaly and outlier detection
- Trend and pattern identification
- Segmentation opportunities
- Visualization strategy (chart type selection per insight)
- Bias and confounding factor assessment
- Reproducibility (documented methodology)
- Actionable insight synthesis

---

## Documentation Review

### Coverage Dimensions
- README completeness (setup, usage, contribution guide)
- API documentation accuracy (matches implementation?)
- Architecture decision records (ADRs)
- Onboarding guide existence and quality
- Code comment quality and coverage
- Changelog maintenance
- Environment setup documentation
- Deployment runbook
- Incident response procedures
- Configuration reference

---

## Test Suite Review

### Coverage Dimensions
- Coverage metrics (line, branch, path)
- Test pyramid balance (unit > integration > e2e)
- Test quality (asserting behavior, not implementation)
- Edge case coverage
- Error path testing
- Test isolation (no shared state, no order dependence)
- Test speed and CI impact
- Flaky test identification
- Mock/stub appropriateness
- Missing test categories (security, performance, accessibility)
- Test data management
- Snapshot test staleness

---

## Migration Planning

### Coverage Dimensions
- Current state assessment (what exists, what depends on what)
- Target state definition
- Dependency graph and migration ordering
- Backward compatibility during migration
- Rollback strategy at each stage
- Data migration plan (schema changes, backfills)
- Feature flag strategy for incremental rollout
- Testing strategy (parallel running, shadow traffic)
- Timeline and milestone definition
- Risk register with mitigations
- Communication plan (stakeholders, downstream consumers)
- Success criteria and verification
