# /engineering/execute-plan

Implement a feature using its planning documents.

## Usage

```
/engineering/execute-plan docs/milestones/plans/{feature-id}-plan.md
/engineering/execute-plan "F-M2-3"
```

## Process

### 1. Load Context

Read in this order:
1. The plan file (`docs/milestones/plans/{feature-id}-plan.md`)
2. Backend `CLAUDE.md` and frontend `CLAUDE.md`
3. `docs/BUSINESS_RULES.md`
4. Any existing code files the plan references

If the plan doesn't exist, STOP and tell the human to run `/engineering/plan-feature` first.

### 2. Create Task Tracker

Create `docs/milestones/plans/{feature-id}-tasks.md` to track progress:

```markdown
# {feature-id} Execution Progress

## Milestone 1: {name}
- [ ] Step description
- [ ] Step description

## Milestone 2: {name}
- [ ] Step description

## Blockers
- None yet
```

### 3. Execute (per milestone in the plan)

For each milestone chunk:

1. **Backend first** — Models, migrations, services, API endpoints, tests
2. **Frontend second** — Pages, components, API integration, validation
3. **Validate** — Run tests, check lint, verify manually

#### Backend execution order:
1. Models (create/modify) + migrations
2. Schemas (Pydantic v2)
3. Services (business logic + unit tests)
4. API endpoints (thin routers + integration tests)
5. Run: `just test` and `just lint`

#### Frontend execution order:
1. API functions (`lib/api/`)
2. Types/schemas (Zod)
3. Components
4. Pages/routes
5. Run: `npm run lint` and `npm run test`

### 4. Validation Checks

Before marking complete:

- [ ] All new endpoints have RBAC guards
- [ ] All business rules from the plan are enforced in services
- [ ] All queries filter `is_active=True` by default
- [ ] No business logic leaked into views or frontend
- [ ] Tests pass: `just test` (backend) and `npm run test` (frontend)
- [ ] Lint passes: `just lint` (backend) and `npm run lint` (frontend)
- [ ] Migrations are clean: `just makemigrations sessionops --check`
- [ ] No hardcoded secrets or console.log statements
- [ ] Relevant docs updated (DATA_MODEL.md, API_CONVENTIONS.md, etc.)

### 5. Update Task Tracker

Mark completed items, note any deviations from the plan, document blockers.

## Rules

- Follow the plan's implementation order. Don't skip ahead.
- If you discover the plan is wrong or incomplete, STOP and flag to the human. Don't silently deviate.
- Commit after each milestone chunk, not at the end.
- Tests are not optional. Every service method gets a test.
- Use the `justfile` commands — don't run raw pytest/manage.py unless debugging.
