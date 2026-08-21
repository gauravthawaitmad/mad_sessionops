import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SlotGridView } from "@/components/schools/slots/SlotGridView";
import type { BucketItem } from "@/lib/api/services/buckets.service";
import type { SlotClassItem } from "@/lib/api/services/slot_classes.service";
import type { SlotItem } from "@/lib/api/services/slots.service";
import type { VolunteerCard } from "@/lib/api/services/volunteers.service";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api/services/buckets.service", () => ({
  fetchBuckets: vi.fn(),
}));

vi.mock("@/lib/api/services/slot_classes.service", () => ({
  fetchSlotClasses: vi.fn(),
  createSlotClass: vi.fn(),
  updateSlotClass: vi.fn(),
  deleteSlotClass: vi.fn(),
}));

vi.mock("@/lib/api/services/volunteers.service", () => ({
  fetchVolunteers: vi.fn().mockResolvedValue({ status: "ok", volunteers: [] }),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { fetchBuckets } from "@/lib/api/services/buckets.service";
import {
  fetchSlotClasses,
  createSlotClass,
  updateSlotClass,
  deleteSlotClass,
} from "@/lib/api/services/slot_classes.service";
import { fetchVolunteers } from "@/lib/api/services/volunteers.service";
import toast from "react-hot-toast";

const noop = () => {};

const SLOT: SlotItem = {
  slotId: 1,
  slotName: "Monday 09:00",
  dayOfWeek: "monday",
  startTime: "09:00:00",
  endTime: "10:00:00",
  recurring: true,
  slotClassCount: 1,
};

const BUCKET: BucketItem = {
  classSectionId: 10,
  sectionName: "group_1",
  sectionDisplayName: "Group 1",
  activeChildrenCount: 3,
};

const ASSIGNED_SCS: SlotClassItem = {
  slotClassSectionId: 100,
  classSectionId: 10,
  sectionName: "group_1",
  sectionDisplayName: "Group 1",
  subjectName: "Foundation",
  volunteers: [{ userId: 1, userDisplayName: "Asha Kumar", userRole: "CHO" }],
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

const VOLUNTEERS: VolunteerCard[] = [makeVolunteer(1, "Asha Kumar"), makeVolunteer(2, "Kiran Rao")];

async function selectVolunteer(name: string) {
  const input = screen.getByPlaceholderText("Select volunteers");
  await userEvent.click(input);
  await userEvent.click(await screen.findByRole("option", { name: new RegExp(name) }));
}

describe("SlotGridView — F-M6-8", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("test_flat_bucket_rows_no_class_grouping", async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([BUCKET]);
    vi.mocked(fetchSlotClasses).mockResolvedValue([]);

    render(
      <SlotGridView
        schoolId={580}
        slots={[SLOT]}
        canModify={true}
        onCountChange={noop}
        onEditSlot={noop}
        onDeleteSlot={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Group 1")).toBeInTheDocument();
    });
    // "Mentoring Circle" column header, not the old class-grouped "Section" header
    expect(screen.getByText("Mentoring Circle")).toBeInTheDocument();
  });

  it("test_assigned_cell_shows_no_subject_pill", async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([BUCKET]);
    vi.mocked(fetchSlotClasses).mockResolvedValue([ASSIGNED_SCS]);

    render(
      <SlotGridView
        schoolId={580}
        slots={[SLOT]}
        canModify={true}
        onCountChange={noop}
        onEditSlot={noop}
        onDeleteSlot={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Asha")).toBeInTheDocument();
    });
    expect(screen.queryByText("Foundation")).not.toBeInTheDocument();
  });

  it("test_empty_state_when_no_buckets", async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([]);
    vi.mocked(fetchSlotClasses).mockResolvedValue([]);

    render(
      <SlotGridView
        schoolId={580}
        slots={[SLOT]}
        canModify={true}
        onCountChange={noop}
        onEditSlot={noop}
        onDeleteSlot={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/No mentoring circles configured yet/)).toBeInTheDocument();
    });
  });

  it("test_load_failure_shows_toast_error", async () => {
    vi.mocked(fetchBuckets).mockRejectedValue(new Error("network down"));
    vi.mocked(fetchSlotClasses).mockResolvedValue([]);

    render(
      <SlotGridView
        schoolId={580}
        slots={[SLOT]}
        canModify={true}
        onCountChange={noop}
        onEditSlot={noop}
        onDeleteSlot={noop}
      />
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load schedule grid.");
    });
    // buckets state stays empty on failure — grid falls back to the empty state
    expect(screen.getByText(/No mentoring circles configured yet/)).toBeInTheDocument();
  });

  it("test_slot_header_edit_and_delete_buttons_invoke_callbacks", async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([]);
    vi.mocked(fetchSlotClasses).mockResolvedValue([]);
    const onEditSlot = vi.fn();
    const onDeleteSlot = vi.fn();

    render(
      <SlotGridView
        schoolId={580}
        slots={[SLOT]}
        canModify={true}
        onCountChange={noop}
        onEditSlot={onEditSlot}
        onDeleteSlot={onDeleteSlot}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/No mentoring circles configured yet/)).toBeInTheDocument();
    });

    // No buckets/assignments rendered here, so the only buttons in the DOM are
    // the slot column header's edit (0) and delete (1) icon buttons.
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);

    await userEvent.click(buttons[0]);
    expect(onEditSlot).toHaveBeenCalledWith(SLOT);

    await userEvent.click(buttons[1]);
    expect(onDeleteSlot).toHaveBeenCalledWith(SLOT);
  });

  it("test_empty_cell_not_interactive_when_cannot_modify", async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([BUCKET]);
    vi.mocked(fetchSlotClasses).mockResolvedValue([]);

    const { container } = render(
      <SlotGridView
        schoolId={580}
        slots={[SLOT]}
        canModify={false}
        onCountChange={noop}
        onEditSlot={noop}
        onDeleteSlot={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Group 1")).toBeInTheDocument();
    });

    // canModify=false hides the slot-header buttons and the empty-cell "+" hint
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(container.querySelector(".lucide-plus")).toBeNull();
  });

  it("test_full_add_flow_updates_state_and_notifies_parent", async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([BUCKET]);
    vi.mocked(fetchSlotClasses).mockResolvedValue([]);
    vi.mocked(fetchVolunteers).mockResolvedValue({ status: "ok", volunteers: VOLUNTEERS });
    vi.mocked(createSlotClass).mockResolvedValue({
      slotClassSectionId: 200,
      classSectionId: BUCKET.classSectionId,
      sectionName: BUCKET.sectionName,
      sectionDisplayName: BUCKET.sectionDisplayName,
      subjectName: "Foundation",
      volunteers: [{ userId: 1, userDisplayName: "Asha Kumar", userRole: "CHO" }],
      activeChildrenCount: BUCKET.activeChildrenCount,
    });
    const onCountChange = vi.fn();

    const { container } = render(
      <SlotGridView
        schoolId={580}
        slots={[SLOT]}
        canModify={true}
        onCountChange={onCountChange}
        onEditSlot={noop}
        onDeleteSlot={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Group 1")).toBeInTheDocument();
    });

    // Empty cell is a plain Box (not a button role) — target its "+" icon directly.
    const plusIcon = container.querySelector(".lucide-plus");
    expect(plusIcon).not.toBeNull();
    await userEvent.click(plusIcon!);

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Select volunteers")).toBeInTheDocument()
    );
    await selectVolunteer("Asha Kumar");
    await userEvent.click(screen.getByRole("button", { name: /Assign Class/ }));

    await waitFor(() => {
      expect(createSlotClass).toHaveBeenCalledWith(580, 1, {
        class_section_id: BUCKET.classSectionId,
        volunteer_ids: [1],
      });
    });
    expect(onCountChange).toHaveBeenCalledWith(1, 1);
    expect(toast.success).toHaveBeenCalledWith("Class assigned.");
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
  });

  it("test_full_edit_flow_updates_state_and_notifies_parent", async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([BUCKET]);
    vi.mocked(fetchSlotClasses).mockResolvedValue([ASSIGNED_SCS]);
    vi.mocked(fetchVolunteers).mockResolvedValue({ status: "ok", volunteers: VOLUNTEERS });
    vi.mocked(updateSlotClass).mockResolvedValue({
      ...ASSIGNED_SCS,
      volunteers: [
        { userId: 1, userDisplayName: "Asha Kumar", userRole: "CHO" },
        { userId: 2, userDisplayName: "Kiran Rao", userRole: "CHO" },
      ],
    });

    render(
      <SlotGridView
        schoolId={580}
        slots={[SLOT]}
        canModify={true}
        onCountChange={noop}
        onEditSlot={noop}
        onDeleteSlot={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Asha")).toBeInTheDocument();
    });

    // DOM order: [0]=header edit, [1]=header delete, [2]=cell edit, [3]=cell delete
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
    await userEvent.click(buttons[2]);

    await waitFor(() => expect(screen.getByText("Edit Volunteers")).toBeInTheDocument());
    await selectVolunteer("Kiran Rao");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateSlotClass).toHaveBeenCalledWith(580, 1, ASSIGNED_SCS.slotClassSectionId, {
        volunteer_ids: [1, 2],
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Volunteers updated.");
    await waitFor(() => expect(screen.getByText("Kiran")).toBeInTheDocument());
  });

  it("test_full_delete_flow_updates_state_and_notifies_parent", async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([BUCKET]);
    vi.mocked(fetchSlotClasses).mockResolvedValue([ASSIGNED_SCS]);
    vi.mocked(deleteSlotClass).mockResolvedValue({
      slotClassSectionId: ASSIGNED_SCS.slotClassSectionId,
      deleted: true,
    });
    const onCountChange = vi.fn();

    render(
      <SlotGridView
        schoolId={580}
        slots={[SLOT]}
        canModify={true}
        onCountChange={onCountChange}
        onEditSlot={noop}
        onDeleteSlot={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Asha")).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
    await userEvent.click(buttons[3]);

    await waitFor(() => expect(screen.getByText("Remove Class Assignment")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(deleteSlotClass).toHaveBeenCalledWith(580, 1, ASSIGNED_SCS.slotClassSectionId);
    });
    expect(onCountChange).toHaveBeenCalledWith(1, -1);
    expect(toast.success).toHaveBeenCalledWith("Assignment removed.");
    await waitFor(() => expect(screen.queryByText("Asha")).not.toBeInTheDocument());
  });
});
