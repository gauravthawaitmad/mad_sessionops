"""
F-M8a-4: Worknode cascade flows.

All three sub-flows (worknode_added, worknode_updated, worknode_removed) live here.
Every function operates on integer school_id values; no Partner objects are passed around.
All writes happen inside the orchestrator's transaction.atomic().
"""

from sessionops.models import (
    ChildSubject,
    PartnerWorknode,
    SchoolVolunteer,
    SlotClassSection,
    SlotClassSectionVolunteer,
    User,
)
from sessionops.services.academic_year.queries import get_or_create_school_academic_year
from sessionops.services.realtime_sync.flows import FlowResult
from sessionops.services.realtime_sync.utils import apply_common_fields

# Realtime sync runs with no human actor. New SchoolVolunteer / SchoolAcademicYear
# rows created here are attributed to this designated admin user.
SYSTEM_ADMIN_USER_ID = 485003

# ── School resolver ────────────────────────────────────────────────────────────


def _resolve_school_for_worknode(worknode_id: int) -> int | None:
    """
    Return the school_id (integer Partner PK) that this worknode_id maps to, or None.
    PartnerWorknode.partner_id is a CharField, so we cast to int.
    """
    pw = PartnerWorknode.objects.filter(worknode_id=worknode_id).first()
    if pw is None:
        return None
    try:
        return int(pw.partner_id)
    except (ValueError, TypeError):
        return None


# ── Cascade remove ─────────────────────────────────────────────────────────────


def _cascade_remove_user_from_school(user, school_id: int, now, cascaded_changes: list) -> None:
    """
    Soft-delete all slot-class assignments for user at school_id, cascading through
    SlotClassSection → ClassSectionSubject → ChildSubject when each parent loses
    its last child. Then soft-delete the SchoolVolunteer row.

    Operates inside the caller's transaction.atomic().
    FK accessor names match model definitions (field named slot_class_section_id
    on SCSV returns the SlotClassSection object via Django's FK accessor).
    """
    scsv_qs = SlotClassSectionVolunteer.objects.filter(
        volunteer_id=user,
        slot_class_section_id__slot_id__school_id=school_id,
        is_active=True,
        removed=False,
    ).select_related(
        "slot_class_section_id",
        "slot_class_section_id__class_section_subject_id",
    )

    processed_scs_pks = set()

    for scsv in scsv_qs:
        scsv.is_active = False
        scsv.removed = True
        scsv.deleted_at = now
        scsv.save(update_fields=["is_active", "removed", "deleted_at"])
        cascaded_changes.append(
            {
                "table": "slot_class_section_volunteer",
                "id": scsv.slot_class_section_volunteer_id,
                "action": "soft_deleted",
            }
        )

        # scsv.slot_class_section_id is the FK accessor → SlotClassSection object
        scs = scsv.slot_class_section_id
        if scs.pk in processed_scs_pks:
            continue
        processed_scs_pks.add(scs.pk)

        has_remaining = SlotClassSectionVolunteer.objects.filter(
            slot_class_section_id=scs,
            is_active=True,
            removed=False,
        ).exists()

        if not has_remaining:
            scs.is_active = False
            scs.removed = True
            scs.deleted_at = now
            scs.save(update_fields=["is_active", "removed", "deleted_at"])
            cascaded_changes.append(
                {
                    "table": "slot_class_section",
                    "id": scs.slot_class_section_id,
                    "action": "soft_deleted",
                }
            )

            # scs.class_section_subject_id is the FK accessor → ClassSectionSubject object
            css = scs.class_section_subject_id
            has_remaining_scs = SlotClassSection.objects.filter(
                class_section_subject_id=css,
                is_active=True,
                removed=False,
            ).exists()

            if not has_remaining_scs:
                css.is_active = False
                css.removed = True
                css.deleted_at = now
                css.save(update_fields=["is_active", "removed", "deleted_at"])
                cascaded_changes.append(
                    {
                        "table": "class_section_subject",
                        "id": css.class_section_subject_id,
                        "action": "soft_deleted",
                    }
                )

                child_count = ChildSubject.objects.filter(
                    class_section_subject_id=css,
                    is_active=True,
                    removed=False,
                ).update(is_active=False, removed=True, deleted_at=now)
                if child_count:
                    cascaded_changes.append(
                        {
                            "table": "child_subject",
                            "parent_css_id": css.class_section_subject_id,
                            "count": child_count,
                            "action": "soft_deleted",
                        }
                    )

    sv_count = SchoolVolunteer.objects.filter(
        school_id=school_id,
        volunteer_id=user,
        is_active=True,
        removed=False,
    ).update(is_active=False, removed=True, deleted_at=now)
    if sv_count:
        cascaded_changes.append(
            {
                "table": "school_volunteer",
                "school_id": school_id,
                "action": "soft_deleted",
            }
        )


def _ensure_school_volunteer(user, school_id: int, now, cascaded_changes: list) -> None:
    """
    Create a SchoolVolunteer row if user is not already active at school_id.
    Skips silently when the row already exists — preserving an existing assignment
    is the correct behaviour when the new worknode resolves to the same school.
    Binds the new row to school_id's currently-active SchoolAcademicYear, attributed
    to SYSTEM_ADMIN_USER_ID since this flow has no human actor.
    """
    already_active = SchoolVolunteer.objects.filter(
        school_id=school_id,
        volunteer_id=user,
        is_active=True,
        removed=False,
    ).exists()
    if not already_active:
        admin_user = User.objects.get(user_id=SYSTEM_ADMIN_USER_ID)
        say = get_or_create_school_academic_year(school_id, admin_user)
        SchoolVolunteer.objects.create(
            school_id=school_id,
            school_academic_year_id=say,
            volunteer_id=user,
            created_by=admin_user,
        )
        cascaded_changes.append(
            {
                "table": "school_volunteer",
                "school_id": school_id,
                "action": "created",
            }
        )


def _cleanup_other_school_assignments(
    user, current_school_id: int, now, cascaded_changes: list
) -> None:
    """
    Defensive: soft-delete all active SchoolVolunteer rows (and their full cascade)
    at schools OTHER than current_school_id. The assignment at current_school_id is
    left untouched. Per R4 only one school is expected, but drift must be cleared safely.
    """
    other_svs = SchoolVolunteer.objects.filter(
        volunteer_id=user,
        is_active=True,
        removed=False,
    ).exclude(school_id=current_school_id)

    for sv in other_svs:
        _cascade_remove_user_from_school(user, sv.school_id, now, cascaded_changes)


# ── Sub-flows ──────────────────────────────────────────────────────────────────


def cascade_worknode_added(
    local_user, payload, diff, now, cascaded_changes: list, rules_fired: list
) -> FlowResult:
    new_school_id = _resolve_school_for_worknode(payload.worknode_id)

    if new_school_id is None:
        apply_common_fields(local_user, payload, now)
        local_user.save()  # worknode_id intentionally NOT updated
        return FlowResult(
            status="partial_success",
            action_taken="no_school_found_for_worknode",
            deferred_operations={
                "reason": "no_partner_worknode_mapping",
                "worknode_id": payload.worknode_id,
                "skipped_actions": ["ensure_school_volunteer", "set_worknode_id_on_user"],
            },
        )

    # Defensive: remove drift at other schools; preserve any existing SV at new_school_id
    _cleanup_other_school_assignments(local_user, new_school_id, now, cascaded_changes)
    rules_fired.append("cleanup_other_school_assignments:worknode_added")

    # Create SchoolVolunteer at new school if not already there
    _ensure_school_volunteer(local_user, new_school_id, now, cascaded_changes)
    rules_fired.append("ensure_school_volunteer:worknode_added")

    apply_common_fields(local_user, payload, now)
    local_user.worknode_id = payload.worknode_id
    local_user.save()

    return FlowResult(
        status="success",
        action_taken="worknode_added",
        cascaded_changes=cascaded_changes,
        rules_fired=rules_fired,
    )


def cascade_worknode_removed(
    local_user, payload, diff, now, cascaded_changes: list, rules_fired: list
) -> FlowResult:
    old_worknode_id = local_user.worknode_id
    old_school_id = _resolve_school_for_worknode(old_worknode_id) if old_worknode_id else None

    if old_school_id is not None:
        _cascade_remove_user_from_school(local_user, old_school_id, now, cascaded_changes)
        rules_fired.append("cascade_remove_user_from_school:worknode_removed")

    apply_common_fields(local_user, payload, now)
    local_user.worknode_id = None
    local_user.save()

    return FlowResult(
        status="success",
        action_taken="worknode_removed",
        cascaded_changes=cascaded_changes,
        rules_fired=rules_fired,
    )


def cascade_worknode_updated(
    local_user, payload, diff, now, cascaded_changes: list, rules_fired: list
) -> FlowResult:
    old_worknode_id = local_user.worknode_id
    new_school_id = _resolve_school_for_worknode(payload.worknode_id)

    if new_school_id is None:
        # New school not resolvable — don't cascade old school either (avoid limbo state)
        apply_common_fields(local_user, payload, now)
        local_user.save()  # worknode_id intentionally NOT updated
        return FlowResult(
            status="partial_success",
            action_taken="no_school_found_for_worknode",
            deferred_operations={
                "reason": "no_partner_worknode_mapping",
                "new_worknode_id": payload.worknode_id,
                "old_worknode_id": old_worknode_id,
                "skipped_actions": [
                    "cascade_remove_from_old_school",
                    "ensure_school_volunteer",
                    "set_worknode_id_on_user",
                ],
            },
        )

    old_school_id = _resolve_school_for_worknode(old_worknode_id) if old_worknode_id else None

    if old_school_id is not None:
        _cascade_remove_user_from_school(local_user, old_school_id, now, cascaded_changes)
        rules_fired.append("cascade_remove_user_from_school:worknode_updated_old")

    # Defensive: clean up any other drift (excludes new_school_id)
    _cleanup_other_school_assignments(local_user, new_school_id, now, cascaded_changes)
    rules_fired.append("cleanup_other_school_assignments:worknode_updated")

    _ensure_school_volunteer(local_user, new_school_id, now, cascaded_changes)
    rules_fired.append("ensure_school_volunteer:worknode_updated_new")

    apply_common_fields(local_user, payload, now)
    local_user.worknode_id = payload.worknode_id
    local_user.save()

    return FlowResult(
        status="success",
        action_taken="worknode_updated",
        cascaded_changes=cascaded_changes,
        rules_fired=rules_fired,
    )


# ── Dispatcher ─────────────────────────────────────────────────────────────────


def handle_worknode_change(local_user, payload, diff, now) -> FlowResult:
    cascaded_changes: list = []
    rules_fired: list = []

    if diff.worknode_action == "added":
        return cascade_worknode_added(local_user, payload, diff, now, cascaded_changes, rules_fired)
    elif diff.worknode_action == "removed":
        return cascade_worknode_removed(
            local_user, payload, diff, now, cascaded_changes, rules_fired
        )
    elif diff.worknode_action == "updated":
        return cascade_worknode_updated(
            local_user, payload, diff, now, cascaded_changes, rules_fired
        )
    else:
        raise ValueError(
            f"handle_worknode_change called with unexpected worknode_action={diff.worknode_action!r}"
        )
