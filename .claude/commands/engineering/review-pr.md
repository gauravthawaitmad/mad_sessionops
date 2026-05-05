# /engineering/review-pr

Structured code review for a pull request or set of changes.

## Usage

```
/engineering/review-pr              # review current uncommitted changes
/engineering/review-pr <branch>     # review diff against main
/engineering/review-pr <PR-URL>     # review a GitHub PR
```

## Process

### 1. Gather the Diff

- If no argument: `git diff` + `git diff --staged`
- If branch: `git diff main...<branch>`
- If PR URL: use `gh pr diff`

### 2. Read Context

- Backend `CLAUDE.md` and frontend `CLAUDE.md`
- `docs/BUSINESS_RULES.md`
- The relevant milestone doc if identifiable from the changes

### 3. Review by Layer

#### Backend Review (if backend files changed)

Check for:
- **Architecture compliance**: Views thin? Business logic in services? Schemas for validation?
- **RBAC**: Every new endpoint has role guards? Scope filtering applied?
- **Soft delete**: No hard deletes? `is_active` filtering present?
- **Business rules**: Rules from BUSINESS_RULES.md respected?
- **Error handling**: Using typed exceptions? Not bare `except`?
- **Testing**: New service methods have tests? Coverage adequate?
- **Migrations**: Clean? Reversible? Named descriptively?
- **Security**: No secrets in code? No SQL injection? Input validated?

#### Frontend Review (if frontend files changed)

Check for:
- **No business logic**: Only display logic and input validation?
- **Component patterns**: Server vs client components correct? MUI imports from subpaths?
- **State management**: Redux for auth only? No localStorage outside redux-persist?
- **API calls**: All through `lib/api/client.ts`? No raw `fetch()`?
- **Type safety**: Proper TypeScript types? Zod schemas for forms?
- **Error/loading states**: Explicit handling? No conditional null renders?
- **Accessibility**: Proper labels? Keyboard navigable?

### 4. Output Format

```markdown
# PR Review: {description}

## Summary
One paragraph: what this PR does.

## Blocking Issues
Issues that MUST be fixed before merge:
- [ ] {issue}: {explanation} ({file}:{line})

## Suggestions
Non-blocking improvements worth considering:
- {suggestion} ({file}:{line})

## Nitpicks
Style/preference (ignore if you disagree):
- {nitpick}

## What's Done Well
- {positive observation}

## Checklist
- [ ] RBAC on all new endpoints
- [ ] Business rules enforced in services
- [ ] Tests cover new logic
- [ ] No hardcoded secrets
- [ ] Docs updated if behavior changed
- [ ] Migrations named and reversible
- [ ] No console.log / print statements in production code
```

## Rules

- Be specific. "This is wrong" is not useful. "Line 42 in schools_api.py bypasses RBAC scope filtering" is.
- Blocking issues are things that will cause bugs or security holes in production.
- Suggestions are things that improve maintainability but won't break anything if skipped.
- Don't bikeshed. If it works and follows conventions, it's fine.
