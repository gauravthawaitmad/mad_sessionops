# Feature Plan: F-M7-2 — Migration mode validation suppression

**See `F-M7-1-plan.md` — F-M7-2 is planned there, not here.**

F-M7-2 has no independent implementation surface in this codebase. "Migration mode validation suppression" is not a second set of endpoints, a toggle, or a parameter threaded through existing services — it's fully expressed by *how* F-M7-1's loader endpoints are built:

- Loader endpoints bypass the existing business-rule services entirely (`enroll_child`, `create_bucket`/`edit_bucket`, `create_slot_class`, `create_slot`) rather than calling them with an `enforcement_mode='migration'` flag, per the confirmed design in `F-M7-1-plan.md`'s "Key architectural decision" section.
- Because those services are never called, their business-rule checks (R1, R2, R3, R4, R5, R6, R7, R-bucket, R-class, R-bucket-membership) are never evaluated in the first place — there's nothing to suppress, since nothing runs to be suppressed.
- What *is* still enforced, and can't be turned off, is covered in `F-M7-1-plan.md`'s "Business Rules Enforced" section: DB-level NOT NULL/unique/real-FK constraints, and the decision #15 raw-integer `school_id`-style soft-FK check (no DB backstop for that one, so it runs in both modes).
- Auth (the "migration mode" service-token check) is covered in `F-M7-1-plan.md`'s "Auth" and "Security Review" sections (`services/migration/auth.py::validate_migration_token`).

If a future review of `docs/milestones/M7.md` decides F-M7-2 *does* need per-row business-rule warnings (see `F-M7-1-plan.md`'s Open Question #2 — deferred to F-M7-10's post-hoc aggregate checks instead), that work still lands inside F-M7-1's generic upsert engine, not a separate module. This file will get updated in place if that changes; it is not expected to grow into a real plan.
