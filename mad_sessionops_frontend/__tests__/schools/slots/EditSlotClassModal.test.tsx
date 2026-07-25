import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditSlotClassModal } from "@/components/schools/slots/EditSlotClassModal";
import type { VolunteerCard, VolunteerListResponse } from "@/lib/api/services/volunteers.service";
import type { SlotClassItem } from "@/lib/api/services/slot_classes.service";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api/services/slot_classes.service", () => ({
  updateSlotClass: vi.fn(),
}));

vi.mock("@/lib/api/services/volunteers.service", () => ({
  fetchVolunteers: vi.fn(),
}));

vi.mock("@/lib/toast/toast", () => ({
  showApiError: vi.fn(),
}));

import { updateSlotClass } from "@/lib/api/services/slot_classes.service";
import { fetchVolunteers } from "@/lib/api/services/volunteers.service";
import { showApiError } from "@/lib/toast/toast";

const noop = () => {};

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

const VOLUNTEERS: VolunteerCard[] = [
  makeVolunteer(1, "Asha Kumar"),
  makeVolunteer(2, "Kiran Rao"),
  makeVolunteer(3, "Divya Singh"),
  makeVolunteer(4, "Rahul Mehta"),
];

const VOLUNTEER_RESPONSE: VolunteerListResponse = { status: "ok", volunteers: VOLUNTEERS };

const SLOT_CLASS: SlotClassItem = {
  slotClassSectionId: 99,
  classSectionId: 12,
  sectionName: "group_3",
  sectionDisplayName: "Group 3",
  subjectName: "Foundation",
  volunteers: [{ userId: 1, userDisplayName: "Asha Kumar", userRole: "CHO" }],
  activeChildrenCount: 3,
};

const OTHER_SLOT_CLASS: SlotClassItem = {
  slotClassSectionId: 100,
  classSectionId: 13,
  sectionName: "group_4",
  sectionDisplayName: "Group 4",
  subjectName: "Foundation",
  volunteers: [{ userId: 4, userDisplayName: "Rahul Mehta", userRole: "CHO" }],
  activeChildrenCount: 2,
};

const UPDATED_SCS: SlotClassItem = {
  ...SLOT_CLASS,
  volunteers: [
    { userId: 1, userDisplayName: "Asha Kumar", userRole: "CHO" },
    { userId: 2, userDisplayName: "Kiran Rao", userRole: "CHO" },
  ],
};

async function selectVolunteer(name: string) {
  const input = screen.getByPlaceholderText("Select volunteers");
  await userEvent.click(input);
  await userEvent.click(await screen.findByRole("option", { name: new RegExp(name) }));
}

describe("EditSlotClassModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchVolunteers).mockResolvedValue(VOLUNTEER_RESPONSE);
  });

  it("test_returns_null_when_no_slot_class", () => {
    const { container } = render(
      <EditSlotClassModal
        open={true}
        schoolId={580}
        slotId={1}
        slotClass={null}
        existingSlotClasses={[]}
        onClose={noop}
        onUpdated={noop}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("test_prepopulates_current_volunteers_and_bucket_name", async () => {
    render(
      <EditSlotClassModal
        open={true}
        schoolId={580}
        slotId={1}
        slotClass={SLOT_CLASS}
        existingSlotClasses={[SLOT_CLASS]}
        onClose={noop}
        onUpdated={noop}
      />
    );

    expect(screen.getByText("Group 3")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Asha Kumar")).toBeInTheDocument());
    expect(screen.getByText(/1 of 5 selected/)).toBeInTheDocument();
    expect(screen.getByText(/max 3 volunteer/)).toBeInTheDocument();
  });

  it("test_uses_section_name_when_no_display_name", async () => {
    const noDisplayName: SlotClassItem = { ...SLOT_CLASS, sectionDisplayName: null };
    render(
      <EditSlotClassModal
        open={true}
        schoolId={580}
        slotId={1}
        slotClass={noDisplayName}
        existingSlotClasses={[noDisplayName]}
        onClose={noop}
        onUpdated={noop}
      />
    );

    expect(screen.getByText("group_3")).toBeInTheDocument();
  });

  it("test_adding_volunteer_updates_selected_count", async () => {
    render(
      <EditSlotClassModal
        open={true}
        schoolId={580}
        slotId={1}
        slotClass={SLOT_CLASS}
        existingSlotClasses={[SLOT_CLASS]}
        onClose={noop}
        onUpdated={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Asha Kumar")).toBeInTheDocument());
    await selectVolunteer("Kiran Rao");

    await waitFor(() => expect(screen.getByText(/2 of 5 selected/)).toBeInTheDocument());
  });

  it("test_busy_volunteers_from_other_slot_classes_are_excluded_not_self", async () => {
    render(
      <EditSlotClassModal
        open={true}
        schoolId={580}
        slotId={1}
        slotClass={SLOT_CLASS}
        existingSlotClasses={[SLOT_CLASS, OTHER_SLOT_CLASS]}
        onClose={noop}
        onUpdated={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Asha Kumar")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("Select volunteers");
    await userEvent.click(input);

    const rahulOption = await screen.findByRole("option", { name: /Rahul Mehta/ });
    expect(rahulOption).toHaveAttribute("aria-disabled", "true");

    const kiranOption = screen.getByRole("option", { name: /Kiran Rao/ });
    expect(kiranOption).not.toHaveAttribute("aria-disabled", "true");
  });

  it("test_over_capacity_shows_banner_and_disables_submit", async () => {
    render(
      <EditSlotClassModal
        open={true}
        schoolId={580}
        slotId={1}
        slotClass={SLOT_CLASS}
        existingSlotClasses={[SLOT_CLASS]}
        onClose={noop}
        onUpdated={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Asha Kumar")).toBeInTheDocument());
    await selectVolunteer("Kiran Rao");
    await selectVolunteer("Divya Singh");
    await selectVolunteer("Rahul Mehta");

    await waitFor(() => {
      expect(screen.getByText(/Cannot assign 4 volunteers/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });
  });

  it("test_valid_submit_calls_updateSlotClass_with_volunteer_ids_only", async () => {
    vi.mocked(updateSlotClass).mockResolvedValue(UPDATED_SCS);
    const onUpdated = vi.fn();
    const onClose = vi.fn();

    render(
      <EditSlotClassModal
        open={true}
        schoolId={580}
        slotId={1}
        slotClass={SLOT_CLASS}
        existingSlotClasses={[SLOT_CLASS]}
        onClose={onClose}
        onUpdated={onUpdated}
      />
    );

    await waitFor(() => expect(screen.getByText("Asha Kumar")).toBeInTheDocument());
    await selectVolunteer("Kiran Rao");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateSlotClass).toHaveBeenCalledWith(580, 1, 99, {
        volunteer_ids: [1, 2],
      });
      expect(onUpdated).toHaveBeenCalledWith(UPDATED_SCS);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("test_submit_failure_shows_api_error_and_does_not_close", async () => {
    const error = { code: "SERVER_ERROR", message: "boom" };
    vi.mocked(updateSlotClass).mockRejectedValue(error);
    const onClose = vi.fn();
    const onUpdated = vi.fn();

    render(
      <EditSlotClassModal
        open={true}
        schoolId={580}
        slotId={1}
        slotClass={SLOT_CLASS}
        existingSlotClasses={[SLOT_CLASS]}
        onClose={onClose}
        onUpdated={onUpdated}
      />
    );

    await waitFor(() => expect(screen.getByText("Asha Kumar")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(showApiError).toHaveBeenCalledWith(error);
    });
    expect(onUpdated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("test_removing_all_volunteers_disables_submit", async () => {
    render(
      <EditSlotClassModal
        open={true}
        schoolId={580}
        slotId={1}
        slotClass={SLOT_CLASS}
        existingSlotClasses={[SLOT_CLASS]}
        onClose={noop}
        onUpdated={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Asha Kumar")).toBeInTheDocument());

    const deleteIcon = screen.getByTestId("CancelIcon");
    await userEvent.click(deleteIcon);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });
  });

  it("test_cancel_button_calls_onClose", async () => {
    const onClose = vi.fn();
    render(
      <EditSlotClassModal
        open={true}
        schoolId={580}
        slotId={1}
        slotClass={SLOT_CLASS}
        existingSlotClasses={[SLOT_CLASS]}
        onClose={onClose}
        onUpdated={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Asha Kumar")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("test_close_icon_button_calls_onClose", async () => {
    const onClose = vi.fn();
    render(
      <EditSlotClassModal
        open={true}
        schoolId={580}
        slotId={1}
        slotClass={SLOT_CLASS}
        existingSlotClasses={[SLOT_CLASS]}
        onClose={onClose}
        onUpdated={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Asha Kumar")).toBeInTheDocument());

    const buttons = screen.getAllByRole("button");
    const closeIconButton = buttons.find(
      (b) =>
        b.querySelector("svg") &&
        b !== screen.getByRole("button", { name: "Cancel" }) &&
        b !== screen.getByRole("button", { name: "Save" })
    );
    expect(closeIconButton).toBeTruthy();
    await userEvent.click(closeIconButton!);

    expect(onClose).toHaveBeenCalled();
  });
});
