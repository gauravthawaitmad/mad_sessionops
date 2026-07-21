from typing import List

from ninja import Router, Schema

from sessionops.models import Subject
from sessionops.schemas.auth import ErrorResponseSchema
from sessionops.schemas.slot_classes import (
    SlotClassCreateSchema,
    SlotClassDeleteResponseSchema,
    SlotClassReadSchema,
    SlotClassUpdateSchema,
    VolunteerInSlotClassSchema,
)
from sessionops.services.slot_classes.create import create_slot_class, list_slot_classes
from sessionops.services.slot_classes.delete import delete_slot_class
from sessionops.services.slot_classes.edit import edit_slot_class
from sessionops.services.slot_classes.helpers import normalize_subject_display_name


class SubjectReadSchema(Schema):
    subject_id: int
    subject_name: str


slot_classes_router = Router(tags=["Slot Classes"])


@slot_classes_router.get(
    "/subjects/",
    response={200: List[SubjectReadSchema]},
    auth=None,
)
def get_subjects(request):
    """Return all seeded subjects (global catalog, no auth needed)."""
    return 200, list(
        Subject.objects.all().order_by("subject_name").values("subject_id", "subject_name")
    )


def _scs_to_schema(scs) -> SlotClassReadSchema:
    active_vols = [
        v for v in scs.slotclasssectionvolunteer_set.all() if v.is_active and not v.removed
    ]
    return SlotClassReadSchema(
        slot_class_section_id=scs.slot_class_section_id,
        class_section_id=scs.class_section_id_id,
        section_name=scs.class_section_id.section_name,
        section_display_name=scs.class_section_id.section_display_name,
        subject_name=normalize_subject_display_name(
            scs.class_section_subject_id.subject_id.subject_name
        ),
        volunteers=[
            VolunteerInSlotClassSchema(
                user_id=v.volunteer_id_id,
                user_display_name=v.volunteer_id.user_display_name,
                user_role=v.volunteer_id.user_role,
            )
            for v in active_vols
        ],
        active_children_count=scs.class_section_id.childclasssection_set.filter(
            is_active=True, removed=False
        ).count(),
    )


@slot_classes_router.get(
    "/{school_id}/slots/{slot_id}/slot-classes/",
    response={200: List[SlotClassReadSchema], 403: ErrorResponseSchema, 404: ErrorResponseSchema},
)
def get_slot_classes(request, school_id: int, slot_id: int):
    scs_list = list_slot_classes(slot_id, request.auth)
    return 200, [_scs_to_schema(scs) for scs in scs_list]


@slot_classes_router.post(
    "/{school_id}/slots/{slot_id}/slot-classes/",
    response={
        201: SlotClassReadSchema,
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
    },
)
def post_slot_class(request, school_id: int, slot_id: int, payload: SlotClassCreateSchema):
    scs = create_slot_class(slot_id, payload, request.auth)
    # Re-fetch with prefetch for serialization
    from sessionops.models import SlotClassSection

    scs = (
        SlotClassSection.objects.select_related(
            "class_section_id", "class_section_subject_id__subject_id"
        )
        .prefetch_related("slotclasssectionvolunteer_set__volunteer_id")
        .get(slot_class_section_id=scs.slot_class_section_id)
    )
    return 201, _scs_to_schema(scs)


@slot_classes_router.patch(
    "/{school_id}/slots/{slot_id}/slot-classes/{scs_id}/",
    response={
        200: SlotClassReadSchema,
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
    },
)
def patch_slot_class(
    request,
    school_id: int,
    slot_id: int,
    scs_id: int,
    payload: SlotClassUpdateSchema,
):
    scs = edit_slot_class(scs_id, payload, request.auth)
    from sessionops.models import SlotClassSection

    scs = (
        SlotClassSection.objects.select_related(
            "class_section_id", "class_section_subject_id__subject_id"
        )
        .prefetch_related("slotclasssectionvolunteer_set__volunteer_id")
        .get(slot_class_section_id=scs.slot_class_section_id)
    )
    return 200, _scs_to_schema(scs)


@slot_classes_router.delete(
    "/{school_id}/slots/{slot_id}/slot-classes/{scs_id}/",
    response={
        200: SlotClassDeleteResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
    },
)
def delete_slot_class_endpoint(request, school_id: int, slot_id: int, scs_id: int):
    delete_slot_class(scs_id, request.auth)
    return 200, {"slot_class_section_id": scs_id, "deleted": True}
