import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
  usePathname: () => "/admin",
}));

vi.mock("@/lib/redux", () => ({
  useAppSelector: vi.fn(),
  useAppDispatch: () => vi.fn(),
}));

vi.mock("@/lib/api/services/syncAdmin.service", () => ({
  fetchSyncRuns: vi.fn().mockResolvedValue([]),
  fetchAdminStats: vi.fn().mockResolvedValue({
    entityStats: {
      user: { total: 0, active: 0, inactive: 0, removed: 0, lastSuccessfulSync: null },
      partner: { total: 0, active: 0, inactive: 0, removed: 0, lastSuccessfulSync: null },
      partnerWorknode: { total: 0, active: 0, inactive: 0, removed: 0, lastSuccessfulSync: null },
    },
    cronHealth: {
      healthy: false,
      lastSuccessfulSyncAt: null,
      hoursSinceLastSuccess: null,
      nextExpectedRun: null,
      reason: "no_successful_sync_ever",
    },
  }),
  fetchSyncRunDetail: vi.fn(),
}));

import { useAppSelector } from "@/lib/redux";
import AdminRoute from "@/app/admin/page";

const mockUseAppSelector = vi.mocked(useAppSelector);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AdminRoute — /app/admin/page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects non-admin users to /schools", async () => {
    mockUseAppSelector.mockImplementation((selector: (s: any) => any) =>
      selector({ auth: { user: { role: "CO Full Time", name: "Test" }, isInitialized: true } })
    );

    render(<AdminRoute />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/schools");
    });
  });

  it("renders nothing (null) for non-admin users", () => {
    mockUseAppSelector.mockImplementation((selector: (s: any) => any) =>
      selector({ auth: { user: { role: "CHO", name: "CHO User" }, isInitialized: true } })
    );

    const { container } = render(<AdminRoute />);
    expect(container.firstChild).toBeNull();
  });
});
