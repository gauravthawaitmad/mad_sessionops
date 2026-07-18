import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BucketCard } from "@/components/schools/structure/BucketCard";
import type { BucketItem } from "@/lib/api/services/buckets.service";
import type { ChildItem } from "@/lib/api/services/children.service";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api/services/buckets.service", () => ({
  removeBucket: vi.fn(),
  editBucket: vi.fn(),
  addChildToBucket: vi.fn(),
  removeChildFromBucket: vi.fn(),
}));

vi.mock("@/lib/api/services/children.service", () => ({
  fetchChildren: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/toast/toast", () => ({
  showApiError: vi.fn(),
  showSuccess: vi.fn(),
}));

const MOCK_BUCKET: BucketItem = {
  classSectionId: 7,
  sectionName: "group_1",
  sectionDisplayName: "Group 1",
  activeChildrenCount: 2,
};

const EMPTY_BUCKET: BucketItem = {
  classSectionId: 8,
  sectionName: "group_2",
  sectionDisplayName: "Group 2",
  activeChildrenCount: 0,
};

function makeChild(id: number, firstName: string, lastName: string): ChildItem {
  return {
    childId: id,
    firstName,
    lastName,
    gender: "other",
    age: 10,
    city: null,
    motherTongue: null,
    dateOfBirth: null,
    dateOfEnrollment: null,
    madJoiningDate: null,
    isActive: true,
    currentSchoolClass: { schoolClassId: 1, className: "Class 1" },
    currentSection: { classSectionId: 7, sectionDisplayName: "Group 1", sectionName: "group_1" },
  };
}

const noop = () => {};

describe("BucketCard — UX polish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("test_renders_display_name_and_count_badge", () => {
    render(<BucketCard bucket={MOCK_BUCKET} schoolId={580} onUpdated={noop} onRemoved={noop} />);

    expect(screen.getByText("Group 1")).toBeInTheDocument();
    expect(screen.getByText("2/5 children")).toBeInTheDocument();
  });

  it("test_no_class_label_rendered_anywhere", () => {
    render(<BucketCard bucket={MOCK_BUCKET} schoolId={580} onUpdated={noop} onRemoved={noop} />);

    expect(screen.queryByText(/Mixed/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("class-chip")).not.toBeInTheDocument();
  });

  it("test_shows_full_label_at_capacity", () => {
    render(
      <BucketCard
        bucket={{ ...MOCK_BUCKET, activeChildrenCount: 5 }}
        schoolId={580}
        onUpdated={noop}
        onRemoved={noop}
      />
    );

    expect(screen.getByText("Full · 5/5")).toBeInTheDocument();
  });

  it("test_clicking_card_opens_manage_children_modal", async () => {
    render(<BucketCard bucket={MOCK_BUCKET} schoolId={580} onUpdated={noop} onRemoved={noop} />);

    await userEvent.click(screen.getByRole("button", { name: "View Group 1" }));

    await waitFor(() => {
      expect(screen.getByText("Manage Children")).toBeInTheDocument();
    });
  });

  it("test_avatar_stack_shows_roster_preview", () => {
    const roster = [makeChild(1, "Asha", "Kumar"), makeChild(2, "Kiran", "Rao")];
    render(
      <BucketCard
        bucket={MOCK_BUCKET}
        schoolId={580}
        roster={roster}
        onUpdated={noop}
        onRemoved={noop}
      />
    );

    expect(screen.getByLabelText("Asha Kumar")).toBeInTheDocument();
    expect(screen.getByLabelText("Kiran Rao")).toBeInTheDocument();
  });

  it("test_avatar_stack_shows_overflow_count", () => {
    const roster = [1, 2, 3, 4, 5].map((i) => makeChild(i, `Child${i}`, "Test"));
    render(
      <BucketCard
        bucket={{ ...MOCK_BUCKET, activeChildrenCount: 5 }}
        schoolId={580}
        roster={roster}
        onUpdated={noop}
        onRemoved={noop}
      />
    );

    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("test_menu_opens_with_manage_edit_delete_options", async () => {
    render(<BucketCard bucket={MOCK_BUCKET} schoolId={580} onUpdated={noop} onRemoved={noop} />);

    await userEvent.click(screen.getByRole("button", { name: "Bucket options" }));

    await waitFor(() => {
      expect(screen.getByText("Manage Children")).toBeInTheDocument();
      expect(screen.getByText("Edit")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });
  });

  it("test_delete_disabled_when_bucket_has_children", async () => {
    render(<BucketCard bucket={MOCK_BUCKET} schoolId={580} onUpdated={noop} onRemoved={noop} />);

    await userEvent.click(screen.getByRole("button", { name: "Bucket options" }));

    await waitFor(() => {
      expect(screen.getByText("Delete").closest("li")).toHaveAttribute("aria-disabled", "true");
    });
  });

  it("test_delete_enabled_when_bucket_is_empty", async () => {
    render(<BucketCard bucket={EMPTY_BUCKET} schoolId={580} onUpdated={noop} onRemoved={noop} />);

    await userEvent.click(screen.getByRole("button", { name: "Bucket options" }));

    await waitFor(() => {
      expect(screen.getByText("Delete").closest("li")).not.toHaveAttribute("aria-disabled", "true");
    });
  });

  it("test_menu_hidden_when_cannot_modify", () => {
    render(
      <BucketCard
        bucket={MOCK_BUCKET}
        schoolId={580}
        canModify={false}
        onUpdated={noop}
        onRemoved={noop}
      />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("test_card_not_clickable_when_cannot_modify", () => {
    render(
      <BucketCard
        bucket={MOCK_BUCKET}
        schoolId={580}
        canModify={false}
        onUpdated={noop}
        onRemoved={noop}
      />
    );

    expect(screen.queryByRole("button", { name: /View/ })).not.toBeInTheDocument();
  });
});
