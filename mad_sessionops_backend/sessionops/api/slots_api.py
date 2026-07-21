from typing import List

from ninja import Router

from sessionops.models import SlotClassSection
from sessionops.schemas.auth import ErrorResponseSchema
from sessionops.schemas.slots import (
    SlotCreateSchema,
    SlotDeleteResponseSchema,
    SlotReadSchema,
    SlotUpdateSchema,
)
from sessionops.services.slots.create import create_slot, list_slots
from sessionops.services.slots.delete import soft_delete_slot
from sessionops.services.slots.edit import edit_slot

slots_router = Router(tags=["Slots"])


def _slot_to_schema(slot) -> SlotReadSchema:
    slot_class_count = SlotClassSection.objects.filter(
        slot_id=slot.slot_id, is_active=True, removed=False
    ).count()
    return SlotReadSchema(
        slot_id=slot.slot_id,
        slot_name=slot.slot_name,
        day_of_week=slot.day_of_week,
        start_time=slot.start_time,
        end_time=slot.end_time,
        recurring=slot.recurring,
        slot_class_count=slot_class_count,
    )


@slots_router.get(
    "/{school_id}/slots/",
    response={200: List[SlotReadSchema], 403: ErrorResponseSchema, 404: ErrorResponseSchema},
)
def get_slots(request, school_id: int):
    slots = list_slots(school_id, request.auth)
    return 200, [_slot_to_schema(s) for s in slots]


@slots_router.post(
    "/{school_id}/slots/",
    response={
        201: SlotReadSchema,
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        409: ErrorResponseSchema,
    },
)
def post_slot(request, school_id: int, payload: SlotCreateSchema):
    slot = create_slot(
        school_id=school_id,
        day_of_week=payload.day_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
        user=request.auth,
    )
    return 201, _slot_to_schema(slot)


@slots_router.patch(
    "/{school_id}/slots/{slot_id}/",
    response={
        200: SlotReadSchema,
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
    },
)
def patch_slot(request, school_id: int, slot_id: int, payload: SlotUpdateSchema):
    slot = edit_slot(
        slot_id=slot_id,
        day_of_week=payload.day_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
        user=request.auth,
    )
    return 200, _slot_to_schema(slot)


@slots_router.delete(
    "/{school_id}/slots/{slot_id}/",
    response={
        200: SlotDeleteResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
    },
)
def delete_slot(request, school_id: int, slot_id: int):
    slot = soft_delete_slot(slot_id=slot_id, user=request.auth)
    return 200, {"slot_id": slot.slot_id, "deleted": True}
