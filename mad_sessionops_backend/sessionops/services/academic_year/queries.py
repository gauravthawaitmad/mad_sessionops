from sessionops.exceptions import ConflictError, NotFound
from sessionops.models import AcademicYear, SchoolAcademicYear
from sessionops.schemas.academic_year import AcademicYearCreateIn, AcademicYearUpdateIn


def get_active_academic_year() -> AcademicYear:
    try:
        return AcademicYear.objects.get(is_active=True, removed=False)
    except AcademicYear.DoesNotExist:
        raise NotFound("No active academic year is configured.")


def get_all_academic_years() -> list[AcademicYear]:
    return list(AcademicYear.objects.filter(removed=False).order_by("-academic_year_id"))


def create_academic_year(payload: AcademicYearCreateIn, user) -> AcademicYear:
    if AcademicYear.objects.filter(label=payload.label, removed=False).exists():
        raise ConflictError(f"Academic year '{payload.label}' already exists.")
    return AcademicYear.objects.create(
        label=payload.label,
        is_active=False,
        created_by=user,
    )


def update_academic_year(academic_year_id: int, payload: AcademicYearUpdateIn) -> AcademicYear:
    try:
        year = AcademicYear.objects.get(academic_year_id=academic_year_id, removed=False)
    except AcademicYear.DoesNotExist:
        raise NotFound(f"Academic year {academic_year_id} not found.")

    if (
        AcademicYear.objects.filter(label=payload.label, removed=False)
        .exclude(academic_year_id=academic_year_id)
        .exists()
    ):
        raise ConflictError(f"Academic year '{payload.label}' already exists.")

    year.label = payload.label
    year.save(update_fields=["label", "updated_at"])
    return year


def get_or_create_school_academic_year(school_id: int, user) -> SchoolAcademicYear:
    """
    Return the school's currently-active SchoolAcademicYear binding, creating one
    against the globally-active AcademicYear only if the school has no active
    binding at all.

    A school's active binding is independent of which AcademicYear is globally
    active — a school can be mid-progression on a year that's no longer current
    (see services/schools/queries.py's academic_year_by_school). So this must NOT
    look the row up scoped to the globally-active year: doing that finds no match
    once the global year rolls over and creates a second active row for the
    school, leaving it with two simultaneously-active SchoolAcademicYear rows.
    """
    existing = SchoolAcademicYear.objects.filter(
        school_id=school_id, is_active=True, removed=False
    ).first()
    if existing is not None:
        return existing

    active_year = get_active_academic_year()
    return SchoolAcademicYear.objects.create(
        school_id=school_id,
        academic_year_id=active_year,
        created_by=user,
    )
