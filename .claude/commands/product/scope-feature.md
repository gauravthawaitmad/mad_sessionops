# /product/scope-feature

Quickly scope a feature idea into a structured brief for discussion.

## Usage

```
/product/scope-feature "Bulk import children from CSV"
/product/scope-feature "Admin dashboard for sync monitoring"
```

## Process

### 1. Read Context

- `docs/MILESTONE.md` — where does this fit?
- `docs/BUSINESS_RULES.md` — what rules apply?
- `docs/ARCHITECTURE.md` — what exists to build on?

### 2. Generate Brief

```markdown
# Feature Brief: {name}

## Problem
What user pain does this solve? Who feels it?

## Proposed Solution
One paragraph: what we'd build.

## Fits In
- Milestone: M{X} (or "new — not currently planned")
- Dependencies: {what must exist first}
- Actors: {CO / CHO / Admin}

## Scope (v1 — smallest useful version)
- Must have:
  - {item}
  - {item}
- Explicitly NOT in v1:
  - {item}
  - {item}

## Business Rules
- {Relevant rules from BUSINESS_RULES.md}

## Rough Effort
- Backend: {models + endpoints + services needed}
- Frontend: {pages + components needed}
- Migrations: Yes/No
- Celery tasks: Yes/No

## Open Questions
- {Question needing human decision}

## Recommendation
Build it / Defer it / Needs more research — and why.
```

### 3. Output

Display in chat. Do NOT save to file unless the human asks.

## Rules

- This is a discussion tool, not a commitment.
- Keep it to one page. If it takes more, the feature is too big — suggest splitting.
- Be honest about effort. Don't minimize complexity.
- If this conflicts with existing milestone scope, flag it clearly.
