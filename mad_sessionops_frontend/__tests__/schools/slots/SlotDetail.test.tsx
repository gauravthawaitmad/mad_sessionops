import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SlotDetail } from "@/components/schools/slots/SlotDetail";
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
  fetchSlotClasses: vi.fn(),
  createSlotClass: vi.fn(),
  updateSlotClass: vi.fn(),
  deleteSlotClass: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { fetchBuckets } from "@/lib/api/services/buckets.service";
import { fetchVolunteers } from "@/lib/api/services/volunteers.service";
import {
  fetchSlotClasses,
  createSlotClass,
  updateSlotClass,
  deleteSlotClass,
} from "@/lib/api/services/slot_classes.service";
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
  };
}

const VOLUNTEER_ASHA = makeVolunteer(1, "Asha Kumar");
const VOLUNTEER_KIRAN = makeVolunteer(2, "Kiran Rao");

const SCS_FULL: SlotClassItem = {
  slotClassSectionId: 100,
  classSectionId: 10,
  sectionName: "group_alpha",
  sectionDisplayName: "Group Alpha",
  subjectName: "Foundation",
  volunteers: [{ userId: 1, userDisplayName: "Asha Kumar", userRole: "CHO" }],
  activeChildrenCount: 5,
};

const SCS_NEAR_FULL_NO_VOLUNTEERS: SlotClassItem = {
  slotClassSectionId: 101,
  classSectionId: 11,
  sectionName: "group_beta",
  sectionDisplayName: null,
  subjectName: "Foundation",
  volunteers: [],
  activeChildrenCount: 4,
};

const SCS_LOW: SlotClassItem = {
  slotClassSectionId: 102,
  classSectionId: 12,
  sectionName: "group_gamma",
  sectionDisplayName: "Group Gamma",
  subjectName: "Foundation",
  volunteers: [],
  activeChildrenCount: 1,
};

const BUCKET_DELTA: BucketItem = {
  classSectionId: 20,
  sectionName: "group_delta",
  sectionDisplayName: "Group Delta",
  activeChildrenCount: 5,
};

const CREATED_SCS: SlotClassItem = {
  slotClassSectionId: 200,
  classSectionId: 20,
  sectionName: "group_delta",
  sectionDisplayName: "Group Delta",
  subjectName: "Foundation",
  volunteers: [{ userId: 1, userDisplayName: "Asha Kumar", userRole: "CHO" }],
  activeChildrenCount: 5,
};

const UPDATED_SCS: SlotClassItem = {
  ...SCS_FULL,
  volunteers: [
    { userId: 1, userDisplayName: "Asha Kumar", userRole: "CHO" },
    { userId: 2, userDisplayName: "Kiran Rao", userRole: "CHO" },
  ],
};

async function selectBucket(name: string) {
  await userEvent.click(screen.getByText(name));
}

async function selectVolunteer(name: string) {
  const input = screen.getByPlaceholderText("Select volunteers");
  await userEvent.click(input);
  await userEvent.click(await screen.findByRole("option", { name: new RegExp(name) }));
}

describe("SlotDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchBuckets).mockResolvedValue([BUCKET_DELTA]);
    const volunteerResponse: VolunteerListResponse = {
      status: "ok",
      volunteers: [VOLUNTEER_ASHA, VOLUNTEER_KIRAN],
    };
    vi.mocked(fetchVolunteers).mockResolvedValue(volunteerResponse);
  });

  it("test_shows_loading_spinner_then_renders_slot_class_card", async () => {
    let resolveFetch!: (value: SlotClassItem[]) => void;
    vi.mocked(fetchSlotClasses).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(
      <SlotDetail slot={SLOT} schoolId={580} canModify={true} onSlotClassCountChange={noop} />
    );

    expect(document.querySelector(".MuiCircularProgress-root")).toBeInTheDocument();

    resolveFetch([SCS_FULL]);

    await waitFor(() => expect(screen.getByText("Group Alpha")).toBeInTheDocument());
    expect(document.querySelector(".MuiCircularProgress-root")).not.toBeInTheDocument();
    expect(screen.getByText("Foundation")).toBeInTheDocument();
    expect(screen.getByText("5/5 children")).toBeInTheDocument();
    expect(screen.getByText("Asha Kumar")).toBeInTheDocument();
  });

  it("test_capacity_colors_and_fallback_name_and_no_volunteers_branch", async () => {
    vi.mocked(fetchSlotClasses).mockResolvedValue([SCS_FULL, SCS_NEAR_FULL_NO_VOLUNTEERS, SCS_LOW]);

    render(
      <SlotDetail slot={SLOT} schoolId={580} canModify={true} onSlotClassCountChange={noop} />
    );

    await waitFor(() => expect(screen.getByText("Group Alpha")).toBeInTheDocument());

    // sectionDisplayName null -> falls back to sectionName
    expect(screen.getByText("group_beta")).toBeInTheDocument();
    expect(screen.getByText("4/5 children")).toBeInTheDocument();
    expect(screen.getByText("Group Gamma")).toBeInTheDocument();
    expect(screen.getByText("1/5 children")).toBeInTheDocument();
  });

  it("test_canModify_true_empty_state_shows_add_first_class_prompt", async () => {
    vi.mocked(fetchSlotClasses).mockResolvedValue([]);

    render(
      <SlotDetail slot={SLOT} schoolId={580} canModify={true} onSlotClassCountChange={noop} />
    );

    await waitFor(() => expect(screen.getByText("Add first class assignment")).toBeInTheDocument());
    expect(screen.queryByText("No classes assigned yet.")).not.toBeInTheDocument();
  });

  it("test_canModify_false_empty_state_shows_no_classes_message", async () => {
    vi.mocked(fetchSlotClasses).mockResolvedValue([]);

    render(
      <SlotDetail slot={SLOT} schoolId={580} canModify={false} onSlotClassCountChange={noop} />
    );

    await waitFor(() => expect(screen.getByText("No classes assigned yet.")).toBeInTheDocument());
    expect(screen.queryByText("Add first class assignment")).not.toBeInTheDocument();
  });

  it("test_canModify_false_with_classes_hides_edit_and_delete_buttons", async () => {
    vi.mocked(fetchSlotClasses).mockResolvedValue([SCS_FULL]);

    render(
      <SlotDetail slot={SLOT} schoolId={580} canModify={false} onSlotClassCountChange={noop} />
    );

    await waitFor(() => expect(screen.getByText("Group Alpha")).toBeInTheDocument());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("Add another class")).not.toBeInTheDocument();
  });

  it("test_canModify_true_with_classes_shows_add_another_class_prompt", async () => {
    vi.mocked(fetchSlotClasses).mockResolvedValue([SCS_FULL]);

    render(
      <SlotDetail slot={SLOT} schoolId={580} canModify={true} onSlotClassCountChange={noop} />
    );

    await waitFor(() => expect(screen.getByText("Add another class")).toBeInTheDocument());
  });

  it("test_load_failure_shows_error_toast_and_empty_list", async () => {
    vi.mocked(fetchSlotClasses).mockRejectedValue(new Error("network down"));

    render(
      <SlotDetail slot={SLOT} schoolId={580} canModify={true} onSlotClassCountChange={noop} />
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to load class assignments.")
    );
    expect(screen.getByText("Add first class assignment")).toBeInTheDocument();
  });

  it("test_clicking_add_first_class_opens_add_slot_class_modal", async () => {
    vi.mocked(fetchSlotClasses).mockResolvedValue([]);

    render(
      <SlotDetail slot={SLOT} schoolId={580} canModify={true} onSlotClassCountChange={noop} />
    );

    await waitFor(() => expect(screen.getByText("Add first class assignment")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Add first class assignment"));

    expect(await screen.findByText("Assign Class to Slot")).toBeInTheDocument();
    expect(screen.getByText("Monday 09:00")).toBeInTheDocument();
  });

  it("test_full_add_flow_appends_card_and_increments_count", async () => {
    vi.mocked(fetchSlotClasses).mockResolvedValue([]);
    vi.mocked(createSlotClass).mockResolvedValue(CREATED_SCS);
    const onSlotClassCountChange = vi.fn();

    render(
      <SlotDetail
        slot={SLOT}
        schoolId={580}
        canModify={true}
        onSlotClassCountChange={onSlotClassCountChange}
      />
    );

    await waitFor(() => expect(screen.getByText("Add first class assignment")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Add first class assignment"));

    await waitFor(() => expect(screen.getByText("Group Delta")).toBeInTheDocument());
    await selectBucket("Group Delta");
    await selectVolunteer("Asha Kumar");

    await userEvent.click(screen.getByRole("button", { name: /Assign Class/ }));

    await waitFor(() => {
      expect(createSlotClass).toHaveBeenCalledWith(580, 1, {
        class_section_id: 20,
        volunteer_ids: [1],
      });
    });
    expect(onSlotClassCountChange).toHaveBeenCalledWith(1);
    expect(toast.success).toHaveBeenCalledWith("Class assigned to slot.");
    await waitFor(() => expect(screen.getAllByText("Group Delta").length).toBeGreaterThan(0));
  });

  it("test_edit_flow_updates_volunteers_without_count_change", async () => {
    vi.mocked(fetchSlotClasses).mockResolvedValue([SCS_FULL]);
    vi.mocked(updateSlotClass).mockResolvedValue(UPDATED_SCS);
    const onSlotClassCountChange = vi.fn();

    render(
      <SlotDetail
        slot={SLOT}
        schoolId={580}
        canModify={true}
        onSlotClassCountChange={onSlotClassCountChange}
      />
    );

    await waitFor(() => expect(screen.getByText("Group Alpha")).toBeInTheDocument());

    const editButtons = screen.getAllByRole("button");
    const editButton = editButtons[0];
    await userEvent.click(editButton);

    expect(await screen.findByText("Edit Volunteers")).toBeInTheDocument();
    await selectVolunteer("Kiran Rao");

    await userEvent.click(screen.getByRole("button", { name: /Save/ }));

    await waitFor(() => {
      expect(updateSlotClass).toHaveBeenCalledWith(580, 1, 100, { volunteer_ids: [1, 2] });
    });
    expect(toast.success).toHaveBeenCalledWith("Volunteers updated.");
    expect(onSlotClassCountChange).not.toHaveBeenCalled();
  });

  it("test_delete_flow_removes_card_and_decrements_count", async () => {
    vi.mocked(fetchSlotClasses).mockResolvedValue([SCS_FULL]);
    vi.mocked(deleteSlotClass).mockResolvedValue({ slotClassSectionId: 100, deleted: true });
    const onSlotClassCountChange = vi.fn();

    render(
      <SlotDetail
        slot={SLOT}
        schoolId={580}
        canModify={true}
        onSlotClassCountChange={onSlotClassCountChange}
      />
    );

    await waitFor(() => expect(screen.getByText("Group Alpha")).toBeInTheDocument());

    const buttons = screen.getAllByRole("button");
    const deleteButton = buttons[1];
    await userEvent.click(deleteButton);

    expect(await screen.findByText("Remove Class Assignment")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Remove/ }));

    await waitFor(() => {
      expect(deleteSlotClass).toHaveBeenCalledWith(580, 1, 100);
    });
    expect(onSlotClassCountChange).toHaveBeenCalledWith(-1);
    expect(toast.success).toHaveBeenCalledWith("Class assignment removed.");
    await waitFor(() => expect(screen.queryByText("Group Alpha")).not.toBeInTheDocument());
  });
});
