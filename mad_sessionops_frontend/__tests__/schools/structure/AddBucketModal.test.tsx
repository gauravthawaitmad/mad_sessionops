import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddBucketModal } from "@/components/schools/structure/AddBucketModal";
import type { BucketItem } from "@/lib/api/services/buckets.service";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api/services/buckets.service", () => ({
  createBucket: vi.fn(),
}));

import { createBucket } from "@/lib/api/services/buckets.service";

const noop = () => {};

const MOCK_CREATED: BucketItem = {
  classSectionId: 3,
  sectionName: "care_monster",
  sectionDisplayName: "Care Monster",
  activeChildrenCount: 0,
};

describe("AddBucketModal — F-M6-6", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("test_no_class_dropdown_present", () => {
    render(<AddBucketModal open={true} schoolId={580} onClose={noop} onAdded={noop} />);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/select a class/i)).not.toBeInTheDocument();
    // Exactly one text field: display_name — no class picker alongside it
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("test_empty_submit_shows_zod_error_no_api_call", async () => {
    render(<AddBucketModal open={true} schoolId={580} onClose={noop} onAdded={noop} />);

    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("Bucket name is required")).toBeInTheDocument();
    });
    expect(createBucket).not.toHaveBeenCalled();
  });

  it("test_valid_submit_calls_createBucket_with_display_name", async () => {
    vi.mocked(createBucket).mockResolvedValue(MOCK_CREATED);
    const onAdded = vi.fn();

    render(<AddBucketModal open={true} schoolId={580} onClose={noop} onAdded={onAdded} />);

    await userEvent.type(screen.getByPlaceholderText("e.g. Care Monster"), "Care Monster");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(createBucket).toHaveBeenCalledWith(580, "Care Monster");
      expect(onAdded).toHaveBeenCalledWith(MOCK_CREATED);
    });
  });

  it("test_server_409_slug_collision_displays_verbatim", async () => {
    vi.mocked(createBucket).mockRejectedValue({
      status: 409,
      code: "CONFLICT",
      message: 'A bucket named "Care Monster" already exists at this school.',
    });

    render(<AddBucketModal open={true} schoolId={580} onClose={noop} onAdded={noop} />);

    await userEvent.type(screen.getByPlaceholderText("e.g. Care Monster"), "Care Monster");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(
        screen.getByText('A bucket named "Care Monster" already exists at this school.')
      ).toBeInTheDocument();
    });
  });
});
