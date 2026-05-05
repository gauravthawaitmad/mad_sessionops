# /product/write-milestone-spec

Write or refine a milestone specification document.

## Usage

```
/product/write-milestone-spec M2    # Write the M2 detailed spec
/product/write-milestone-spec M3    # Write the M3 detailed spec
```

## Process

### 1. Read Context

- Read `docs/MILESTONE.md` for the milestone's planned scope
- Read the previous milestone's detailed doc for format reference (`docs/milestones/M1.md`)
- Read `docs/BUSINESS_RULES.md` for relevant rules
- Read `docs/GLOSSARY.md` for terms
- Read `docs/ARCHITECTURE.md` for system context

### 2. Resolve Open Questions

The central milestone doc lists open questions for each milestone. Before writing the spec, present these to the human and get answers. Don't proceed with assumptions.

### 3. Write the Spec

Use this template (based on M1.md):

```markdown
# Milestone {N} — {Theme}

**Status:** Not started
**Production goal:** {One sentence: what a user can do when this ships}
**Prerequisite:** M{N-1} shipped and stable

---

## Features

| ID | Feature | Description | Priority |
|----|---------|-------------|----------|
| F-MN-1 | Name | One-line description | Must have |
| F-MN-2 | Name | One-line description | Must have |

---

## Feature Details

### F-MN-1: {Name}

**What:** {2-3 sentences}
**Who uses it:** {CO / CHO / Admin}
**Business rules enforced:**
- {Rule from BUSINESS_RULES.md}
- {Rule from BUSINESS_RULES.md}

**Backend scope:**
- Model changes: {list}
- New endpoints: {list with method + path}
- Service methods: {list}

**Frontend scope:**
- Pages: {list}
- Components: {new vs reuse}
- State: {what changes}

**Acceptance criteria:**
- [ ] {Specific, testable criterion}
- [ ] {Specific, testable criterion}

**Test scenarios:**
- Happy path: {description}
- Edge case: {description}
- Error case: {description}

---

[Repeat for each feature]

---

## Out of Scope

Explicitly list what is NOT in this milestone to prevent scope creep:
- {Item} (deferred to M{X})
- {Item} (deferred to M{X})

## Dependencies

- External: {anything needed from outside the team}
- Internal: {features that must be built in order}

## Rollback Plan

If this milestone ships and breaks production:
- {How to revert}
- {What data state to expect after revert}

## Done Criteria

All of:
- [ ] All features pass acceptance criteria
- [ ] All tests pass (backend + frontend)
- [ ] Deployed to production
- [ ] Smoke test: {specific user flow to verify}
- [ ] No new Sentry errors in 24h
```

### 4. Save

Save to: `docs/milestones/M{N}.md`

## Rules

- Don't write the spec without resolving open questions first.
- Every feature MUST have acceptance criteria. Vague features can't be built.
- Use the exact feature IDs from MILESTONE.md (F-MN-X format).
- Keep scope ruthless. If it's not in MILESTONE.md's feature list, it doesn't go in the spec.
