# Feature Plan: F-M6-1 — Schema migrations

## Overview

Land the schema primitives the rest of M6 needs before any application code changes. Three structural changes to `class_section` (nullable FK/code, new display-name column, slug-uniqueness constraint) and one data seed (a `Subject` row named "Foundation" that every new bucket-slot-class will reference instead of a user-picked subject). No table is added or dropped, no column is removed, and no existing row is destroyed — every change is additive or relaxes an existing constraint. This is pure schema/data work with zero service or API surface; F-M6-2 through F-M6-5 build on top of it.

Current migration head in this repo is `0023_school_volunteer_nullable_say_and_created_by`. This feature adds `0024` through `0027`.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | Modified | `ClassSection` (`sessionops/models/class_section.py`): `school_class_id` and `section_code` become nullable; new `section_display_name` field; `Meta.constraints` updated |
| Backend services | None | No service code in this feature |
| Backend API endpoints | None | No endpoint code in this feature |
| Frontend pages | None | Out of scope for this feature |
| Frontend components | None | Out of scope for this feature |
| Database migrations | Yes | 4 new migrations: `0024`-`0027` |
| Celery tasks | None | — |
| Existing tests | None expected to break | `ClassSection` and `Subject` are used by M2/M3 code, but none of it requires `school_class_id`/`section_code` to be non-null or requires uniqueness on `(school_id, section_name)` — the pre-flight query below confirms no existing data collides |
| Documentation | Update needed | `docs/milestones/M6.md` F-M6-1 status → Built once merged |

## High-Level Design (HLD)

- **Data flow:** No runtime data flow — this is schema-only. The `Subject` seed is a one-time `get_or_create` executed as a Django data migration (`RunPython`), so it's idempotent and safe to re-run.
- **Key architectural decision:** No DB constraint is added for the future `child_class` one-active-per-child invariant (decision #5 in M6.md) — that's enforced entirely at the service layer in F-M6-4, via `select_for_update()`. This feature does not touch `child_class` at all.
- **Integration points:** `ClassSection` is read/written by M2's section services and M3's slot-class services. Both continue to work unmodified against legacy rows because every change here is either nullable-relaxing or additive. The `class_section_slug_per_school` constraint only applies to `removed=False` rows and only bites on *new* writes with colliding `(school_id, section_name)` — verified empty via the pre-flight query.

## Low-Level Design (LLD)

### Backend

**Models to modify** (`sessionops/models/class_section.py`):

```python
class ClassSection(models.Model):
    class_section_id = models.BigAutoField(primary_key=True)
    school_class_id  = models.ForeignKey(
        "sessionops.SchoolClass", on_delete=models.PROTECT, db_column="school_class_id",
        null=True, blank=True,                              # CHANGED
    )
    school_id        = models.BigIntegerField(db_index=True)
    section_code     = models.CharField(
        max_length=1, choices=[(c, c) for c in SECTION_CODES],
        null=True, blank=True,                              # CHANGED
    )
    section_name     = models.CharField(max_length=100)  # CHANGED: widened from 20
    section_display_name = models.CharField(max_length=255, null=True, blank=True)  # NEW
    is_active        = models.BooleanField(default=True)
    removed          = models.BooleanField(default=False)
    deleted_at       = models.DateTimeField(null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)
    created_by       = models.ForeignKey("sessionops.User", on_delete=models.PROTECT, related_name="+")
    updated_by       = models.ForeignKey("sessionops.User", on_delete=models.PROTECT, null=True, blank=True, related_name="+")

    class Meta:
        db_table = "class_section"
        constraints = [
            models.UniqueConstraint(
                fields=["school_class_id", "section_code"],
                condition=models.Q(removed=False, section_code__isnull=False),   # CHANGED: added section_code__isnull=False
                name="uniq_section_per_school_class",
            ),
            models.UniqueConstraint(                                             # NEW
                fields=["school_id", "section_name"],
                condition=models.Q(removed=False),
                name="class_section_slug_per_school",
            ),
        ]
```

**Decision:** `section_name` widens from `max_length=20` to `max_length=100` as part of `0025` (same migration that adds `section_display_name`, since both are about the slug/display redesign). The current 20-char limit was sized for M2's `"5th - A"`-style names and is too tight for slugs derived from free-text bucket names (e.g. `"Care Monster Group A"` → `care_monster_group_a` is 21 chars, already over the old limit). Widening is a plain `AlterField`, fully backward compatible with legacy rows, and removes the need for F-M6-2 to truncate or reject reasonably-named buckets.

**Migrations** (`sessionops/migrations/`):

| # | Name | Operation |
|---|------|-----------|
| `0024` | `m6_class_section_nullable_fields` | `AlterField` on `school_class_id` (null=True) and `section_code` (null=True); `AlterUniqueTogether`/`AlterConstraint` replacing `uniq_section_per_school_class` with the `section_code__isnull=False` condition |
| `0025` | `m6_section_display_name` | `AddField` `section_display_name`; `RunPython` backfill: `UPDATE class_section SET section_display_name = section_name WHERE section_display_name IS NULL` (forward only — reverse is a no-op since the column is dropped by the reverse migration anyway) |
| `0026` | `m6_section_slug_unique_per_school` | `AddConstraint` `class_section_slug_per_school` — partial unique on `(school_id, section_name)` where `removed=false` |
| `0027` | `m6_seed_foundation_subject` | `RunPython` data migration: reuse the existing seeded `"Foundation Program"` row (created via `db_startup.py`/`seed_m2_catalog.py`, already backing the legacy "Foundation Day 1"/"Foundation Day 2" subjects and hardcoded as `FOUNDATION_PROGRAM_ID = 1` in `services/children/enroll.py`) — `program, _ = Program.objects.get_or_create(program_name="Foundation Program")`, then `Subject.objects.get_or_create(subject_name="Foundation", defaults={"program_id": program})` |

Resolved: no new `Program` row needed. `Subject.program_id` (required, `PROTECT`, not nullable) points at the same `"Foundation Program"` row every other Foundation-related subject already uses.

**Pre-flight query** (run against staging before writing `0026`):

```sql
SELECT school_id, section_name, COUNT(*) FROM class_section
WHERE removed = false
GROUP BY school_id, section_name HAVING COUNT(*) > 1;
```

Must return zero rows. If it doesn't, the colliding rows need manual `section_name` disambiguation before `0026` can apply — this blocks the migration, not something to work around silently.

**Schemas:** None — `sessionops/schemas/structure.py` is F-M6-2's concern.

**Service methods:** None.

**API endpoints:** None.

### Frontend

None — this feature has no frontend surface.

## Business Rules Enforced

- **R-section-slug (NEW, partially):** This feature lands the DB partial unique index that backs slug uniqueness per school. The application-level pre-check and slug derivation are F-M6-2's job — this feature only makes the constraint enforceable at the DB layer as a backstop.
- **R9 (soft-delete only):** Confirmed unaffected — no delete behavior changes.

## Security Review

- No new endpoints, no new user input, no new data exposure. N/A for this feature.

## Testing Strategy

- **Migration tests:** Apply all 4 migrations against a copy of a representative staging dataset (or the dev DB with production-like data volume); confirm each applies without error.
- **Rollback tests:** Reverse each migration in order (`0027` → `0024`) and confirm no data loss beyond the column/constraint being removed (expected).
- **Schema verification:** Query `pg_indexes` and `pg_constraint` after migrating to confirm `class_section_slug_per_school` exists with the correct partial condition, and `uniq_section_per_school_class` has the updated condition.
- **Idempotency test:** Run `0027` twice (or call its `RunPython` function twice in a test) — confirm no duplicate `Subject` row, confirm `Subject.objects.get(subject_name="Foundation")` resolves the same row both times.
- **Regression:** Run the full existing test suite (`just test`) after migrating — nothing in M2/M3 should break since all changes are additive/relaxing.
- **Manual verification:** `just migrate` on a local dev DB seeded with M2/M3 fixture data; confirm the app still boots and existing section/slot-class flows still work end to end.

## Milestones (implementation order)

1. **Chunk 1 — nullable fields + display name (0024, 0025):** Safe, purely additive/relaxing. Ship and verify independently; nothing downstream depends on these yet.
2. **Chunk 2 — slug uniqueness (0026):** Run the pre-flight query first. Only proceed once it returns zero rows.
3. **Chunk 3 — Foundation subject seed (0027):** Needs the `program_id` decision (see Open Questions) before it can be written.

Each chunk leaves the system in a fully working state — none of F-M6-2 through F-M6-5 are unblocked by a partial application, so these can also be applied together as one deploy if preferred.

## Open Questions

None remaining — both items originally flagged here (Foundation `program_id`, `section_name` width) were resolved by inspection of existing code (`services/children/enroll.py`, `management/commands/db_startup.py`) rather than left as guesses. See the LLD section above for the resolutions.
