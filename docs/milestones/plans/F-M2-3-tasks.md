# F-M2-3 Execution Progress

## Chunk 1 — Models + Migration + Seed

- [x] Create `models/academic_year.py` (AcademicYear, SchoolAcademicYear)
- [x] Create remaining M2 model files (program.py, grade_class.py, class_section.py, child.py) — needed for single M2 migration
- [x] Update `models/__init__.py` with all new models
- [x] Create stub `api/academic_years_api.py`, `api/structure_api.py`, `api/children_api.py` (fix routes.py import breakage)
- [x] Run `just makemigrations sessionops` → generated 0009 migration
- [x] Create `management/commands/seed_m2_catalog.py`
- [x] Run `just migrate`
- [x] Run seed_m2_catalog command (idempotent — data already seeded)

## Chunk 2 — Backend Service + API

- [x] Create `services/academic_year/__init__.py` + `queries.py`
- [x] Create `schemas/academic_year.py` (AcademicYearOut, AcademicYearCreateIn, AcademicYearUpdateIn with YYYY-YYYY validation)
- [x] Implement full `api/academic_years_api.py` (4 endpoints: GET active, GET admin list, POST admin create, PATCH admin update)
- [x] Write tests `sessionops/tests/test_f_m2_3_academic_year.py` (14 tests, all passing)
- [x] Ruff lint — passes
- [x] Restore deleted `services/__init__.py` (was deleted, caused ImportError)

## Chunk 3 — Frontend

- [x] Add "Academic Year: {activeYear}" chip to `SchoolDetailPage.tsx` sticky header
- [x] Fix API paths in `components/admin/AcademicYearsPage.tsx` (was `/admin/academic-years/`, fixed to `/academic-years/admin/`)
- [x] Fix isAdmin check in `AcademicYearsPage.tsx` (now checks actual backend role names)
- [x] Admin page + component already existed from previous session
- [x] Add admin year API functions to `structure.service.ts`
- [x] TypeScript check — passes (no errors)
- [x] Frontend tests — 15 passed

## Deviations from Plan

- M2 model files (program, grade_class, class_section, child) are created together with AcademicYear
  as part of Chunk 1, because the plan specifies a "single M2 migration." This means model files for
  F-M2-4 through F-M2-9 are pre-created here. Services/API for those features are built in their
  respective feature executions.
- Migration 0010 is a no-op (the `db_column="program_id"` fix was folded into 0009 to keep test DB consistent)
- `AcademicYearsPage.tsx` and `app/admin/academic-years/page.tsx` existed from a previous session; fixed API paths and isAdmin check
- `services/__init__.py` was deleted (tracked in git status as D); restored during this session

## Blockers
- None
