# M2 Execution Tracker

**Plan:** `docs/milestones/plans/M2-implementation-plan.md`
**Last updated:** 2026-05-07
**Schema source:** M2.md spec only — old migrations deleted

---

## Phase 1 — Backend models + migrations

- [ ] Create `sessionops/models/academic_year.py` (AcademicYear, SchoolAcademicYear)
- [ ] Create `sessionops/models/program.py` (Program)
- [ ] Create `sessionops/models/grade_class.py` (Class, SchoolClass)
- [ ] Create `sessionops/models/class_section.py` (ClassSection + SECTION_CODES constant)
- [ ] Create `sessionops/models/child.py` (Child, ChildClass, ChildClassSection, BatchChild, ChildProgram, ChildRemovalLog + REMOVED_REASONS)
- [ ] Update `sessionops/models/__init__.py` — export all 12 M2 models
- [ ] `just makemigrations sessionops` — verify generated migration matches spec schema
- [ ] Create `management/commands/seed_m2_catalog.py` (AcademicYear 2026-2027, Foundation Program, 5th–8th classes)
- [ ] `just migrate`
- [ ] `python manage.py seed_m2_catalog`

## Phase 2 — Backend services + API

- [ ] Create `sessionops/services/academic_year/__init__.py` + `queries.py`
- [ ] Create `sessionops/services/structure/__init__.py` + `queries.py` + `sections.py`
- [ ] Create `sessionops/services/children/__init__.py` + `enroll.py` + `edit.py` + `deactivate.py` + `reactivate.py` + `queries.py`
- [ ] Create `sessionops/schemas/academic_year.py`
- [ ] Create `sessionops/schemas/structure.py`
- [ ] Create `sessionops/schemas/children.py`
- [ ] Create `sessionops/api/academic_years_api.py`
- [ ] Create `sessionops/api/structure_api.py`
- [ ] Create `sessionops/api/children_api.py`
- [ ] Verify `just serve` starts without ImportError
- [ ] Smoke each endpoint via Swagger

## Phase 3 — Backend tests

- [ ] Create `sessionops/tests/features/m2/__init__.py`
- [ ] Create `sessionops/tests/features/m2/test_f_m2_3_academic_year.py`
- [ ] Create `sessionops/tests/features/m2/test_f_m2_4_5_structure.py`
- [ ] Create `sessionops/tests/features/m2/test_f_m2_6_10_children.py`
- [ ] `just test` — all green

## Phase 4 — Frontend verification

- [ ] Verify `components/schools/structure/` — all components present and correct
- [ ] Verify `components/schools/children/` — all components present and correct
- [ ] Confirm enrollment form fields match spec (first_name, last_name, gender, age, class, section + optionals)
- [ ] Confirm reactivation modal has class + section cascading picker (not auto-restore)
- [ ] Confirm deactivation modal has 8-option dropdown + conditional other_details text field
- [ ] Verify `app/admin/academic-years/` route works (admin only, CO redirected)
- [ ] Verify SchoolDetailPage.tsx: Structure + Children tabs active, academic year in header
- [ ] `npm run test` — all green

## Phase 5 — Stabilization + production

- [ ] Full manual smoke checklist (from plan doc)
- [ ] All M2.md acceptance criteria checked
- [ ] Tag `m2-dev-complete`
- [ ] Run migrations on production (seed user: user_id=1924616, gaurav.thwait@makeadiff.in)
- [ ] Deploy backend + frontend
- [ ] CO runs full flow in production
- [ ] Admin audits school in production
- [ ] Monitor Sentry 24h
- [ ] Update M2.md done log
