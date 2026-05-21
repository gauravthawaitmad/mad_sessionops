# Feature Plan: F-M3-9 — Schedule View

## Overview

A read-only endpoint and page that shows the full weekly schedule for a school — slot by slot, with section, subject, volunteers, and active child count for each slot-class. This is a detail view (not a calendar); day-by-day layout ordered Monday → Sunday. Calendar-style monthly view is M4+.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | All models already exist from F-M3-5/F-M3-7 |
| Backend services | 1 NEW | `services/slot_classes/schedule.py` |
| Backend API endpoints | 1 NEW | `GET /api/schools/{id}/schedule/` |
| Frontend pages | 1 NEW | Schedule page / `ScheduleView.tsx` |
| Frontend components | 1 NEW | `ScheduleView.tsx` (day grid + slot cards) |
| Database migrations | No | — |
| Celery tasks | No | — |
| Existing tests | None | — |
| Documentation | None | — |

## High-Level Design

### Data flow

```
CO/CHO/Admin opens schedule
  → GET /api/schools/{school_id}/schedule/?day_of_week={optional}
  → get_school_schedule(school_id, user, day_of_week=None)
      → can_user_view_school() check
      → Slot.filter(school_id, is_active, removed=False)
          .prefetch_related(
              "slotclasssection_set"
                  → "class_section_id" (section_name)
                  → "class_section_subject_id"
                      → "subject_id" (subject_name)
                  → "slotclasssectionvolunteer_set"
                      → "volunteer_id" (user_display_name, user_role)
          )
      → for each slot-class: count active children via ChildClassSection
      → group by day_of_week, order by start_time within each day
  ← structured schedule dict
```

### Response shape

```json
{
  "school_id": 123,
  "school_name": "Geetanjali Talent School",
  "academic_year": "2026-2027",
  "days": [
    {
      "day_of_week": "monday",
      "slots": [
        {
          "slot_id": 1,
          "slot_name": "Monday Morning",
          "start_time": "11:00",
          "end_time": "12:00",
          "slot_classes": [
            {
              "slot_class_section_id": 5,
              "section_name": "5th - A",
              "subject_name": "Foundation Day 1",
              "volunteers": [
                {"user_id": 10, "user_display_name": "Priya Sharma", "user_role": "Wingman"}
              ],
              "active_children_count": 5
            }
          ]
        }
      ]
    }
  ]
}
```

Days with no slots are included in the response with `"slots": []`.

## Low-Level Design

### Backend — Service

#### `services/slot_classes/schedule.py`

`get_school_schedule(school_id, requesting_user, day_of_week=None) -> dict`

```python
def get_school_schedule(school_id, requesting_user, day_of_week=None):
    if not can_user_view_school(requesting_user, school_id):
        raise PermissionDenied()

    partner = get_object_or_404(Partner, partner_id=school_id, is_active=True, removed=False)
    say = SchoolAcademicYear.objects.filter(
        school_id=school_id, is_active=True, removed=False
    ).first()
    academic_year_label = say.academic_year_label if say else "—"

    slots_qs = Slot.objects.filter(
        school_id=school_id,
        is_active=True,
        removed=False,
    ).prefetch_related(
        Prefetch(
            "slotclasssection_set",
            queryset=SlotClassSection.objects.filter(
                is_active=True, removed=False
            ).select_related(
                "class_section_id",
                "class_section_subject_id__subject_id",
            ).prefetch_related(
                Prefetch(
                    "slotclasssectionvolunteer_set",
                    queryset=SlotClassSectionVolunteer.objects.filter(
                        is_active=True, removed=False
                    ).select_related("volunteer_id"),
                )
            ),
        )
    ).order_by("start_time")

    if day_of_week:
        slots_qs = slots_qs.filter(day_of_week=day_of_week)

    # Group by day
    day_order = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]
    days_map = {d: [] for d in day_order}

    for slot in slots_qs:
        slot_classes = []
        for scs in slot.slotclasssection_set.all():
            active_children_count = ChildClassSection.objects.filter(
                class_section_id=scs.class_section_id,
                is_active=True, removed=False,
            ).count()
            slot_classes.append({
                "slot_class_section_id": scs.slot_class_section_id,
                "section_name": scs.class_section_id.section_name,
                "subject_name": scs.class_section_subject_id.subject_id.subject_name,
                "volunteers": [
                    {
                        "user_id": v.volunteer_id.user_id,
                        "user_display_name": v.volunteer_id.user_display_name,
                        "user_role": v.volunteer_id.user_role,
                    }
                    for v in scs.slotclasssectionvolunteer_set.all()
                ],
                "active_children_count": active_children_count,
            })
        days_map[slot.day_of_week].append({
            "slot_id": slot.slot_id,
            "slot_name": slot.slot_name,
            "start_time": slot.start_time.strftime("%H:%M"),
            "end_time": slot.end_time.strftime("%H:%M"),
            "slot_classes": slot_classes,
        })

    return {
        "school_id": school_id,
        "school_name": partner.partner_name,
        "academic_year": academic_year_label,
        "days": [
            {"day_of_week": d, "slots": days_map[d]}
            for d in (day_order if not day_of_week else [day_of_week])
        ],
    }
```

Note on N+1: `prefetch_related` covers slots → slot-classes → volunteers. The `active_children_count` per slot-class still fires one query each — acceptable for M3 (slot-classes per school are bounded small). If profiling shows it's slow, annotate with `Count` via `prefetch_related` on `ChildClassSection`.

### Backend — Endpoint

**`api/schedule_api.py`** (NEW):

| Method | Path | Auth | RBAC | Query params |
|---|---|---|---|---|
| GET | `/schools/{school_id}/schedule/` | JWT | `can_view_school` | `day_of_week` (optional) |

Returns `ScheduleResponseSchema`. 403 if not in scope.

### Backend — Schema

```python
class ScheduleVolunteerSchema(Schema):
    user_id: int
    user_display_name: str
    user_role: str

class ScheduleSlotClassSchema(Schema):
    slot_class_section_id: int
    section_name: str
    subject_name: str
    volunteers: list[ScheduleVolunteerSchema]
    active_children_count: int

class ScheduleSlotSchema(Schema):
    slot_id: int
    slot_name: str
    start_time: str
    end_time: str
    slot_classes: list[ScheduleSlotClassSchema]

class ScheduleDaySchema(Schema):
    day_of_week: str
    slots: list[ScheduleSlotSchema]

class ScheduleResponseSchema(Schema):
    school_id: int
    school_name: str
    academic_year: str
    days: list[ScheduleDaySchema]
```

### Frontend

**`ScheduleView.tsx`** (NEW page, accessible from school detail or a dedicated route):
- Calls `GET /schools/{schoolId}/schedule/`
- Day-by-day expandable sections, Monday → Sunday
- Each day header shows day name + slot count
- Slots ordered by start_time within the day
- Each slot card shows: name, time range, then expanded slot-classes (section, subject, volunteer names)
- **Desktop**: 7-day grid layout
- **Mobile**: vertically stacked
- **Empty state per day**: "No slots scheduled for {day}"

## Business Rules Enforced

| Rule | Enforcement |
|---|---|
| R13 — Scope filtering | `can_user_view_school()` before any data access |

## Security Review

- Read-only endpoint — no write surface
- Scoped to user's visible schools via `can_user_view_school()`
- Response contains volunteer names and roles — acceptable (CO, CHO, Admin all have visibility to this data within scope)

## Testing Strategy

**Backend unit tests** (`tests/schedule/test_schedule_view.py`):
- `test_schedule_view_returns_full_structure`
- `test_schedule_view_groups_by_day`
- `test_schedule_view_orders_slots_by_start_time`
- `test_schedule_view_includes_volunteers`
- `test_schedule_view_includes_active_children_count`
- `test_cho_can_view_schedule_for_assigned_school`
- `test_co_cannot_view_other_school_schedule`
- `test_schedule_view_no_n_plus_one_queries`

For the N+1 test: use `django.test.utils.override_settings` with `DEBUG=True` and `django.db.connection.queries` to assert query count stays within a fixed bound regardless of slot/slot-class count.

**Manual verification:**
- [ ] School with 3 slots across 2 days → grouped correctly
- [ ] Slot with 2 slot-classes (2 sections) → both shown under the slot
- [ ] Slot-class with 2 volunteers → both names displayed
- [ ] Day with no slots → empty state message shown
- [ ] CHO opens schedule for their assigned school → sees data

## Implementation Order

**Chunk 1 — Service + endpoint:**
1. Write `services/slot_classes/schedule.py`
2. Write `api/schedule_api.py`
3. Write `test_schedule_view.py`

**Chunk 2 — Frontend:**
1. Build `ScheduleView.tsx`
2. Wire into school detail navigation

**Dependency:** F-M3-7 must be complete (SlotClassSection, SlotClassSectionVolunteer models and data).

## Open Questions

None. All resolved.
