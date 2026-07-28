# Feature Plan: F-M4-9 — Partner Deactivation Cascade

## Pre-check note

`docs/MILESTONE.md` (the central 5-milestone overview) has drifted significantly out of date — it still describes a Celery+webhook Hasura sync design and a "6 features" M4 that predates the milestone renumbering visible in the actual codebase (M6 bucket pivot, M7 Bubble migration, M8a realtime sync business logic — none of which appear in MILESTONE.md at all). The authoritative, current spec for this feature is `docs/milestones/M4.md`, which already contains the full F-M4-9 feature entry (added in this session): trigger condition, cascade order across 14 tables, service code, integration point, acceptance criteria, and test case list. This plan expands that entry into an implementation-ready LLD. Flagging the MILESTONE.md drift as a documentation debt item, not a blocker — it's out of scope to fix here.

## Overview

Today, partner deactivation in Session-Ops is field-only: `bulk_upsert_partners` sets `Partner.is_active = not crm_partner_removed` on every Hasura sync (F-M1-2), and nothing downstream reacts to it. A school that becomes inactive in the CRM leaves every slot, volunteer, class, and child underneath it sitting `is_active=True` forever — stale operational data with no way to know the school is gone.

F-M4-9 adds a second, independent trigger condition (`crm_partner_removed=false AND converted=false`, evaluated against a partner that was previously active) and a real cascade: when it fires, the school's entire operational footprint — 13 downstream tables plus the Partner row itself — is soft-deactivated in one transaction. This closes the gap between "CRM says this school is gone" and "Session-Ops still shows it as fully staffed and scheduled."

---

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None (no schema change) | All 14 tables already have `is_active`/`removed`/`deleted_at` (or `is_active`/`deleted_at` for Partner). `ChildRemovalLog.removed_reason="other"` is an existing enum value. |
| Backend services | New + Modified | New: `services/sync/partner_deactivation.py::cascade_deactivate_school`. Modified: `services/sync/upsert.py::bulk_upsert_partners` (adds the trigger check + call). |
| Backend API endpoints | None | No new endpoints. Cascade fires internally from the existing partner-sync code path; no request/response shape changes. |
| Frontend pages | None (required) | Optional: admin sync dashboard (F-M4-4) could surface cascade counts on a SyncRun's detail view — see Open Questions. Not required for this feature to function. |
| Frontend components | None | — |
| Database migrations | None | No new fields, no new models. |
| Celery tasks | N/A | Confirmed: the real sync code (`services/sync/trigger.py`, `services/sync/incremental.py`) uses cron + a daemon thread, not Celery, despite `ARCHITECTURE.md`'s stale description of a Celery-based Hasura webhook pipeline. This feature follows the actual code, not that doc. |
| Existing tests | Update + Add | `tests/sync/test_trigger.py` and `tests/sync/test_incremental_sync.py` exercise `_execute_partner_sync` / `_sync_partners`, which now indirectly call the cascade — check no existing fixture accidentally has `is_active=True, crm_partner_removed=false, converted=false` (would silently start cascading in an existing test and break its assertions). New: `tests/sync/test_partner_deactivation_cascade.py`. |
| Documentation | Update needed | `docs/BUSINESS_RULES.md` — this is a new non-negotiable business rule (R17), not just a feature; add it per `CLAUDE.md`'s "Adding a business rule → update BUSINESS_RULES.md" convention. `docs/milestones/M4.md` — already updated in this session. |

---

## High-Level Design (HLD)

**Data flow:**

```
Hasura partner_data row
        │
        ▼
bulk_upsert_partners(batch_rows, now)      [services/sync/upsert.py]
        │
        ├─ 1. snapshot: which partner_ids in this batch are currently is_active=True?
        │        (MUST happen before the write below overwrites is_active)
        │
        ├─ 2. existing behavior, unchanged: Partner.all_objects.bulk_create(
        │        update_conflicts=True, ...)   → is_active = not crm_partner_removed
        │
        └─ 3. NEW: for each row in batch_rows —
                 if partner_id was previously active
                 AND crm_partner_removed == False
                 AND converted == False:
                     cascade_deactivate_school(partner_id, now)
                             │
                             ▼
                 [services/sync/partner_deactivation.py]
                 one transaction.atomic():
                   Step 1 — assignment layer (6 tables, bulk .update())
                   Step 2 — children (ChildRemovalLog + Child, per active child)
                   Step 3 — structural layer (6 tables, bulk .update())
                   Step 4 — Partner.is_active = False
```

**Key architectural decisions:**

1. **Single choke point, not two.** Both live sync entry points — `services/sync/incremental.py::_sync_partners` (cron) and `services/sync/trigger.py::_execute_partner_sync` (manual "Sync now") — already call the same `bulk_upsert_partners`. Hooking the cascade into that one function means neither caller changes at all, and the two paths can never drift out of sync with each other.
2. **Snapshot-before-write.** The "was this partner previously active" check must run *before* `bulk_create(update_conflicts=True, ...)` executes, because that call overwrites `is_active` in the same statement. This is why the plan reads `previously_active_ids` before the try block, not inside it.
3. **Idempotent by construction.** Every cascade query filters `is_active=True, removed=False` (or `is_active=True` for Partner, which has no `removed` field). A second sync run against an already-cascaded school finds nothing to touch — no special-casing needed to prevent double-processing.
4. **New-partner exclusion is automatic, not a special case.** A partner never seen before isn't in `previously_active_ids` (there's no prior row at all), so the condition naturally never fires for first-time inserts. No explicit "is this an insert or update" branch needed.
5. **No signals, no Celery.** Follows the existing repo pattern (`services/realtime_sync/flows/cascade.py::_cascade_remove_user_from_school`, `services/children/deactivate.py::deactivate_child`) — plain service functions, bulk `.update()` calls, wrapped in `transaction.atomic()`, called synchronously in the request/sync path.

**Integration points:**

- `services/sync/upsert.py::bulk_upsert_partners` — extended (see LLD).
- `services/sync/partner_deactivation.py` — new module, imported by `upsert.py`.
- No changes needed in `incremental.py` or `trigger.py` themselves.

---

## Low-Level Design (LLD)

### Backend

#### Models to create/modify

None. All fields already exist:

| Table | Fields used (all pre-existing) |
|---|---|
| `SlotClassSectionVolunteer`, `SlotClassSection`, `Slot`, `ClassSectionSubject`, `SchoolVolunteer`, `ChildClassSection`, `ChildClass`, `ClassSection`, `SchoolClass`, `SchoolAcademicYear`, `SchoolSessionDetails`, `SchoolHoliday` | `is_active`, `removed`, `deleted_at` |
| `Child` | `is_active`, `removed`, `deleted_at` |
| `ChildRemovalLog` | `child_id` (FK), `co_id` (BigIntegerField, **mandatory, no default** — see Open Questions), `school_id`, `removed_reason` (choices incl. `"other"`), `other_details`, `removed_datetime` |
| `Partner` | `is_active`, `deleted_at` (inherits `SoftDeleteBaseModel` — no `removed` field on Partner) |

#### Schemas

None. This is a pure backend-internal service; no Pydantic request/response schemas change.

#### Service methods

**`services/sync/partner_deactivation.py::cascade_deactivate_school(school_id: int, now: datetime | None = None) -> dict[str, int]` (NEW)**

```python
from django.db import transaction
from django.utils import timezone

from sessionops.models import (
    Child, ChildClass, ChildClassSection, ChildRemovalLog, ClassSection,
    ClassSectionSubject, Partner, SchoolAcademicYear, SchoolClass,
    SchoolHoliday, SchoolSessionDetails, SchoolVolunteer, Slot,
    SlotClassSection, SlotClassSectionVolunteer,
)

# See Open Question #1 — must be resolved before this ships.
SYSTEM_SYNC_CO_ID = None


def cascade_deactivate_school(school_id: int, now=None) -> dict:
    """
    Cascade-deactivate every active operational record under school_id.
    Idempotent: every filter excludes already-inactive rows, so calling
    this twice against the same school is a no-op the second time.
    """
    now = now or timezone.now()
    counts: dict[str, int] = {}

    with transaction.atomic():
        Partner.all_objects.select_for_update().filter(partner_id=school_id).first()

        counts["slot_class_section_volunteer"] = SlotClassSectionVolunteer.objects.filter(
            slot_class_section_id__slot_id__school_id=school_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now)

        counts["slot_class_section"] = SlotClassSection.objects.filter(
            slot_id__school_id=school_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now)

        counts["slot"] = Slot.objects.filter(
            school_id=school_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now)

        counts["class_section_subject"] = ClassSectionSubject.objects.filter(
            class_section_id__school_id=school_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now)

        counts["school_volunteer"] = SchoolVolunteer.objects.filter(
            school_id=school_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now)

        counts["child_class_section"] = ChildClassSection.objects.filter(
            child_id__school_id=school_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now)

        active_child_ids = list(
            Child.objects.filter(school_id=school_id, is_active=True, removed=False)
            .values_list("child_id", flat=True)
        )
        ChildRemovalLog.objects.bulk_create(
            ChildRemovalLog(
                child_id_id=child_id,
                co_id=SYSTEM_SYNC_CO_ID,
                school_id=school_id,
                removed_reason="other",
                other_details="School dropped from CRM",
                removed_datetime=now,
            )
            for child_id in active_child_ids
        )
        counts["child_removal_log"] = len(active_child_ids)
        counts["child"] = Child.objects.filter(child_id__in=active_child_ids).update(
            is_active=False, removed=True, deleted_at=now
        )

        counts["child_class"] = ChildClass.objects.filter(
            child_id__school_id=school_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now)

        counts["class_section"] = ClassSection.objects.filter(
            school_id=school_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now)

        counts["school_class"] = SchoolClass.objects.filter(
            school_id=school_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now)

        counts["school_academic_year"] = SchoolAcademicYear.objects.filter(
            school_id=school_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now)

        counts["school_session_details"] = SchoolSessionDetails.objects.filter(
            school_id=school_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now)

        counts["school_holiday"] = SchoolHoliday.objects.filter(
            school_id=school_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now)

        Partner.all_objects.filter(partner_id=school_id).update(is_active=False, deleted_at=now)

    return counts
```

**`services/sync/upsert.py::bulk_upsert_partners` (MODIFIED)** — same signature and return type as today (`tuple[int, int]`); callers need no changes.

```python
def bulk_upsert_partners(batch_rows: list[dict], now: datetime) -> tuple[int, int]:
    objects = [obj for row in batch_rows if (obj := build_partner_obj(row, now))]
    if not objects:
        return 0, 0

    batch_ids = [o.partner_id for o in objects]
    existing_ids = set(
        Partner.all_objects.filter(partner_id__in=batch_ids).values_list("partner_id", flat=True)
    )
    # F-M4-9: snapshot BEFORE bulk_create overwrites is_active below.
    previously_active_ids = set(
        Partner.all_objects.filter(partner_id__in=batch_ids, is_active=True)
        .values_list("partner_id", flat=True)
    )

    for attempt in range(2):
        try:
            Partner.all_objects.bulk_create(
                objects,
                update_conflicts=True,
                update_fields=PARTNER_UPDATE_FIELDS,
                unique_fields=["partner_id"],
            )
            created = sum(1 for o in objects if o.partner_id not in existing_ids)
            updated = len(objects) - created

            for row in batch_rows:
                partner_id = to_int(row.get("partner_id"))
                if partner_id is None or partner_id not in previously_active_ids:
                    continue
                crm_removed = bool(row.get("crm_partner_removed", False))
                converted = bool(row.get("converted", False))
                if not crm_removed and not converted:
                    cascade_deactivate_school(partner_id, now)

            return created, updated
        except OperationalError:
            if attempt == 0:
                logger.warning("bulk_upsert_partners: connection lost, reconnecting...")
                close_old_connections()
                time.sleep(2)
            else:
                raise
    return 0, 0
```

Add `from sessionops.services.sync.partner_deactivation import cascade_deactivate_school` to `upsert.py`'s imports. No circular-import risk: `partner_deactivation.py` only imports models, never `upsert.py`.

#### API endpoints

None new, none modified. `POST /api/admin/sync/trigger/` (F-M4-7) and the cron entry point (`manage.py sync_hasura`) are unchanged at the interface level — the cascade is invisible to their callers except through its side effects on the DB.

#### Migrations

None required.

---

### Frontend

None required for this feature to function correctly — the cascade is a pure backend sync-time side effect with no new user-facing surface.

**Optional (not required, flagged as Open Question #3):** the existing sync admin dashboard (F-M4-4, `GET /api/admin/sync/runs/{id}/`) could show cascade counts on a SyncRun's detail panel so admins can see "this run deactivated school X's records" without grepping logs. If added later, it would need a small backend addition (aggregate `cascade_deactivate_school`'s returned counts per run and attach to `SyncRun`) — deferred, not in this plan's scope.

---

## Business Rules Enforced

- **R9 (no hard deletes)** — every write in the cascade is `is_active=False` + `removed=True` (or `is_active=False` alone for Partner, which has no `removed` field) + `deleted_at`. No `DELETE` statement anywhere.
- **R10 (removal reason mandatory when deactivating a child)** — satisfied by always writing `removed_reason="other"`, `other_details="School dropped from CRM"` before flipping `Child.is_active=False`. There's no human operator to ask for a more specific reason, so `"other"` + a fixed, descriptive `other_details` string is the correct application of R10 in an automated context.
- **R16 (Hasura sync events are idempotent)** — every cascade query filters on `is_active=True, removed=False`, so re-running the same sync payload against an already-cascaded school produces zero additional writes.
- **New rule (proposed R17, to be added to `BUSINESS_RULES.md`):** "A school that reports `crm_partner_removed=false AND converted=false` in a sync while previously active in Session-Ops has its entire operational footprint cascade-deactivated (slots, volunteers, children with removal log, classes, academic year, session, holidays), and the Partner row itself is deactivated. This is independent of and takes priority over the `crm_partner_removed`-only flag flip (F-M1-2)." Rationale to include: without this, a school dropped from the CRM's active pipeline (but not formally "removed") leaves fully-staffed, fully-scheduled ghost data in Session-Ops indefinitely.

---

## Security Review

- **Auth requirements:** N/A at the endpoint level — no new endpoints. The two call sites that trigger this indirectly (`POST /api/admin/sync/trigger/`, the cron command) already enforce admin-only / server-only access; unchanged by this feature.
- **RBAC scope filtering:** N/A — this runs inside the sync pipeline itself, not behind a user-scoped query. There is no per-user data exposure surface here.
- **Input validation boundaries:** The only "input" is the Hasura partner payload, already parsed by `build_partner_obj`/`to_int`/etc. `cascade_deactivate_school` takes a plain `int school_id` — all queries are parameterized Django ORM filters, no raw SQL, no injection surface.
- **Data exposure risk:** None — no new read paths, no new response payloads.
- **Blast-radius / data-loss risk (the actual risk here):** This is a *destructive* feature by design — a single sync row can deactivate hundreds of records across 14 tables for one school with no per-record confirmation. Mitigations already in the design: (a) idempotent filters prevent runaway re-application, (b) single `transaction.atomic()` means a mid-cascade failure rolls back cleanly rather than leaving a half-cascaded school, (c) the trigger condition is narrow (`removed=false AND converted=false AND previously active` — not simply "any change"). Recommended before shipping: structured logging at cascade-start and cascade-end with the full `counts` dict (matching the existing `logger.info("%s DONE ... created=%d updated=%d", tag, ...)` pattern already used in `trigger.py`/`incremental.py`), so a wrongly-triggered cascade is diagnosable from logs even without a persisted audit field (see Open Question #4 on whether a persisted audit trail is worth a migration).

---

## Testing Strategy

### Backend unit tests — `tests/sync/test_partner_deactivation_cascade.py` (NEW)

Structural precedent: `tests/sync/test_cascade_flows.py` (F-M8a-4's worknode cascade tests) — follow its fixture-building style (build the full FK chain down to the leaf table, assert soft-delete flags after the call).

```python
# cascade_deactivate_school() direct unit tests
def test_cascade_deactivates_all_active_slot_class_section_volunteers()
def test_cascade_deactivates_all_active_slot_class_sections()
def test_cascade_deactivates_all_active_slots()
def test_cascade_deactivates_all_active_class_section_subjects()
def test_cascade_deactivates_all_active_school_volunteers()
def test_cascade_deactivates_all_active_child_class_sections()
def test_cascade_creates_removal_log_per_active_child_with_reason_other_and_fixed_details()
def test_cascade_deactivates_all_active_children()
def test_cascade_deactivates_all_active_child_classes()
def test_cascade_deactivates_all_active_class_sections()
def test_cascade_deactivates_all_active_school_classes()
def test_cascade_deactivates_all_active_school_academic_years()
def test_cascade_deactivates_all_active_school_session_details()
def test_cascade_deactivates_all_active_school_holidays_including_future_dated()
def test_cascade_sets_partner_is_active_false()
def test_cascade_does_not_touch_records_at_a_different_school_id()
def test_cascade_is_a_noop_when_rerun_against_an_already_cascaded_school()
def test_cascade_returns_accurate_counts_dict()
def test_cascade_rolls_back_all_steps_if_one_step_raises()  # e.g. mock a mid-cascade DB error
```

### Backend integration tests — extend `test_trigger.py` / `test_incremental_sync.py` (or a shared fixture module)

```python
def test_bulk_upsert_partners_triggers_cascade_when_removed_false_converted_false_and_previously_active()
def test_bulk_upsert_partners_skips_cascade_when_partner_already_inactive()
def test_bulk_upsert_partners_skips_cascade_for_brand_new_partner_first_sync()
def test_bulk_upsert_partners_skips_cascade_when_converted_true()
def test_bulk_upsert_partners_skips_cascade_when_crm_partner_removed_true()
def test_manual_trigger_sync_fires_cascade_same_as_cron_incremental_sync()  # same bulk_upsert_partners, both paths
```

**Regression check (required, not optional):** audit existing partner fixtures in `test_trigger.py` and `test_incremental_sync.py` for any that already have `is_active=True` with `crm_partner_removed=False, converted=False` — those would start cascading once this ships and could silently break unrelated assertions in those files.

### Frontend component tests

None — no frontend surface changes in this plan.

### Manual verification steps

1. In a dev/staging DB, pick a real (non-production) school with active slots, volunteers, and children. Manually flip its Hasura-side (or local test-fixture) `converted` to `false` while `crm_partner_removed` stays `false`.
2. Run `manage.py sync_hasura` (or trigger via the admin "Sync now" button).
3. Confirm: all listed tables show zero active rows for that school; each previously-active child has a `ChildRemovalLog` row with `removed_reason="other"`; `Partner.is_active=False`.
4. Re-run the same sync a second time — confirm no errors and no duplicate `ChildRemovalLog` rows (idempotency check).
5. Confirm records for a *different*, untouched school are unaffected.

---

## Milestones (implementation order)

**Chunk 1 — Cascade service, standalone and tested**
Write `services/sync/partner_deactivation.py::cascade_deactivate_school` and its full unit test suite. Resolve Open Question #1 (`SYSTEM_SYNC_CO_ID`) before writing the `ChildRemovalLog` test, since it's a mandatory field. System is unaffected in production at this point — the function exists but isn't called from anywhere yet.

**Chunk 2 — Wire into the sync path**
Extend `bulk_upsert_partners` with the snapshot + trigger check + call. Add the integration tests. Run the full existing `tests/sync/` suite and fix any fixture collisions found in the regression check above. System is now live — this is the chunk that actually changes production behavior.

**Chunk 3 — Business rule documentation + audit logging**
Add proposed R17 to `docs/BUSINESS_RULES.md`. Add structured `logger.info`/`logger.warning` calls around the cascade call site in `bulk_upsert_partners`, matching the existing `tag`-based logging style in `trigger.py`/`incremental.py`, so a fired cascade is visible in sync logs.

**Chunk 4 (optional, defer if time-constrained) — Dashboard visibility**
If Open Question #3 is resolved in favor of surfacing this, add cascade counts to the SyncRun detail view on the existing admin sync dashboard (F-M4-4). Genuinely optional — the feature is complete and correct without it.

---

## Open Questions

1. **`ChildRemovalLog.co_id` system actor — blocking.** This is a mandatory `BigIntegerField` with no null option, and there's no human operator to attribute a sync-triggered child removal to. `docs/milestones/M4.md`'s open-questions section already flags this, referencing the M7 migration's precedent of using a real existing `user_id` (not an invented bot user — see memory `project_m7_spec`, which used real user `1924616`). Need a decision: reuse that same user_id, or designate a different one specifically for sync-triggered system writes. **Must be resolved before Chunk 1's `ChildRemovalLog` tests can be written correctly.**
ans - use this user_id = 485003

2. **Reactivation semantics.** Confirmed out of scope for M4 (no auto-restore if the partner's CRM state later reverts to `converted=true`). Worth a product decision for a future milestone: does anyone need a bulk "undo cascade" tool, or is manual re-creation acceptable indefinitely if a school comes back?
ans - no bulk undo is going to happen

3. **Dashboard visibility (Chunk 4).** Should the admin sync dashboard (F-M4-4) surface "N records cascade-deactivated" on a SyncRun's detail view, or is application-log visibility sufficient for M4? Recommend deferring unless an admin explicitly needs this before M4 ships.
ans - No need to do that for now later we will create notification trigger on this part

4. **Persisted audit trail vs. logs only.** Given the destructive blast radius, is structured logging (Chunk 3) sufficient, or does product want a queryable record of which `partner_id`s were cascaded and when (would require a new field on `SyncRun`, e.g. extending its existing `partner_ids` JSONField shape with a `cascaded: true` flag, or a new field — a small migration)? Recommend shipping v1 with logs only per "don't over-engineer," revisit if an incident ever requires reconstructing cascade history after the fact.
ans - sure make sure we are not removing any thing from db just marking inactive

5. **`docs/MILESTONE.md` staleness.** Not blocking this feature, but noting: the central milestone doc no longer reflects the actual milestone structure (M6/M7/M8a are absent, M4's feature list and architecture description — Celery, webhooks — don't match the real implemented code). Recommend a documentation-hygiene pass at some point, separate from this feature.
