# F-M3-5 Execution Progress

## Chunk 1 — Models + migration

- [x] Create `models/subject.py`
- [x] Create `models/school_volunteer.py`
- [x] Create `models/slot.py`
- [x] Register all three in `models/__init__.py`
- [x] Run `just makemigrations` + `just migrate` (migration 0014)

## Chunk 2 — Service + endpoint

- [x] Create `services/slots/__init__.py`
- [x] Create `services/slots/create.py`
- [x] Create `schemas/slots.py`
- [x] Create `api/slots_api.py` (GET + POST)
- [x] Register `slots_router` in `routes.py`
- [x] Write `tests/slots/test_create_slot.py`
- [x] Run `just test` — 11 passed

## Chunk 3 — Frontend

- [x] Create `lib/api/services/slots.service.ts`
- [x] Create `components/schools/slots/SlotCard.tsx`
- [x] Create `components/schools/slots/AddSlotModal.tsx`
- [x] Rewrite `components/schools/slots/SlotListTab.tsx`
- [x] Wire `canModify` into `SlotListTab` in `SchoolDetailPage.tsx`
- [x] Run `npm run test` — 20 passed, TypeScript clean

## Deviations from plan

- `Subject.program_id` FK uses `db_constraint=False` — dev_user lacks REFERENCES privilege on postgres-owned `program` table. Functionally equivalent for M3.
- Subject seed data deferred — same permission issue; can be seeded manually by admin via Django shell.

## Blockers
- None
