import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditChildDrawer } from "@/components/schools/children/EditChildDrawer";
import type { SchoolClassItem } from "@/lib/api/services/structure.service";
import type { BucketItem } from "@/lib/api/services/buckets.service";
import type { ChildItem } from "@/lib/api/services/children.service";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api/services/structure.service", () => ({
  fetchSchoolClasses: vi.fn(),
  filterAssignableClasses: (classes: SchoolClassItem[]) =>
    classes.filter((c) => c.classCode !== "8"),
}));

vi.mock("@/lib/api/services/buckets.service", () => ({
  fetchBuckets: vi.fn(),
}));

vi.mock("@/lib/api/services/children.service", () => ({
  updateChild: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { fetchSchoolClasses } from "@/lib/api/services/structure.service";
import { fetchBuckets } from "@/lib/api/services/buckets.service";
import { updateChild } from "@/lib/api/services/children.service";
import toast from "react-hot-toast";

const noop = () => {};

const CLASS_5: SchoolClassItem = {
  schoolClassId: 1,
  gradeClassId: 5,
  className: "Grade 5",
  classCode: "G5",
  programName: "Foundation",
  sectionsCount: 0,
  sections: [],
};
const CLASS_6: SchoolClassItem = {
  schoolClassId: 2,
  gradeClassId: 6,
  className: "Grade 6",
  classCode: "G6",
  programName: "Foundation",
  sectionsCount: 0,
  sections: [],
};

const CLASS_8: SchoolClassItem = {
  schoolClassId: 8,
  gradeClassId: 8,
  className: "Grade 8",
  classCode: "8",
  programName: "Foundation",
  sectionsCount: 0,
  sections: [],
};

const BUCKET_1: BucketItem = {
  classSectionId: 10,
  sectionName: "group_1",
  sectionDisplayName: "Group 1",
  activeChildrenCount: 2,
};

const CHILD_WITH_BUCKET: ChildItem = {
  childId: 100,
  firstName: "Asha",
  lastName: "Kumar",
  gender: "female",
  age: 10,
  city: null,
  motherTongue: null,
  dateOfBirth: null,
  dateOfEnrollment: null,
  madJoiningDate: null,
  isActive: true,
  currentSection: { classSectionId: 10, sectionDisplayName: "Group 1", sectionName: "group_1" },
  currentSchoolClass: { schoolClassId: 1, className: "Grade 5" },
};

const CHILD_NO_BUCKET: ChildItem = {
  ...CHILD_WITH_BUCKET,
  currentSection: null,
};

describe("EditChildDrawer — F-M6-7", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSchoolClasses).mockResolvedValue([CLASS_5, CLASS_6]);
    vi.mocked(fetchBuckets).mockResolvedValue([BUCKET_1]);
  });

  it("test_class_8_hidden_from_picker_when_child_not_already_in_it", async () => {
    vi.mocked(fetchSchoolClasses).mockResolvedValue([CLASS_5, CLASS_6, CLASS_8]);

    render(
      <EditChildDrawer
        open={true}
        schoolId={580}
        child={CHILD_WITH_BUCKET}
        onClose={noop}
        onSuccess={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Grade 5")).toBeInTheDocument());
    expect(screen.queryByText("Grade 8")).not.toBeInTheDocument();
  });

  it("test_class_8_still_shown_when_it_is_the_childs_current_class", async () => {
    vi.mocked(fetchSchoolClasses).mockResolvedValue([CLASS_5, CLASS_6, CLASS_8]);
    const childInClass8: ChildItem = {
      ...CHILD_WITH_BUCKET,
      currentSchoolClass: { schoolClassId: 8, className: "Grade 8" },
    };

    render(
      <EditChildDrawer
        open={true}
        schoolId={580}
        child={childInClass8}
        onClose={noop}
        onSuccess={noop}
      />
    );

    // Editing this child (e.g. their bucket, or unrelated fields) must not
    // hide the class they're already sitting in.
    await waitFor(() => expect(screen.getByText("Grade 8")).toBeInTheDocument());
  });

  it("test_prepopulates_class_and_bucket_from_nested_shape", async () => {
    render(
      <EditChildDrawer
        open={true}
        schoolId={580}
        child={CHILD_WITH_BUCKET}
        onClose={noop}
        onSuccess={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Grade 5")).toBeInTheDocument());

    // Grade 5 chip and Group 1 bucket tile both render as selected (no error)
    expect(screen.getByText("Group 1")).toBeInTheDocument();
  });

  it("test_changing_class_alone_sends_only_school_class_id", async () => {
    vi.mocked(updateChild).mockResolvedValue(CHILD_WITH_BUCKET);

    render(
      <EditChildDrawer
        open={true}
        schoolId={580}
        child={CHILD_WITH_BUCKET}
        onClose={noop}
        onSuccess={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Grade 6")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Grade 6"));

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateChild).toHaveBeenCalledWith(
        580,
        100,
        expect.objectContaining({ school_class_id: 2 })
      );
    });
    const payload = vi.mocked(updateChild).mock.calls[0][2];
    expect(payload).not.toHaveProperty("class_section_id");
  });

  it("test_clearing_bucket_sends_explicit_null", async () => {
    vi.mocked(updateChild).mockResolvedValue(CHILD_WITH_BUCKET);

    render(
      <EditChildDrawer
        open={true}
        schoolId={580}
        child={CHILD_WITH_BUCKET}
        onClose={noop}
        onSuccess={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Unassigned")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Unassigned"));

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateChild).toHaveBeenCalledWith(
        580,
        100,
        expect.objectContaining({ class_section_id: null })
      );
    });
    const payload = vi.mocked(updateChild).mock.calls[0][2];
    expect(payload).not.toHaveProperty("school_class_id");
  });

  it("test_no_changes_omits_both_class_and_bucket_fields", async () => {
    vi.mocked(updateChild).mockResolvedValue(CHILD_WITH_BUCKET);

    render(
      <EditChildDrawer
        open={true}
        schoolId={580}
        child={CHILD_WITH_BUCKET}
        onClose={noop}
        onSuccess={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Group 1")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateChild).toHaveBeenCalled());
    const payload = vi.mocked(updateChild).mock.calls[0][2];
    expect(payload).not.toHaveProperty("school_class_id");
    expect(payload).not.toHaveProperty("class_section_id");
  });

  it("test_gender_picker_selecting_option_updates_value", async () => {
    vi.mocked(updateChild).mockResolvedValue(CHILD_WITH_BUCKET);

    render(
      <EditChildDrawer
        open={true}
        schoolId={580}
        child={CHILD_WITH_BUCKET}
        onClose={noop}
        onSuccess={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Grade 5")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Male"));

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateChild).toHaveBeenCalledWith(
        580,
        100,
        expect.objectContaining({ gender: "male" })
      );
    });
  });

  it("test_class_picker_shows_no_classes_message_when_school_has_no_classes", async () => {
    vi.mocked(fetchSchoolClasses).mockResolvedValueOnce([]);

    render(
      <EditChildDrawer
        open={true}
        schoolId={580}
        child={CHILD_WITH_BUCKET}
        onClose={noop}
        onSuccess={noop}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("No classes added to this school yet.")).toBeInTheDocument()
    );
  });

  it("test_bucket_picker_shows_skeletons_while_loading_then_buckets_after", async () => {
    let resolveBuckets!: (v: BucketItem[]) => void;
    vi.mocked(fetchBuckets).mockImplementation(
      () =>
        new Promise((res) => {
          resolveBuckets = res;
        })
    );

    render(
      <EditChildDrawer
        open={true}
        schoolId={580}
        child={CHILD_WITH_BUCKET}
        onClose={noop}
        onSuccess={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Grade 5")).toBeInTheDocument());
    expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();

    resolveBuckets([BUCKET_1]);

    await waitFor(() => expect(screen.getByText("Unassigned")).toBeInTheDocument());
  });

  it("test_selecting_a_specific_bucket_tile_marks_bucket_changed", async () => {
    render(
      <EditChildDrawer
        open={true}
        schoolId={580}
        child={CHILD_NO_BUCKET}
        onClose={noop}
        onSuccess={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Unassigned")).toBeInTheDocument());
    expect(
      screen.queryByText("Moving to a different bucket will preserve full assignment history.")
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Group 1"));

    await waitFor(() =>
      expect(
        screen.getByText("Moving to a different bucket will preserve full assignment history.")
      ).toBeInTheDocument()
    );
  });

  it("test_classes_load_failure_shows_toast_error", async () => {
    vi.mocked(fetchSchoolClasses).mockRejectedValueOnce(new Error("network fail"));

    render(
      <EditChildDrawer
        open={true}
        schoolId={580}
        child={CHILD_WITH_BUCKET}
        onClose={noop}
        onSuccess={noop}
      />
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not load classes"));
  });

  it("test_buckets_load_failure_shows_toast_error", async () => {
    vi.mocked(fetchBuckets).mockRejectedValueOnce(new Error("network fail"));

    render(
      <EditChildDrawer
        open={true}
        schoolId={580}
        child={CHILD_WITH_BUCKET}
        onClose={noop}
        onSuccess={noop}
      />
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Could not load mentoring circles")
    );
  });

  it("test_submit_failure_shows_error_toast_with_message", async () => {
    vi.mocked(updateChild).mockRejectedValueOnce(new Error("Custom failure message"));

    render(
      <EditChildDrawer
        open={true}
        schoolId={580}
        child={CHILD_WITH_BUCKET}
        onClose={noop}
        onSuccess={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Grade 5")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Custom failure message"));
  });

  it("test_age_field_input_updates_value_and_included_in_payload", async () => {
    vi.mocked(updateChild).mockResolvedValue(CHILD_WITH_BUCKET);

    render(
      <EditChildDrawer
        open={true}
        schoolId={580}
        child={CHILD_WITH_BUCKET}
        onClose={noop}
        onSuccess={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Grade 5")).toBeInTheDocument());

    const ageInput = screen.getByRole("spinbutton");
    fireEvent.change(ageInput, { target: { value: "15" } });
    expect(ageInput).toHaveValue(15);

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateChild).toHaveBeenCalledWith(580, 100, expect.objectContaining({ age: 15 }));
    });
  });
});
