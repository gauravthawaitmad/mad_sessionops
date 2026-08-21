import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddSlotClassModal } from "@/components/schools/slots/AddSlotClassModal";
import type { BucketItem } from "@/lib/api/services/buckets.service";
import type { VolunteerCard, VolunteerListResponse } from "@/lib/api/services/volunteers.service";
import type { SlotClassItem } from "@/lib/api/services/slot_classes.service";
import type { SlotItem } from "@/lib/api/services/slots.service";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api/services/buckets.service", () => ({
  fetchBuckets: vi.fn(),
}));

vi.mock("@/lib/api/services/volunteers.service", () => ({
  fetchVolunteers: vi.fn(),
}));

vi.mock("@/lib/api/services/slot_classes.service", () => ({
  createSlotClass: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { fetchBuckets } from "@/lib/api/services/buckets.service";
import { fetchVolunteers } from "@/lib/api/services/volunteers.service";
import { createSlotClass } from "@/lib/api/services/slot_classes.service";
import toast from "react-hot-toast";

const noop = () => {};

const SLOT: SlotItem = {
  slotId: 1,
  slotName: "Monday 09:00",
  dayOfWeek: "monday",
  startTime: "09:00:00",
  endTime: "10:00:00",
  recurring: true,
  slotClassCount: 0,
};

const BUCKET_ROOMY: BucketItem = {
  classSectionId: 10,
  sectionName: "group_1",
  sectionDisplayName: "Group 1",
  activeChildrenCount: 5,
};
const BUCKET_TIGHT: BucketItem = {
  classSectionId: 11,
  sectionName: "group_2",
  sectionDisplayName: "Group 2",
  activeChildrenCount: 2,
};
const BUCKET_IN_SLOT: BucketItem = {
  classSectionId: 12,
  sectionName: "group_3",
  sectionDisplayName: "Group 3",
  activeChildrenCount: 3,
};

function makeVolunteer(id: number, name: string): VolunteerCard {
  return {
    userId: id,
    userDisplayName: name,
    userLogin: `${name}@test.com`,
    userRole: "CHO",
    email: `${name}@test.com`,
    contact: null,
    city: null,
    state: null,
    activeSlotClassCount: 0,
    activeSlotClassSectionId: null,
  };
}

const VOLUNTEERS: VolunteerCard[] = [
  makeVolunteer(1, "Asha Kumar"),
  makeVolunteer(2, "Kiran Rao"),
  makeVolunteer(3, "Divya Singh"),
  makeVolunteer(4, "Rahul Mehta"),
];

const VOLUNTEER_RESPONSE: VolunteerListResponse = { status: "ok", volunteers: VOLUNTEERS };

const CREATED_SCS: SlotClassItem = {
  slotClassSectionId: 100,
  classSectionId: 10,
  sectionName: "group_1",
  sectionDisplayName: "Group 1",
  subjectName: "Foundation",
  volunteers: [],
  activeChildrenCount: 5,
};

const EXISTING_SLOT_CLASS: SlotClassItem = {
  slotClassSectionId: 99,
  classSectionId: 12,
  sectionName: "group_3",
  sectionDisplayName: "Group 3",
  subjectName: "Foundation",
  volunteers: [{ userId: 4, userDisplayName: "Rahul Mehta", userRole: "CHO" }],
  activeChildrenCount: 3,
};

async function selectBucket(name: string) {
  await userEvent.click(screen.getByText(name));
}

async function selectVolunteer(name: string) {
  const input = screen.getByPlaceholderText("Select volunteers");
  await userEvent.click(input);
  await userEvent.click(await screen.findByRole("option", { name: new RegExp(name) }));
}

describe("AddSlotClassModal — F-M6-8", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchBuckets).mockResolvedValue([BUCKET_ROOMY, BUCKET_TIGHT, BUCKET_IN_SLOT]);
    vi.mocked(fetchVolunteers).mockResolvedValue(VOLUNTEER_RESPONSE);
  });

  it("test_no_subject_picker_static_foundation_label", async () => {
    render(
      <AddSlotClassModal
        open={true}
        schoolId={580}
        slot={SLOT}
        existingSlotClasses={[]}
        onClose={noop}
        onAdded={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Group 1")).toBeInTheDocument());

    expect(screen.getByText("Subject: Foundation")).toBeInTheDocument();
    expect(screen.queryByText(/select a subject/i)).not.toBeInTheDocument();
  });

  it("test_bucket_picker_flat_no_class_grouping", async () => {
    render(
      <AddSlotClassModal
        open={true}
        schoolId={580}
        slot={SLOT}
        existingSlotClasses={[]}
        onClose={noop}
        onAdded={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Group 1")).toBeInTheDocument();
      expect(screen.getByText("Group 2")).toBeInTheDocument();
    });
  });

  it("test_bucket_already_in_slot_is_disabled", async () => {
    render(
      <AddSlotClassModal
        open={true}
        schoolId={580}
        slot={SLOT}
        existingSlotClasses={[EXISTING_SLOT_CLASS]}
        onClose={noop}
        onAdded={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Group 3")).toBeInTheDocument());
    expect(screen.getByText("In slot")).toBeInTheDocument();
  });

  it("test_volunteer_busy_in_another_slot_at_school_is_disabled", async () => {
    // R6 (revised): busy-ness is school-wide, not scoped to this slot — Rahul
    // already holds a slot-class in a completely different slot (id 200) and
    // must still show as disabled here.
    vi.mocked(fetchVolunteers).mockResolvedValue({
      status: "ok",
      volunteers: [
        VOLUNTEERS[0],
        VOLUNTEERS[1],
        VOLUNTEERS[2],
        { ...VOLUNTEERS[3], activeSlotClassSectionId: 200 },
      ],
    });

    render(
      <AddSlotClassModal
        open={true}
        schoolId={580}
        slot={SLOT}
        existingSlotClasses={[]}
        onClose={noop}
        onAdded={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Group 1")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("Select volunteers");
    await userEvent.click(input);

    const rahulOption = await screen.findByRole("option", { name: /Rahul Mehta/ });
    expect(rahulOption).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("In slot")).toBeInTheDocument();

    const kiranOption = screen.getByRole("option", { name: /Kiran Rao/ });
    expect(kiranOption).not.toHaveAttribute("aria-disabled", "true");
  });

  it("test_submit_disabled_until_bucket_and_volunteer_selected", async () => {
    render(
      <AddSlotClassModal
        open={true}
        schoolId={580}
        slot={SLOT}
        existingSlotClasses={[]}
        onClose={noop}
        onAdded={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Group 1")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Assign Class/ })).toBeDisabled();

    await selectBucket("Group 1");
    expect(screen.getByRole("button", { name: /Assign Class/ })).toBeDisabled();

    await selectVolunteer("Asha Kumar");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Assign Class/ })).not.toBeDisabled();
    });
  });

  it("test_valid_submit_calls_createSlotClass_with_bucket_and_volunteer_ids_only", async () => {
    vi.mocked(createSlotClass).mockResolvedValue(CREATED_SCS);
    const onAdded = vi.fn();

    render(
      <AddSlotClassModal
        open={true}
        schoolId={580}
        slot={SLOT}
        existingSlotClasses={[]}
        onClose={noop}
        onAdded={onAdded}
      />
    );

    await waitFor(() => expect(screen.getByText("Group 1")).toBeInTheDocument());
    await selectBucket("Group 1");
    await selectVolunteer("Asha Kumar");
    await selectVolunteer("Kiran Rao");

    await userEvent.click(screen.getByRole("button", { name: /Assign Class/ }));

    await waitFor(() => {
      expect(createSlotClass).toHaveBeenCalledWith(580, 1, {
        class_section_id: 10,
        volunteer_ids: [1, 2],
      });
      expect(onAdded).toHaveBeenCalledWith(CREATED_SCS);
    });

    const payload = vi.mocked(createSlotClass).mock.calls[0][2];
    expect(payload).not.toHaveProperty("subject_id");
    expect(payload).not.toHaveProperty("volunteer_1_id");
    expect(payload).not.toHaveProperty("volunteer_2_id");
  });

  it("test_selecting_past_bucket_capacity_shows_r_bucket_banner_and_disables_submit", async () => {
    render(
      <AddSlotClassModal
        open={true}
        schoolId={580}
        slot={SLOT}
        existingSlotClasses={[]}
        onClose={noop}
        onAdded={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Group 2")).toBeInTheDocument());
    // Group 2 has only 2 active children — the picker still allows up to 5 (R2's
    // hard cap), but a 3rd volunteer exceeds the bucket's capacity (R-bucket),
    // which is enforced as a soft banner + submit-disable, not a picker block.
    await selectBucket("Group 2");
    await selectVolunteer("Asha Kumar");
    await selectVolunteer("Kiran Rao");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Assign Class/ })).not.toBeDisabled();
    });

    await selectVolunteer("Divya Singh");

    await waitFor(() => {
      expect(screen.getByText(/Cannot assign 3 volunteers/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Assign Class/ })).toBeDisabled();
    });
  });

  it("test_no_buckets_shows_empty_state", async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([]);

    render(
      <AddSlotClassModal
        open={true}
        schoolId={580}
        slot={SLOT}
        existingSlotClasses={[]}
        onClose={noop}
        onAdded={noop}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("No mentoring circles added to this school yet.")
      ).toBeInTheDocument();
    });
  });

  it("test_data_load_failure_shows_toast_error", async () => {
    vi.mocked(fetchBuckets).mockRejectedValue(new Error("network down"));

    render(
      <AddSlotClassModal
        open={true}
        schoolId={580}
        slot={SLOT}
        existingSlotClasses={[]}
        onClose={noop}
        onAdded={noop}
      />
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load form data.");
    });
  });

  it("test_submit_failure_shows_api_error_message_via_toast", async () => {
    vi.mocked(createSlotClass).mockRejectedValue({
      data: { error: { message: "Bucket is already full for this slot." } },
    });

    render(
      <AddSlotClassModal
        open={true}
        schoolId={580}
        slot={SLOT}
        existingSlotClasses={[]}
        onClose={noop}
        onAdded={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Group 1")).toBeInTheDocument());
    await selectBucket("Group 1");
    await selectVolunteer("Asha Kumar");
    await userEvent.click(screen.getByRole("button", { name: /Assign Class/ }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Bucket is already full for this slot.");
    });
  });

  it("test_submit_failure_falls_back_to_generic_message_when_no_api_message", async () => {
    vi.mocked(createSlotClass).mockRejectedValue(new Error("boom"));

    render(
      <AddSlotClassModal
        open={true}
        schoolId={580}
        slot={SLOT}
        existingSlotClasses={[]}
        onClose={noop}
        onAdded={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Group 1")).toBeInTheDocument());
    await selectBucket("Group 1");
    await selectVolunteer("Asha Kumar");
    await userEvent.click(screen.getByRole("button", { name: /Assign Class/ }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("boom");
    });
  });
});
