# /engineering/debug-issue

Diagnose bugs from error messages, Sentry alerts, or behavior descriptions.

## Usage

```
/engineering/debug-issue "Users get 500 when accessing school detail"
/engineering/debug-issue <sentry-url>
/engineering/debug-issue "Login fails silently on mobile Safari"
```

## Process

### 1. Classify the Issue

Determine the domain:
- **Backend** — Python traceback, API errors (4xx/5xx), database issues, Celery task failures
- **Frontend** — JavaScript errors, rendering issues, state management bugs, network failures
- **Integration** — Auth flow breaks, CORS, API contract mismatches, sync failures

### 2. Gather Context (4-Phase Methodology)

#### Phase 1: Gather
- Read error messages/tracebacks carefully
- Identify the failing endpoint or component
- Check recent changes (`git log --oneline -20`)
- Read the relevant source files

#### Phase 2: Hypothesize
- List 2-3 most likely root causes
- Rank by probability
- Identify what evidence would confirm/deny each

#### Phase 3: Isolate
- Trace the code path from entry point to failure
- Check for:
  - Missing `is_active=True` filters (common)
  - RBAC scope not applied (common)
  - Pydantic schema mismatch (common)
  - Missing migration (common)
  - Frontend sending wrong payload shape
  - Token refresh race condition
  - Celery task not idempotent

#### Phase 4: Fix
- Propose minimal fix
- Identify regression risk
- Suggest test to prevent recurrence

### 3. Output Format

```markdown
# Diagnosis: {issue summary}

## Classification
- Domain: Backend / Frontend / Integration
- Severity: Critical / High / Medium / Low
- Affected users: All / Role-specific / Edge case

## Root Cause
{Clear explanation of why the bug happens}

## Evidence
- {File}:{line} — {what's wrong}
- {Observation that confirms the hypothesis}

## Fix Proposal
{Minimal code change needed}

## Regression Risk
- What else could this fix break?
- What should be manually tested?

## Prevention
- Test case to add: {description}
- Pattern to watch for: {description}

## Related
- Similar issues: {if any}
- Docs that should be updated: {if any}
```

## Common Session-Ops Bug Patterns

1. **Missing `is_active=True` filter** — returns deleted records
2. **RBAC scope bypass** — CO sees other CO's schools
3. **JWT middleware miss** — endpoint accessible without auth
4. **Pydantic v2 vs v1 syntax** — `@validator` instead of `@field_validator`
5. **Frontend barrel import** — `from @mui/material` pulls entire library
6. **Token refresh race** — multiple requests fail before refresh completes
7. **Migration ordering** — dependent migration not applied
8. **Celery task non-idempotent** — duplicate sync creates duplicate records
