# F-M3-6 Execution Progress

## Chunk 1 — Services + endpoints

- [x] Create `services/slots/edit.py`
- [x] Create `services/slots/delete.py`
- [x] Update `schemas/slots.py` (SlotUpdateSchema, SlotDeleteResponseSchema)
- [x] Add PATCH + DELETE to `api/slots_api.py`
- [x] Write `tests/slots/test_edit_delete_slot.py`
- [x] Run tests — 27 passed (12 from F-M3-5 + 15 new)

## Chunk 2 — Frontend

- [x] Add `editSlot` + `deleteSlot` to `lib/api/services/slots.service.ts`
- [x] Add three-dot menu to `SlotCard.tsx` (Edit + Delete items)
- [x] Create `EditSlotModal.tsx` (pre-populated, DayPicker + live preview)
- [x] Create `DeleteSlotModal.tsx` (two states: blocked vs confirmation)
- [x] Wire edit/delete in `SlotListTab.tsx`
- [x] TypeScript clean, 20 frontend tests pass

## Deviations from plan

- `SlotUpdateSchema` omits `slot_name` — auto-computed on edit (same as create)
- Slot delete: `SlotClassSection` count check deferred to F-M3-7 (model not yet created). `soft_delete_slot` currently always succeeds when user has permission. Wire-up commented in service code for F-M3-7.
- `test_cho_can_edit_slot_within_scope` deferred — complex PartnerWorknode fixture setup.
- Slot-class delete-blocking tests deferred to F-M3-7: `test_delete_slot_with_active_slot_classes_returns_409`, `test_delete_slot_with_only_removed_slot_classes_succeeds`, `test_delete_slot_with_inactive_but_not_removed_slot_classes_succeeds`, `test_delete_slot_does_not_cascade`, `test_delete_slot_error_message_includes_active_count`.

## Blockers

- None
