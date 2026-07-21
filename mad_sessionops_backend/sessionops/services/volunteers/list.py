from sessionops.models import PartnerWorknode, SlotClassSectionVolunteer, User
from sessionops.services.rbac.scope import get_school_or_403


def list_school_volunteers(school_id: int, requesting_user) -> dict:
    """Return volunteers auto-populated from Worknode for this school."""
    get_school_or_403(requesting_user, school_id)

    worknode_ids = list(
        PartnerWorknode.objects.filter(
            partner_id=str(school_id),
        )
        .values_list("worknode_id", flat=True)
        .distinct()
    )

    if not worknode_ids:
        return {
            "status": "no_worknode",
            "message": "No Worknode found for this school. Please contact admin.",
            "volunteers": [],
        }

    volunteers = list(
        User.objects.filter(
            worknode_id__in=worknode_ids,
            is_active=True,
        ).order_by("user_display_name")
    )

    if not volunteers:
        return {
            "status": "no_volunteers",
            "message": (
                "No volunteers found for this school. "
                "Please make sure you've tagged the Worknode in user management."
            ),
            "volunteers": [],
        }

    serialized = []
    for v in volunteers:
        active_slot_class_count = SlotClassSectionVolunteer.objects.filter(
            volunteer_id=v,
            is_active=True,
            removed=False,
            slot_class_section_id__slot_id__school_id=school_id,
        ).count()
        serialized.append(
            {
                "user_id": v.user_id,
                "user_display_name": v.user_display_name,
                "user_login": v.user_login,
                "user_role": v.user_role,
                "email": v.email,
                "contact": v.contact,
                "city": v.city,
                "state": v.state,
                "active_slot_class_count": active_slot_class_count,
            }
        )

    return {"status": "ok", "volunteers": serialized}
