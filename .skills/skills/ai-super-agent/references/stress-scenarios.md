# Stress Test Scenarios by Application Type

Use these scenario sets to stress-test synthetic builds. Select the sets that match the
application being planned.

---

## Web Application (Full Stack)

### Authentication & Authorization
- Session hijacking via stolen JWT
- Token expiry during multi-step operation
- Concurrent login from multiple devices
- Password reset flow race condition
- OAuth provider goes down
- Permission escalation through direct API access
- CSRF on state-changing operations

### Data & State
- Form submission during poor connectivity (partial data)
- Concurrent edits to same resource by different users
- Browser back button after form submission (double submit)
- Large file upload interrupted at 90%
- User deletes account while background jobs reference their data
- Database connection pool exhaustion under load
- Cache invalidation during high-traffic write operations

### Frontend
- JavaScript fails to load (CDN down)
- User on 3G connection with 2s latency
- Browser has JavaScript disabled
- Screen reader navigating the entire flow
- 4K screen, mobile screen, and everything between
- Browser auto-fill interfering with custom form logic
- Memory leak during extended single-page session

### Deployment
- Deploy while users are mid-transaction
- Rollback with database migration already applied
- New version reads old data format
- Static asset cache serves stale JavaScript
- Health check passes but application is partially broken

---

## API / Backend Service

### Request Handling
- 10x normal traffic spike in 30 seconds
- Request body 1000x expected size
- Malformed JSON with valid Content-Type header
- Request with valid auth but for deleted user
- Extremely slow client that keeps connection open for hours
- 1000 concurrent requests to same resource
- Request with circular references in nested JSON

### Data Integrity
- Two requests create same unique resource simultaneously
- Bulk operation fails at item 500 of 1000
- Foreign key reference to deleted record
- Numeric overflow in aggregation calculations
- Timezone mismatch between client, server, and database
- Unicode edge cases in text fields (emoji, RTL, zero-width characters)
- Null vs. empty string vs. missing field in optional data

### External Dependencies
- Payment provider returns HTTP 200 with error in body
- Email service queues backed up by 4 hours
- File storage service intermittently returns 503
- Third-party API changes response format without notice
- DNS resolution failure for external service
- Certificate expiry on external service
- Rate limited by external API at worst possible moment

---

## Enterprise Application

### Multi-Tenancy
- Tenant A's data leaked to Tenant B via shared cache
- Tenant with 100x more data than others slowing shared resources
- Tenant-specific configuration overriding global defaults incorrectly
- Billing calculation during plan change mid-month
- Data export includes records from wrong tenant

### Workflow & Business Logic
- Approval chain member leaves the company mid-approval
- Two conflicting business rules both apply to same operation
- Scheduled job runs twice due to clock skew across instances
- Financial calculation rounding accumulates to material error
- Report generation exceeds memory for largest customer
- Audit trail gap due to async event processing delay

### Compliance & Governance
- Data subject requests deletion of their PII
- Audit log storage full
- Encryption key rotation with data re-encryption
- Cross-border data transfer compliance check fails
- Retention policy triggers deletion of needed records

---

## Real-Time Systems

### WebSocket / Event-Driven
- Client reconnects and misses 100 events
- Event ordering guarantee broken by load balancer
- Publisher faster than subscriber (backpressure)
- Broadcast to 10K simultaneous connections
- Client sends events faster than server can process
- Network partition between event store replicas
- Duplicate event delivered due to at-least-once guarantee

### Consistency
- Read-after-write returns stale data
- Counter incremented by 100 concurrent requests
- Distributed lock expires during long operation
- Event replay produces different state than original
- Two nodes disagree on current state after partition heals

---

## Completeness Verification Checklist

After stress testing, verify the selected path handles:

- [ ] Every stress scenario rated SOLID or MANAGEABLE
- [ ] No BREAKS on any scenario in scope
- [ ] Every FRAGILE rating has an explicit mitigation plan
- [ ] Error handling exists for every external dependency failure
- [ ] Data integrity is maintained through every concurrent scenario
- [ ] User experience degrades gracefully (never crashes, never loses data)
- [ ] Recovery from every failure mode is automated or clearly documented
- [ ] Monitoring would detect every failure mode within 5 minutes
