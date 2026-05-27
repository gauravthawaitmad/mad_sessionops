# F-M3-3 Execution Progress

## Chunk 1 — Schema + Migration

- [x] Add `User.worknode_id` field to `models/user.py`
- [x] Create `models/partner_worknode.py`
- [x] Register both in `models/__init__.py`
- [x] Run migration (Migration A — 0013_m3_user_worknode_partner_worknode)
- [x] Verify migration is clean

## Chunk 2 — Sync extension

- [x] Add `fetch_chapter_mapping()` to `services/hasura/client.py`
- [x] Extend `_build_user_obj()` with `worknode_id` in `sync.py`
- [x] Update `_USER_UPDATE_FIELDS` to include `worknode_id`
- [x] Add `_run_partner_worknode_phase()` to `sync.py`
- [x] Wire `_run_partner_worknode_phase()` into `run_sync()`
- [x] Write sync tests (`tests/test_worknode_sync.py`) — 8/8 pass
- [x] Lint passes on new files

## Chunk 3 — Service + Endpoint

- [x] Create `services/volunteers/__init__.py` + `list.py`
- [x] Create `schemas/volunteers.py`
- [x] Create `api/volunteers_api.py`
- [x] Register volunteers router in `routes.py`
- [x] Write volunteer list tests (`tests/test_f_m3_3_volunteers.py`) — 9/9 pass

## Chunk 4 — Frontend

- [x] Create `lib/api/services/volunteers.service.ts`
- [x] Build `VolunteerCard.tsx`
- [x] Rebuild `VolunteerListTab.tsx` (replace placeholder)
- [x] Run `npm run test` — 20/20 pass

## Deviations from plan

- `User` model has no `removed` field (uses `is_active` + `deleted_at` only) → filter `is_active=True` without `removed=False`
- `SlotClassSectionVolunteer` doesn't exist until F-M3-7 → `active_slot_class_count` returns 0 for now; updated in F-M3-7

## Blockers
- None yet
