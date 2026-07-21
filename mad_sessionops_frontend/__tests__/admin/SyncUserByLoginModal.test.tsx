import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SyncUserByLoginModal } from "@/components/admin/SyncUserByLoginModal";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/api/services/syncAdmin.service", () => ({
  syncUserByLogin: vi.fn(),
}));

import toast from "react-hot-toast";
import { syncUserByLogin } from "@/lib/api/services/syncAdmin.service";

const mockSyncUserByLogin = vi.mocked(syncUserByLogin);

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderModal(overrides?: Partial<React.ComponentProps<typeof SyncUserByLoginModal>>) {
  const onClose = vi.fn();
  const onSyncComplete = vi.fn();
  render(
    <SyncUserByLoginModal
      open={true}
      onClose={onClose}
      onSyncComplete={onSyncComplete}
      {...overrides}
    />
  );
  return { onClose, onSyncComplete };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SyncUserByLoginModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the email input and Sync button", () => {
    renderModal();
    expect(screen.getByLabelText(/login email/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /sync$/i })).toBeTruthy();
  });

  it("shows success toast and closes on 200", async () => {
    mockSyncUserByLogin.mockResolvedValue({
      syncRunId: 42,
      userLogin: "x@test.com",
      userName: "X User",
    });
    const { onClose, onSyncComplete } = renderModal();

    fireEvent.change(screen.getByLabelText(/login email/i), {
      target: { value: "x@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sync$/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("X User"));
      expect(onSyncComplete).toHaveBeenCalled();
    });
  });

  it("shows inline error on 404", async () => {
    mockSyncUserByLogin.mockRejectedValue({ response: { status: 404 } });
    renderModal();

    fireEvent.change(screen.getByLabelText(/login email/i), {
      target: { value: "unknown@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sync$/i }));

    await waitFor(() => {
      expect(screen.getByText(/no user found/i)).toBeTruthy();
    });
  });

  it("shows toast and closes on 409", async () => {
    mockSyncUserByLogin.mockRejectedValue({ response: { status: 409 } });
    const { onClose } = renderModal();

    fireEvent.change(screen.getByLabelText(/login email/i), {
      target: { value: "x@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sync$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Another sync"));
    });
  });
});
