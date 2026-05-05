from ninja import Router

from sessionops.exceptions import NotFound
from sessionops.models import Partner
from sessionops.schemas.schools import SchoolDetailSchema, SchoolListItemSchema, SchoolListResponseSchema, SchoolSummarySchema
from sessionops.services.rbac import schools_visible_to

schools_router = Router(tags=["Schools"])

_CURRENT_ACADEMIC_YEAR = "2025–26"  # en-dash


def _compute_initials(name: str) -> str:
    words = [w for w in name.split() if w]
    if len(words) >= 2:
        return (words[0][0] + words[1][0]).upper()
    return name[:2].upper() if name else "??"


def _to_item(partner: Partner) -> SchoolListItemSchema:
    updated_at = partner.partner_updated_date or partner.synced_at
    return SchoolListItemSchema(
        partner_id=partner.partner_id,
        name=partner.partner_name,
        initials=_compute_initials(partner.partner_name),
        city=partner.city,
        contact_person_name=partner.poc_name,
        contact_phone=partner.poc_contact,
        co_name=partner.co_name,
        setup_status="not_configured",  # M1: no classes/sections yet
        children_count=partner.confirmed_child_count or 0,
        volunteers_count=0,    # M1: no volunteer data
        assignments_count=0,   # M1: no assignment data
        classes_count=0,       # M1: no class data
        updated_at=updated_at,
    )


@schools_router.get("", response=SchoolListResponseSchema)
def list_schools(request):
    qs = schools_visible_to(request.auth)

    search = request.GET.get("search", "").strip()
    if search:
        qs = qs.filter(
            partner_name__icontains=search
        ) | schools_visible_to(request.auth).filter(
            city__icontains=search
        ) | schools_visible_to(request.auth).filter(
            state__icontains=search
        )
        qs = qs.distinct()

    partners = list(qs.order_by("-partner_updated_date", "-synced_at"))
    schools = [_to_item(p) for p in partners]

    summary = SchoolSummarySchema(
        total_schools=len(schools),
        fully_configured=sum(1 for s in schools if s.setup_status == "configured"),
        children_enrolled=sum(s.children_count for s in schools),
        active_volunteers=0,  # M1
        academic_year=_CURRENT_ACADEMIC_YEAR,
    )

    return SchoolListResponseSchema(schools=schools, summary=summary)


@schools_router.get("/{partner_id}", response=SchoolDetailSchema)
def get_school(request, partner_id: int):
    try:
        partner = schools_visible_to(request.auth).get(partner_id=partner_id)
    except Partner.DoesNotExist:
        raise NotFound("School not found")

    return SchoolDetailSchema(
        partner_id=partner.partner_id,
        partner_name=partner.partner_name,
        address_line_1=partner.address_line_1,
        address_line_2=partner.address_line_2,
        city=partner.city,
        state=partner.state,
        pincode=partner.pincode,
        school_type=partner.school_type,
        partner_affiliation_type=partner.partner_affiliation_type,
        poc_name=partner.poc_name,
        poc_email=partner.poc_email,
        poc_designation=partner.poc_designation,
        poc_contact=partner.poc_contact,
        mou_sign_date=partner.mou_sign_date,
        mou_start_date=partner.mou_start_date,
        mou_end_date=partner.mou_end_date,
        mou_url=partner.mou_url,
        co_id=partner.co_id,
        co_name=partner.co_name,
        synced_at=partner.synced_at,
        configuration_status="awaiting_setup",
        children_count=partner.confirmed_child_count or 0,
        classes_count=0,
        volunteers_count=0,
        assignments_count=0,
    )
