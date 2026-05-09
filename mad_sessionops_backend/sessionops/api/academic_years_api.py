from ninja import Router

from sessionops.schemas.academic_year import (
    AcademicYearCreateIn,
    AcademicYearOut,
    AcademicYearUpdateIn,
)
from sessionops.services.academic_year.queries import (
    get_active_academic_year,
    get_all_academic_years,
    create_academic_year,
    update_academic_year,
)
from sessionops.services.rbac.scope import require_admin_scope

academic_years_router = Router(tags=["Academic Years"])


@academic_years_router.get("/active/", response=AcademicYearOut, auth=None)
def get_active_year(request):
    """Return the single currently-active academic year."""
    return get_active_academic_year()


@academic_years_router.get("/admin/", response=list[AcademicYearOut])
def list_academic_years(request):
    """Admin-only: list all academic years."""
    require_admin_scope(request.auth)
    return get_all_academic_years()


@academic_years_router.post("/admin/", response={201: AcademicYearOut})
def create_year(request, payload: AcademicYearCreateIn):
    """Admin-only: create a new academic year (starts inactive)."""
    require_admin_scope(request.auth)
    return 201, create_academic_year(payload, request.auth)


@academic_years_router.patch("/admin/{academic_year_id}/", response=AcademicYearOut)
def update_year(request, academic_year_id: int, payload: AcademicYearUpdateIn):
    """Admin-only: update an academic year's label."""
    require_admin_scope(request.auth)
    return update_academic_year(academic_year_id, payload)
