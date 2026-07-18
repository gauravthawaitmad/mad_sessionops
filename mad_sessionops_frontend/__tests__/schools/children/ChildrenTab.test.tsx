import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChildrenTab } from "@/components/schools/children/ChildrenTab";
import type { SchoolClassItem } from "@/lib/api/services/structure.service";
import type { BucketItem } from "@/lib/api/services/buckets.service";
import type { ChildItem } from "@/lib/api/services/children.service";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api/services/structure.service", () => ({
  fetchSchoolClasses: vi.fn(),
}));

vi.mock("@/lib/api/services/buckets.service", () => ({
  fetchBuckets: vi.fn(),
}));

vi.mock("@/lib/api/services/children.service", () => ({
  fetchChildren: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { fetchSchoolClasses } from "@/lib/api/services/structure.service";
import { fetchBuckets } from "@/lib/api/services/buckets.service";
import { fetchChildren } from "@/lib/api/services/children.service";

const MOCK_CLASS: SchoolClassItem = {
  schoolClassId: 1,
  gradeClassId: 5,
  className: "Grade 5",
  classCode: "G5",
  programName: "Foundation",
  sectionsCount: 0,
  sections: [],
};

const MOCK_BUCKET: BucketItem = {
  classSectionId: 10,
  sectionName: "group_1",
  sectionDisplayName: "Group 1",
  activeChildrenCount: 2,
};

function makeChild(id: number, firstName: string, section: ChildItem["currentSection"]): ChildItem {
  return {
    childId: id,
    firstName,
    lastName: "Test",
    gender: "other",
    age: 10,
    city: null,
    motherTongue: null,
    dateOfBirth: null,
    dateOfEnrollment: null,
    madJoiningDate: null,
    isActive: true,
    currentSchoolClass: { schoolClassId: 1, className: "Grade 5" },
    currentSection: section,
  };
}

describe("ChildrenTab — F-M6-7", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSchoolClasses).mockResolvedValue([MOCK_CLASS]);
    vi.mocked(fetchBuckets).mockResolvedValue([MOCK_BUCKET]);
  });

  it("test_bucket_column_renders_display_name", async () => {
    vi.mocked(fetchChildren).mockResolvedValue([
      makeChild(1, "Asha", {
        classSectionId: 10,
        sectionDisplayName: "Group 1",
        sectionName: "group_1",
      }),
    ]);

    render(<ChildrenTab schoolId={580} activeYear="2026-2027" />);

    await waitFor(() => {
      expect(screen.getByText("Group 1")).toBeInTheDocument();
    });
  });

  it("test_bucket_column_renders_unassigned_chip", async () => {
    vi.mocked(fetchChildren).mockResolvedValue([makeChild(1, "Kiran", null)]);

    render(<ChildrenTab schoolId={580} activeYear="2026-2027" />);

    await waitFor(() => {
      expect(screen.getByText("Unassigned")).toBeInTheDocument();
    });
  });

  it("test_bucket_filter_dropdown_options_and_param_wiring", async () => {
    vi.mocked(fetchChildren).mockResolvedValue([
      makeChild(1, "Asha", {
        classSectionId: 10,
        sectionDisplayName: "Group 1",
        sectionName: "group_1",
      }),
    ]);

    render(<ChildrenTab schoolId={580} activeYear="2026-2027" />);

    await waitFor(() => expect(screen.getByText("Group 1")).toBeInTheDocument());

    // Open the bucket filter select and choose "Unassigned"
    const selects = screen.getAllByRole("combobox");
    const bucketSelect = selects[selects.length - 1];
    await userEvent.click(bucketSelect);
    await userEvent.click(await screen.findByRole("option", { name: "Unassigned" }));

    await waitFor(() => {
      const lastCall = vi.mocked(fetchChildren).mock.calls.at(-1);
      expect(lastCall?.[1]).toEqual(expect.objectContaining({ unassigned: true }));
    });
  });

  it("test_bucket_filter_specific_bucket_sends_section_id", async () => {
    vi.mocked(fetchChildren).mockResolvedValue([
      makeChild(1, "Asha", {
        classSectionId: 10,
        sectionDisplayName: "Group 1",
        sectionName: "group_1",
      }),
    ]);

    render(<ChildrenTab schoolId={580} activeYear="2026-2027" />);

    await waitFor(() => expect(screen.getByText("Group 1")).toBeInTheDocument());

    const selects = screen.getAllByRole("combobox");
    const bucketSelect = selects[selects.length - 1];
    await userEvent.click(bucketSelect);
    await userEvent.click(await screen.findByRole("option", { name: "Group 1" }));

    await waitFor(() => {
      const lastCall = vi.mocked(fetchChildren).mock.calls.at(-1);
      expect(lastCall?.[1]).toEqual(expect.objectContaining({ section_id: 10 }));
    });
  });
});
