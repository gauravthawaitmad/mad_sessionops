"""
Tests for F-M3-3: Volunteer auto-population (list_school_volunteers service).
"""

from datetime import time

import pytest

from sessionops.exceptions import NotFound, PermissionDenied
from sessionops.models import (
    AcademicYear,
    Class,
    ClassSection,
    ClassSectionSubject,
    Partner,
    PartnerWorknode,
    Program,
    SchoolAcademicYear,
    SchoolClass,
    Slot,
    SlotClassSection,
    SlotClassSectionVolunteer,
    Subject,
    User,
)
from sessionops.services.volunteers.list import list_school_volunteers

# ── Helpers ────────────────────────────────────────────────────────────────────

_SCHOOL_ID_COUNTER = iter(range(10_000, 20_000))


def _next_school_id() -> int:
    return next(_SCHOOL_ID_COUNTER)


def _make_user(login: str, role: str = "CO Full Time", worknode_id: int | None = None) -> User:
    return User.objects.create(
        user_login=login,
        user_display_name=login.split("@")[0],
        email=login,
        user_role=role,
        is_active=True,
        worknode_id=worknode_id,
    )


def _make_school(school_id: int, co_id: int) -> Partner:
    return Partner.objects.create(
        partner_id=school_id,
        partner_name=f"School {school_id}",
        co_id=co_id,
        converted=True,
        is_active=True,
    )


def _make_partner_worknode(school_id: int, worknode_id: int) -> PartnerWorknode:
    return PartnerWorknode.objects.create(
        partner_id=str(school_id),
        worknode_id=worknode_id,
    )


# ── Tests ──────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestListSchoolVolunteers:
    def test_list_school_volunteers_returns_users_with_matching_worknode_id(self):
        co = _make_user("co_match@test.com")
        sid = _next_school_id()
        _make_school(school_id=sid, co_id=co.user_id)
        _make_partner_worknode(sid, worknode_id=7)
        vol = _make_user("vol_match@test.com", role="Wingman", worknode_id=7)

        result = list_school_volunteers(sid, co)

        assert result["status"] == "ok"
        assert len(result["volunteers"]) == 1
        assert result["volunteers"][0]["user_id"] == vol.user_id
        assert result["volunteers"][0]["user_display_name"] == vol.user_display_name

    def test_list_school_volunteers_no_partner_worknode_returns_no_worknode_status(self):
        co = _make_user("co_nopw@test.com")
        sid = _next_school_id()
        _make_school(school_id=sid, co_id=co.user_id)

        result = list_school_volunteers(sid, co)

        assert result["status"] == "no_worknode"
        assert "No Worknode found" in result["message"]
        assert result["volunteers"] == []

    def test_list_school_volunteers_no_matching_users_returns_no_volunteers_status(self):
        co = _make_user("co_novol@test.com")
        sid = _next_school_id()
        _make_school(school_id=sid, co_id=co.user_id)
        _make_partner_worknode(sid, worknode_id=8)

        result = list_school_volunteers(sid, co)

        assert result["status"] == "no_volunteers"
        assert "No volunteers found" in result["message"]
        assert result["volunteers"] == []

    def test_list_school_volunteers_excludes_inactive_users(self):
        co = _make_user("co_inactive@test.com")
        sid = _next_school_id()
        _make_school(school_id=sid, co_id=co.user_id)
        _make_partner_worknode(sid, worknode_id=9)
        inactive_vol = _make_user("inactive_vol@test.com", role="Wingman", worknode_id=9)
        inactive_vol.is_active = False
        inactive_vol.save()

        result = list_school_volunteers(sid, co)

        assert result["status"] == "no_volunteers"
        assert len(result["volunteers"]) == 0

    def test_list_school_volunteers_includes_active_slot_class_count_field(self):
        co = _make_user("co_count@test.com")
        sid = _next_school_id()
        _make_school(school_id=sid, co_id=co.user_id)
        _make_partner_worknode(sid, worknode_id=10)
        _make_user("vol_count@test.com", role="Wingman", worknode_id=10)

        result = list_school_volunteers(sid, co)

        assert result["status"] == "ok"
        vol_data = result["volunteers"][0]
        assert "active_slot_class_count" in vol_data
        assert vol_data["active_slot_class_count"] == 0

    def test_list_school_volunteers_dedupe_when_multiple_worknode_rows(self):
        co = _make_user("co_dedup@test.com")
        sid = _next_school_id()
        _make_school(school_id=sid, co_id=co.user_id)
        PartnerWorknode.objects.create(partner_id=str(sid), worknode_id=11)
        PartnerWorknode.objects.create(partner_id=str(sid), worknode_id=11)
        _make_user("vol_dedup@test.com", role="Wingman", worknode_id=11)

        result = list_school_volunteers(sid, co)

        assert result["status"] == "ok"
        assert len(result["volunteers"]) == 1

    def test_list_school_volunteers_returns_403_for_co_without_school_access(self):
        other_co = _make_user("other_co_403@test.com")
        co = _make_user("co_403@test.com")
        sid = _next_school_id()
        _make_school(school_id=sid, co_id=co.user_id)

        with pytest.raises((PermissionDenied, NotFound)):
            list_school_volunteers(sid, other_co)

    def test_list_school_volunteers_admin_can_view_any_school(self):
        admin = _make_user("admin_vol@test.com", role="Function Lead")
        co = _make_user("co_admin@test.com")
        sid = _next_school_id()
        _make_school(school_id=sid, co_id=co.user_id)
        _make_partner_worknode(sid, worknode_id=12)
        _make_user("vol_admin@test.com", role="Wingman", worknode_id=12)

        result = list_school_volunteers(sid, admin)

        assert result["status"] == "ok"
        assert len(result["volunteers"]) == 1

    def test_list_school_volunteers_returns_user_login_and_role(self):
        co = _make_user("co_fields@test.com")
        sid = _next_school_id()
        _make_school(school_id=sid, co_id=co.user_id)
        _make_partner_worknode(sid, worknode_id=13)
        _make_user("vol_fields@test.com", role="Wingman", worknode_id=13)

        result = list_school_volunteers(sid, co)

        vol_data = result["volunteers"][0]
        assert vol_data["user_login"] == "vol_fields@test.com"
        assert vol_data["user_role"] == "Wingman"

    # ── Detail fields ────────────────────────────────────────────────────────

    def test_list_school_volunteers_returns_contact_detail_fields(self):
        """email, contact, city, state are included in each volunteer card."""
        co = _make_user("co_detail@test.com")
        sid = _next_school_id()
        _make_school(school_id=sid, co_id=co.user_id)
        _make_partner_worknode(sid, worknode_id=14)
        User.objects.create(
            user_login="vol_detail@test.com",
            user_display_name="Vol Detail",
            email="vol_detail@test.com",
            contact="9876543210",
            city="Pune",
            state="Maharashtra",
            user_role="Wingman",
            is_active=True,
            worknode_id=14,
        )

        result = list_school_volunteers(sid, co)

        assert result["status"] == "ok"
        v = result["volunteers"][0]
        assert v["email"] == "vol_detail@test.com"
        assert v["contact"] == "9876543210"
        assert v["city"] == "Pune"
        assert v["state"] == "Maharashtra"

    def test_list_school_volunteers_returns_null_for_missing_contact_fields(self):
        """contact, city, state are None when not set on the User row."""
        co = _make_user("co_nullfields@test.com")
        sid = _next_school_id()
        _make_school(school_id=sid, co_id=co.user_id)
        _make_partner_worknode(sid, worknode_id=15)
        _make_user("vol_nullfields@test.com", role="Wingman", worknode_id=15)

        result = list_school_volunteers(sid, co)

        assert result["status"] == "ok"
        v = result["volunteers"][0]
        assert v["contact"] is None
        assert v["city"] is None
        assert v["state"] is None


# ── Helpers for slot-class count tests ────────────────────────────────────────

_SCS_SCHOOL_COUNTER = iter(range(30_000, 40_000))


def _next_scs_school_id() -> int:
    return next(_SCS_SCHOOL_COUNTER)


def _make_scs_user(login: str, role: str = "CO Full Time", worknode_id: int | None = None) -> User:
    return User.objects.create(
        user_login=login,
        user_display_name=login.split("@")[0],
        email=login,
        user_role=role,
        is_active=True,
        worknode_id=worknode_id,
    )


def _make_scs_school(school_id: int, co: User) -> Partner:
    return Partner.objects.create(
        partner_id=school_id,
        partner_name=f"School {school_id}",
        co_id=co.user_id,
        converted=True,
        is_active=True,
    )


def _make_slot(school_id: int, admin: User) -> Slot:
    year, _ = AcademicYear.objects.get_or_create(
        label="2026-2027",
        defaults={"is_active": True, "created_by": admin},
    )
    say, _ = SchoolAcademicYear.objects.get_or_create(
        school_id=school_id,
        academic_year_id=year,
        defaults={"created_by": admin},
    )
    return Slot.objects.create(
        school_id=school_id,
        school_academic_year_id=say,
        slot_name="Monday 09:00",
        day_of_week="monday",
        start_time=time(9, 0),
        end_time=time(10, 0),
        recurring=True,
        is_active=True,
        created_by=admin,
    )


def _make_section(school_id: int, admin: User) -> ClassSection:
    program, _ = Program.objects.get_or_create(program_name="Foundation Program")
    cls, _ = Class.objects.get_or_create(
        class_code="5",
        defaults={"class_name": "5th", "program_id": program, "is_active": True},
    )
    year, _ = AcademicYear.objects.get_or_create(
        label="2026-2027",
        defaults={"is_active": True, "created_by": admin},
    )
    say, _ = SchoolAcademicYear.objects.get_or_create(
        school_id=school_id,
        academic_year_id=year,
        defaults={"created_by": admin},
    )
    sc = SchoolClass.objects.create(
        school_id=school_id,
        school_academic_year_id=say,
        class_id_id=cls.class_id,
        created_by=admin,
    )
    return ClassSection.objects.create(
        school_class_id=sc,
        school_id=school_id,
        section_code="A",
        section_name="5th - A",
        is_active=True,
        created_by=admin,
    )


def _make_slot_class_section(slot: Slot, section: ClassSection, admin: User) -> SlotClassSection:
    program, _ = Program.objects.get_or_create(program_name="Foundation Program")
    subj, _ = Subject.objects.get_or_create(
        subject_name="Foundation Day 1",
        defaults={"program_id": program},
    )
    css, _ = ClassSectionSubject.objects.get_or_create(
        class_section_id=section,
        subject_id=subj,
        defaults={"is_active": True, "created_by": admin},
    )
    return SlotClassSection.objects.create(
        slot_id=slot,
        class_section_id=section,
        class_section_subject_id=css,
        is_active=True,
        created_by=admin,
    )


def _assign_volunteer(
    scs: SlotClassSection, volunteer: User, admin: User
) -> SlotClassSectionVolunteer:
    return SlotClassSectionVolunteer.objects.create(
        slot_class_section_id=scs,
        volunteer_id=volunteer,
        is_active=True,
        removed=False,
        created_by=admin,
    )


# ── active_slot_class_count tests ─────────────────────────────────────────────


@pytest.mark.django_db
class TestActiveSlotClassCount:
    def test_active_slot_class_count_reflects_actual_assignments(self):
        """Count is 1 when the volunteer has one active slot-class assignment at this school."""
        admin = _make_scs_user("admin_scs1@test.com", role="Project Lead")
        co = _make_scs_user("co_scs1@test.com")
        sid = _next_scs_school_id()
        _make_scs_school(sid, co)

        wid = 501
        PartnerWorknode.objects.create(partner_id=str(sid), worknode_id=wid)
        vol = _make_scs_user("vol_scs1@test.com", role="Wingman", worknode_id=wid)

        slot = _make_slot(sid, admin)
        section = _make_section(sid, admin)
        scs = _make_slot_class_section(slot, section, admin)
        _assign_volunteer(scs, vol, admin)

        result = list_school_volunteers(sid, co)

        assert result["status"] == "ok"
        assert result["volunteers"][0]["active_slot_class_count"] == 1
        assert result["volunteers"][0]["active_slot_class_section_id"] == scs.slot_class_section_id

    def test_active_slot_class_count_zero_when_no_assignments(self):
        """Count is 0 when the volunteer has no slot-class assignments."""
        _make_scs_user("admin_scs2@test.com", role="Project Lead")
        co = _make_scs_user("co_scs2@test.com")
        sid = _next_scs_school_id()
        _make_scs_school(sid, co)

        wid = 502
        PartnerWorknode.objects.create(partner_id=str(sid), worknode_id=wid)
        _make_scs_user("vol_scs2@test.com", role="Wingman", worknode_id=wid)

        result = list_school_volunteers(sid, co)

        assert result["status"] == "ok"
        assert result["volunteers"][0]["active_slot_class_count"] == 0
        assert result["volunteers"][0]["active_slot_class_section_id"] is None

    def test_active_slot_class_count_ignores_other_school_assignments(self):
        """Assignments at a different school do not inflate the count."""
        admin = _make_scs_user("admin_scs3@test.com", role="Project Lead")
        co1 = _make_scs_user("co_scs3a@test.com")
        co2 = _make_scs_user("co_scs3b@test.com")
        sid_a = _next_scs_school_id()
        sid_b = _next_scs_school_id()
        _make_scs_school(sid_a, co1)
        _make_scs_school(sid_b, co2)

        wid = 503
        PartnerWorknode.objects.create(partner_id=str(sid_a), worknode_id=wid)
        PartnerWorknode.objects.create(partner_id=str(sid_b), worknode_id=wid)
        vol = _make_scs_user("vol_scs3@test.com", role="Wingman", worknode_id=wid)

        # Assign vol at school B only
        slot_b = _make_slot(sid_b, admin)
        section_b = _make_section(sid_b, admin)
        scs_b = _make_slot_class_section(slot_b, section_b, admin)
        _assign_volunteer(scs_b, vol, admin)

        # Query school A — should show 0
        result = list_school_volunteers(sid_a, co1)

        assert result["status"] == "ok"
        assert result["volunteers"][0]["active_slot_class_count"] == 0

    def test_active_slot_class_count_ignores_removed_assignments(self):
        """Assignments with removed=True are excluded from the count."""
        admin = _make_scs_user("admin_scs4@test.com", role="Project Lead")
        co = _make_scs_user("co_scs4@test.com")
        sid = _next_scs_school_id()
        _make_scs_school(sid, co)

        wid = 504
        PartnerWorknode.objects.create(partner_id=str(sid), worknode_id=wid)
        vol = _make_scs_user("vol_scs4@test.com", role="Wingman", worknode_id=wid)

        slot = _make_slot(sid, admin)
        section = _make_section(sid, admin)
        scs = _make_slot_class_section(slot, section, admin)
        assignment = _assign_volunteer(scs, vol, admin)

        # Mark as removed
        assignment.removed = True
        assignment.is_active = False
        assignment.save()

        result = list_school_volunteers(sid, co)

        assert result["status"] == "ok"
        assert result["volunteers"][0]["active_slot_class_count"] == 0

    def test_active_slot_class_count_increments_for_multiple_assignments(self):
        """Count is 2 when the volunteer teaches two different slot-classes at the same school."""
        admin = _make_scs_user("admin_scs5@test.com", role="Project Lead")
        co = _make_scs_user("co_scs5@test.com")
        sid = _next_scs_school_id()
        _make_scs_school(sid, co)

        wid = 505
        PartnerWorknode.objects.create(partner_id=str(sid), worknode_id=wid)
        vol = _make_scs_user("vol_scs5@test.com", role="Wingman", worknode_id=wid)

        slot = _make_slot(sid, admin)
        section = _make_section(sid, admin)
        scs1 = _make_slot_class_section(slot, section, admin)
        _assign_volunteer(scs1, vol, admin)

        # Second slot
        year, _ = AcademicYear.objects.get_or_create(
            label="2026-2027", defaults={"is_active": True, "created_by": admin}
        )
        say, _ = SchoolAcademicYear.objects.get_or_create(
            school_id=sid, academic_year_id=year, defaults={"created_by": admin}
        )
        slot2 = Slot.objects.create(
            school_id=sid,
            school_academic_year_id=say,
            slot_name="Tuesday 10:00",
            day_of_week="tuesday",
            start_time=time(10, 0),
            end_time=time(11, 0),
            recurring=True,
            is_active=True,
            created_by=admin,
        )
        scs2 = _make_slot_class_section(slot2, section, admin)
        _assign_volunteer(scs2, vol, admin)

        result = list_school_volunteers(sid, co)

        assert result["status"] == "ok"
        assert result["volunteers"][0]["active_slot_class_count"] == 2
