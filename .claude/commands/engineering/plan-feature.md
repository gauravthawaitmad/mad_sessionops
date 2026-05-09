# /engineering/plan-feature

Generate an implementation plan for a feature in the current milestone.

## Usage

```
/engineering/plan-feature workdocs/{feature-name}
/engineering/plan-feature "F-M2-3 Sections CRUD"
```

## Process

### 1. Pre-Check (mandatory)

Before generating any plan:

- Read `docs/MILESTONE.md` to confirm the feature is in scope for the current milestone
- Read the milestone's detailed doc (`docs/milestones/MX.md`) for full requirements
- Read `docs/ARCHITECTURE.md` for system context
- Read `docs/BUSINESS_RULES.md` for relevant rules
- Read `docs/GLOSSARY.md` for domain terms

If the feature doesn't have a milestone doc entry, STOP and ask the human to scope it first.

### 2. Blast Radius Analysis

Identify all surfaces this feature touches:

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | New/Modified | Which models change |
| Backend services | New/Modified | Which services |
| Backend API endpoints | New/Modified | Which routes |
| Frontend pages | New/Modified | Which routes |
| Frontend components | New/Modified | Which components |
| Database migrations | Yes/No | Schema changes |
| Celery tasks | Yes/No | Async work |
| Existing tests | Break/Update | Which test files |
| Documentation | Update needed | Which docs |

### 3. Plan Structure

Generate the plan with these sections:

```markdown
# Feature Plan: {feature-id} — {name}

## Overview
One paragraph: what we're building and why.

## Blast Radius
[Table from step 2]

## High-Level Design (HLD)
- Data flow diagram (prose)
- Key architectural decisions
- Integration points with existing code

## Low-Level Design (LLD)

### Backend
- Models to create/modify (with fields)
- Schemas (request/response)
- Service methods (signatures + business rules enforced)
- API endpoints (method, path, auth, response)
- Migrations needed

### Frontend
- Pages/routes to create/modify
- Components needed (new vs reuse)
- API integration (which endpoints called where)
- State management (Redux slices, local state)
- Form validation (Zod schemas)

## Business Rules Enforced
List every rule from BUSINESS_RULES.md that this feature must respect.

## Security Review
- Auth requirements per endpoint
- RBAC scope filtering
- Input validation boundaries
- Data exposure risks

## Testing Strategy
- Backend unit tests (service layer)
- Backend integration tests (API layer)
- Frontend component tests
- Manual verification steps

## Milestones (implementation order)
Break into 2-4 shippable chunks. Each chunk should leave the system in a working state.

## Open Questions
Anything that needs human decision before implementation.
```

### 4. Save Output

Save to: `docs/milestones/plans/{feature-id}-plan.md`

If the directory doesn't exist, create it.

## Rules

- Do NOT start implementation. This command is planning only.
- Do NOT guess at business rules. If a rule isn't documented, flag it as an open question.
- Do NOT over-engineer. Plan the minimum viable implementation that satisfies the milestone doc's requirements.
- Every endpoint MUST have RBAC specified.
- Every model change MUST note the migration strategy.
