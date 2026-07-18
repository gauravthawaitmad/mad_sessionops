import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditBucketModal } from "@/components/schools/structure/EditBucketModal";
import type { BucketItem } from "@/lib/api/services/buckets.service";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api/services/buckets.service", () => ({
  editBucket: vi.fn(),
}));

import { editBucket } from "@/lib/api/services/buckets.service";

const noop = () => {};

const MOCK_BUCKET: BucketItem = {
  classSectionId: 3,
  sectionName: "group_1",
  sectionDisplayName: "Group 1",
  activeChildrenCount: 2,
};

describe("EditBucketModal — F-M6-6", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("test_prepopulates_current_display_name", () => {
    render(
      <EditBucketModal
        open={true}
        schoolId={580}
        bucket={MOCK_BUCKET}
        onClose={noop}
        onEdited={noop}
      />
    );

    expect(screen.getByDisplayValue("Group 1")).toBeInTheDocument();
  });

  it("test_empty_submit_shows_zod_error_no_api_call", async () => {
    render(
      <EditBucketModal
        open={true}
        schoolId={580}
        bucket={MOCK_BUCKET}
        onClose={noop}
        onEdited={noop}
      />
    );

    await userEvent.clear(screen.getByDisplayValue("Group 1"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Bucket name is required")).toBeInTheDocument();
    });
    expect(editBucket).not.toHaveBeenCalled();
  });

  it("test_valid_submit_calls_editBucket", async () => {
    const updated: BucketItem = {
      ...MOCK_BUCKET,
      sectionName: "group_1_renamed",
      sectionDisplayName: "Group 1 Renamed",
    };
    vi.mocked(editBucket).mockResolvedValue(updated);
    const onEdited = vi.fn();

    render(
      <EditBucketModal
        open={true}
        schoolId={580}
        bucket={MOCK_BUCKET}
        onClose={noop}
        onEdited={onEdited}
      />
    );

    const input = screen.getByDisplayValue("Group 1");
    await userEvent.clear(input);
    await userEvent.type(input, "Group 1 Renamed");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(editBucket).toHaveBeenCalledWith(580, 3, "Group 1 Renamed");
      expect(onEdited).toHaveBeenCalledWith(updated);
    });
  });

  it("test_server_409_slug_collision_displays_verbatim", async () => {
    vi.mocked(editBucket).mockRejectedValue({
      status: 409,
      code: "CONFLICT",
      message: 'A bucket named "Group 2" already exists at this school.',
    });

    render(
      <EditBucketModal
        open={true}
        schoolId={580}
        bucket={MOCK_BUCKET}
        onClose={noop}
        onEdited={noop}
      />
    );

    const input = screen.getByDisplayValue("Group 1");
    await userEvent.clear(input);
    await userEvent.type(input, "Group 2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(
        screen.getByText('A bucket named "Group 2" already exists at this school.')
      ).toBeInTheDocument();
    });
  });
});
