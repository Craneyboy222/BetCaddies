# Domain Expertise Map

Deep expertise profiles for constructing optimal roles. When synthesizing a role for
a task, find the matching domain and use the expertise dimensions to build specificity.

---

## Software Engineering

### Backend / API Engineering
**Signature experiences to draw from:**
- Designed APIs serving 10M+ requests/day
- Built payment/financial transaction systems
- Migrated monolith to microservices
- Designed event-driven architectures at scale
- Built multi-tenant SaaS platforms

**Quality instincts this role brings:**
- API surface design (consumer-first thinking)
- Error handling that anticipates production failures
- Idempotency and retry safety
- Database query optimization instincts
- Security-by-default thinking

### Frontend Engineering
**Signature experiences:**
- Built component systems used by 50+ developers
- Optimized Core Web Vitals from red to green
- Architected state management for complex SPAs
- Built accessible (WCAG AA) interfaces at scale
- Designed design-system-to-code pipelines

**Quality instincts:**
- Component composition over inheritance
- Performance budget awareness
- Accessibility as a default, not an afterthought
- User experience micro-interactions
- Bundle size consciousness

### Infrastructure / Platform
**Signature experiences:**
- Designed auto-scaling systems handling 10x traffic spikes
- Built CI/CD pipelines with < 10min deploy cycles
- Managed Kubernetes clusters at 500+ pods
- Designed disaster recovery achieving < 1hr RTO
- Built infrastructure-as-code for multi-region deployments

**Quality instincts:**
- Everything fails — design for it
- Observability is not optional
- Automation over runbooks
- Blast radius containment
- Cost awareness at every decision

### Security Engineering
**Signature experiences:**
- Led security audits finding critical vulnerabilities
- Designed authentication systems for multi-tenant platforms
- Built threat modeling processes adopted company-wide
- Responded to production security incidents
- Designed zero-trust architectures

**Quality instincts:**
- Assume inputs are adversarial
- Principle of least privilege everywhere
- Defense in depth (never one layer)
- Secrets management paranoia
- Audit trail everything

### Data Engineering
**Signature experiences:**
- Built data pipelines processing TB/day
- Designed data warehouse schemas for 100+ analysts
- Migrated from batch to real-time processing
- Built data quality monitoring catching issues before stakeholders
- Designed data governance frameworks

**Quality instincts:**
- Schema-first design
- Idempotent and replayable pipelines
- Data quality at ingestion, not after
- Lineage and observability
- Cost-per-query awareness

---

## Architecture & Design

### System Architecture
**Signature experiences:**
- Designed systems serving 100M+ users
- Led architecture reviews for critical business systems
- Made build-vs-buy decisions saving $M
- Designed migration strategies for legacy systems
- Created architecture decision records adopted org-wide

**Quality instincts:**
- Simplest solution that works at required scale
- Reversibility of decisions
- Operational cost of complexity
- Conway's Law awareness (team structure = system structure)
- Trade-off documentation as a first-class artifact

### API Design
**Signature experiences:**
- Designed public APIs used by 1000+ developers
- Created API style guides adopted by the organization
- Evolved APIs through 5+ major versions without breaking consumers
- Designed API gateways handling auth, rate limiting, and routing

**Quality instincts:**
- Consumer empathy (what's the simplest correct call site?)
- Consistency over cleverness
- Backward compatibility as sacred
- Error messages as documentation
- Discoverability and self-description

---

## Technical Writing & Communication

### Developer Documentation
**Signature experiences:**
- Wrote documentation that reduced support tickets by 60%
- Created onboarding guides cutting ramp-up time in half
- Built documentation systems with automated code sample testing
- Wrote API references used by 10K+ developers

**Quality instincts:**
- Task-oriented structure (what users need to DO)
- Every code sample must actually run
- Progressive disclosure (quickstart → guide → reference)
- Anticipate the question behind the question

### Technical Strategy / RFCs
**Signature experiences:**
- Written 40+ RFCs, 12 became company standards
- Created RFC templates adopted across the engineering org
- Wrote the proposal that changed the company's technical direction
- Built consensus on contentious architectural decisions through writing

**Quality instincts:**
- Make the decision feel obvious by the end
- Address objections before they arise
- "What we're NOT doing" is as important as "what we are"
- Concrete success metrics, not vague goals
- Reversibility and escape hatches

---

## Analysis & Strategy

### Technical Analysis
**Signature experiences:**
- Analyzed system performance finding 10x improvements
- Conducted build-vs-buy analyses saving $M in licensing
- Led technology evaluation resulting in successful platform migration
- Built analytical frameworks adopted by the engineering org

**Quality instincts:**
- Evidence over opinion
- Quantify everything quantifiable
- Acknowledge uncertainty explicitly
- Recommendations must be actionable this quarter
- Consider second-order effects

### Business/Product Analysis
**Signature experiences:**
- Market analysis that identified a $50M opportunity
- Competitive analysis that changed product strategy
- Cost-benefit analysis that killed a project (saving $M)
- Built forecasting models with < 10% variance

**Quality instincts:**
- Start with "so what?" — every analysis must answer it
- Distinguish correlation from causation
- Test assumptions, don't assume them
- Executive summary that stands alone
- Recommendations ranked by impact/effort ratio

---

## Role Combination Rules

When a task spans multiple domains, combine roles carefully:

1. **Pick a primary role** — The domain that matters most for output quality
2. **Add secondary expertise as context** — "with deep experience in X"
3. **Never combine more than 3 domains** — It dilutes the role identity
4. **Resolve conflicts explicitly** — If security says "lock it down" and UX says
   "reduce friction," the role must know which wins

**Example combination:**
"A principal backend engineer who designed Stripe's payment idempotency system,
with deep security engineering experience from 5 years of PCI compliance work
and a product sensibility that prioritizes developer experience in API design."
