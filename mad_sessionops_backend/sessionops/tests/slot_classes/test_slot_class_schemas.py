"""
F-M6-5: SlotClassCreateSchema/SlotClassUpdateSchema field-validator tests.

Bounds (1-5) and uniqueness on volunteer_ids are enforced at the schema layer,
before the service ever runs, so they're tested directly against the schema
classes rather than through create_slot_class/edit_slot_class.
"""
import pydantic
import pytest

from sessionops.schemas.slot_classes import SlotClassCreateSchema, SlotClassUpdateSchema


def test_create_schema_rejects_empty_volunteer_ids():
    with pytest.raises(pydantic.ValidationError):
        SlotClassCreateSchema(class_section_id=1, volunteer_ids=[])


def test_create_schema_rejects_more_than_five_volunteer_ids():
    with pytest.raises(pydantic.ValidationError):
        SlotClassCreateSchema(class_section_id=1, volunteer_ids=[1, 2, 3, 4, 5, 6])


def test_create_schema_rejects_duplicate_volunteer_ids():
    with pytest.raises(pydantic.ValidationError):
        SlotClassCreateSchema(class_section_id=1, volunteer_ids=[7, 7])


def test_create_schema_accepts_one_to_five_unique_ids():
    schema = SlotClassCreateSchema(class_section_id=1, volunteer_ids=[1, 2, 3, 4, 5])
    assert schema.volunteer_ids == [1, 2, 3, 4, 5]


def test_update_schema_allows_none_volunteer_ids():
    """None means 'no change' on edit — must not trigger the length/uniqueness validator."""
    schema = SlotClassUpdateSchema(class_section_id=None, volunteer_ids=None)
    assert schema.volunteer_ids is None


def test_update_schema_rejects_duplicate_volunteer_ids():
    with pytest.raises(pydantic.ValidationError):
        SlotClassUpdateSchema(volunteer_ids=[3, 3])


def test_update_schema_rejects_more_than_five_volunteer_ids():
    with pytest.raises(pydantic.ValidationError):
        SlotClassUpdateSchema(volunteer_ids=[1, 2, 3, 4, 5, 6])
