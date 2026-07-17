# Feature Plan: F-M3-8 — Schedule Validation

## Overview

F-M3-8 is not a user-facing flow. It is the integration test suite that verifies all five scheduling business rules (R3, R4, R5, R6, R7) are enforced correctly and return the exact error messages specified in the contract. No new code is written — the rules are already implemented inline in F-M3-5, F-M3-6, and F-M3-7 services. This feature is a dedicated test pass to confirm cross-rule correctness.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | — |
| Backend services | None | Rules already in F-M3-5/F-M3-6/F-M3-7 |
| Backend API endpoints | None | — |
| Frontend pages | None | — |
| Frontend components | None | — |
| Database migrations | No | — |
| Celery tasks | No | — |
| Existing tests | None | New dedicated integration test file |
| Documentation | None | — |

## Rules Under Test

| Rule | Where enforced | Service |
|---|---|---|
| R3 — Vol1 ≠ Vol2 | Slot-class create / edit | `slot_classes/create.py`, `edit.py` |
| R4 — Volunteer at exactly one school | Slot-class create / volunteer edit | `slot_classes/create.py`, `edit.py` |
| R5 — Section not twice in same slot | Slot-class create / edit | `slot_classes/create.py`, `edit.py` |
| R6 — Volunteer not in two slot-classes in same slot | Slot-class create / volunteer edit | `slot_classes/create.py`, `edit.py` |
| R7 — No overlapping slots same school same day | Slot create / edit | `slots/create.py`, `edit.py` |

## Error Message Contract

All rules return `409 ConflictError` (or `400 ValidationError` for R3) with these exact messages:

| Rule | HTTP | Message |
|---|---|---|
| R3 | 400 | `"Vol1 and Vol2 cannot be the same volunteer"` |
| R4 | 409 | `"{name} is already at school '{other_school}'. Remove them from there first."` |
| R5 | 409 | `"Section {name} is already scheduled in this slot"` |
| R6 | 409 | `"{Volunteer name} is already teaching another section in this slot"` |
| R7 | 409 | `"This time overlaps with existing slot '{name}' ({start_time}–{end_time})."` |

Tests must assert the exact message string, not just the status code.

## Low-Level Design

### Test file: `tests/schedule/test_schedule_validation.py`

Integration tests — use the full API stack (real DB, JWT auth).

```python
def test_r3_vol1_eq_vol2_blocked():
    # Create slot, POST slot-class with volunteer_1_id == volunteer_2_id
    # Assert 400, message contains "Vol1 and Vol2 cannot be the same volunteer"

def test_r4_volunteer_at_other_school_blocked_with_school_name_in_message():
    # Create SchoolVolunteer for vol at school_A
    # POST slot-class at school_B with that volunteer
    # Assert 409, message contains school_A's name

def test_r5_duplicate_section_in_slot_blocked():
    # Create slot-class with section_A in slot_X at school
    # POST another slot-class with section_A in same slot_X
    # Assert 409, message contains section name

def test_r6_volunteer_double_booked_in_slot_blocked():
    # Create slot-class in slot_X with volunteer_A
    # POST another slot-class in same slot_X with volunteer_A
    # Assert 409, message contains volunteer name

def test_r7_overlapping_slots_blocked():
    # Create slot: Monday 10:00-11:00 at school
    # POST slot: Monday 10:30-11:30 at same school
    # Assert 409, message contains first slot's name and time range

def test_error_messages_contain_actionable_details():
    # For each rule, assert the message gives enough info for the CO to resolve the conflict
    # R4: assert school name present
    # R5: assert section name present
    # R6: assert volunteer name present
    # R7: assert conflicting slot name and time range present
```

## Business Rules Enforced

All of R3, R4, R5, R6, R7 — see above.

## Security Review

No new security surfaces. Tests use authenticated requests.

## Testing Strategy

**Integration test file:** `tests/schedule/test_schedule_validation.py`
- All 6 tests above
- Each test sets up the full required state (users, school, class, section, slots, slot-classes) from scratch using test fixtures or factories

**Manual verification:**
- [ ] Each rule triggers the correct error via the API (not just unit-tested at service layer)
- [ ] Error messages match the exact contract strings

## Implementation Order

**Chunk 1 (only chunk):** Write `tests/schedule/test_schedule_validation.py` after all F-M3-5, F-M3-6, F-M3-7 services are complete. All tests must pass green before declaring M3 backend done.

**Dependency:** F-M3-5, F-M3-6, F-M3-7 must be complete.

## Open Questions

None.
