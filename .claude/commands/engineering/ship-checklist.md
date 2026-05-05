# /engineering/ship-checklist

Pre-merge quality gate. Read-only — does not modify code.

## Usage

```
/engineering/ship-checklist          # check current branch vs main
/engineering/ship-checklist <branch> # check specific branch
```

## Process

### 1. Run Automated Checks

#### Backend (if backend files changed)
```bash
cd mad_sessionops_backend
just lint          # Black + isort + flake8
just test          # pytest with coverage
python manage.py makemigrations --check  # no unapplied model changes
```

#### Frontend (if frontend files changed)
```bash
cd mad_sessionops_frontend
npm run lint       # ESLint + TypeScript
npm run build      # catches type errors missed by lint
npm run test       # Vitest
```

### 2. Manual Scan

Scan the diff (`git diff main...HEAD`) for:

#### Security
- [ ] No hardcoded secrets, API keys, or tokens
- [ ] No `console.log` with sensitive data
- [ ] All new endpoints have auth middleware
- [ ] No SQL injection (raw queries properly parameterized)
- [ ] No XSS vectors (user input rendered without escaping)

#### Architecture
- [ ] Business logic is in services, not views
- [ ] Frontend has no business rule enforcement
- [ ] Views are thin (parse, delegate, respond)
- [ ] Schemas validate input shape
- [ ] Errors use typed exceptions

#### Data Safety
- [ ] No hard deletes
- [ ] Queries filter `is_active=True` by default
- [ ] Migrations are reversible
- [ ] No data loss on rollback

#### Testing
- [ ] New service methods have unit tests
- [ ] RBAC is tested (authorized + unauthorized cases)
- [ ] Edge cases covered (empty list, max capacity, duplicate)

#### Documentation
- [ ] BUSINESS_RULES.md updated if new rules added
- [ ] Milestone doc's done log updated
- [ ] API changes reflected in endpoint docs

### 3. Output Format

```markdown
# Ship Checklist: {branch/feature}

## Automated Checks
| Check | Status | Notes |
|-------|--------|-------|
| Backend lint | PASS/FAIL | {details if fail} |
| Backend tests | PASS/FAIL | {coverage %} |
| Migration check | PASS/FAIL | |
| Frontend lint | PASS/FAIL | |
| Frontend build | PASS/FAIL | |
| Frontend tests | PASS/FAIL | |

## Manual Scan
| Category | Status | Issues |
|----------|--------|--------|
| Security | OK/WARN | {issues} |
| Architecture | OK/WARN | {issues} |
| Data Safety | OK/WARN | {issues} |
| Testing | OK/WARN | {issues} |
| Documentation | OK/WARN | {issues} |

## Verdict
**SHIP IT** / **FIX FIRST** / **NEEDS DISCUSSION**

{If FIX FIRST: list exactly what needs fixing}
{If NEEDS DISCUSSION: what question needs answering}
```

## Rules

- This command is READ-ONLY. Do not fix issues, only report them.
- Be conservative. When in doubt, flag it.
- "SHIP IT" means you'd stake your reputation on this being production-ready.
- "FIX FIRST" means there's a concrete issue that will cause a bug or security hole.
- "NEEDS DISCUSSION" means there's an architectural question without a clear answer.
