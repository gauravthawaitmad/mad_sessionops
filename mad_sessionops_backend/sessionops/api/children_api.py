"""
Children API — enroll, list, edit, deactivate, reactivate.

Filters in F-M2-10.
"""

from typing import Optional

from ninja import Router

from sessionops.schemas.children import (
    ChildEditIn,
    ChildEnrollIn,
    ChildOut,
    DeactivateIn,
    ReactivateIn,
)
from sessionops.services.children.deactivate import deactivate_child
from sessionops.services.children.edit import edit_child
from sessionops.services.children.enroll import enroll_child
from sessionops.services.children.queries import list_children
from sessionops.services.children.reactivate import reactivate_child
from sessionops.services.rbac.scope import get_school_or_403

children_router = Router(tags=["Children"])


@children_router.get("/{school_id}/children/", response=list[ChildOut])
def list_children_view(
    request,
    school_id: int,
    section_id: Optional[int] = None,
    class_id: Optional[int] = None,
    status: str = "active",
    search: Optional[str] = None,
    unassigned: bool = False,
):
    get_school_or_403(request.auth, school_id)
    return list(
        list_children(
            school_id,
            section_id=section_id,
            class_id=class_id,
            status=status,
            search=search,
            unassigned=unassigned,
        )
    )


@children_router.post("/{school_id}/children/", response={201: ChildOut})
def enroll_child_view(request, school_id: int, payload: ChildEnrollIn):
    get_school_or_403(request.auth, school_id)
    return 201, enroll_child(school_id, payload, request.auth)


@children_router.patch("/{school_id}/children/{child_id}/", response=ChildOut)
def edit_child_view(request, school_id: int, child_id: int, payload: ChildEditIn):
    get_school_or_403(request.auth, school_id)
    return edit_child(child_id, payload, request.auth)


@children_router.post("/{school_id}/children/{child_id}/deactivate/", response={200: None})
def deactivate_child_view(request, school_id: int, child_id: int, payload: DeactivateIn):
    get_school_or_403(request.auth, school_id)
    deactivate_child(child_id, payload, request.auth)
    return 200, None


@children_router.post("/{school_id}/children/{child_id}/reactivate/", response={200: ChildOut})
def reactivate_child_view(request, school_id: int, child_id: int, payload: ReactivateIn):
    get_school_or_403(request.auth, school_id)
    return 200, reactivate_child(child_id, payload, request.auth)
