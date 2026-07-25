import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { SchoolListPage } from "@/components/schools/SchoolListPage";
import authReducer from "@/lib/redux/features/auth/authSlice";

function makeStore(preloadedState?: object) {
  return configureStore({ reducer: { auth: authReducer }, preloadedState });
}

function renderWithProvider(ui: React.ReactElement, preloadedState?: object) {
  const store = makeStore(preloadedState);
  return render(<Provider store={store}>{ui}</Provider>);
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRouterPush = vi.fn();

vi.mock("@/lib/api/services/schools.service", () => ({
  fetchSchools: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/schools",
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

import { fetchSchools } from "@/lib/api/services/schools.service";

const MOCK_SUMMARY = {
  totalSchools: 2,
  fullyConfigured: 0,
  childrenEnrolled: 45,
  activeVolunteers: 12,
  academicYear: "2025-26",
};

const MOCK_SCHOOLS = [
  {
    partnerId: 580,
    name: "Govt. High School Shaikpet",
    initials: "GH",
    city: "Hyderabad",
    contactPersonName: "Ramesh Kumar",
    contactPhone: "9876543210",
    coName: "Ipshita Das",
    setupStatus: "not_configured" as const,
    classesCount: 3,
    childrenCount: 25,
    volunteersCount: 5,
    assignmentsCount: 10,
    academicYearLabel: "2026-2027",
    updatedAt: "2026-04-29T10:00:00Z",
  },
  {
    partnerId: 612,
    name: "Municipal School Jubilee Hills",
    initials: "MS",
    city: "Hyderabad",
    contactPersonName: null,
    contactPhone: null,
    coName: "Ipshita Das",
    setupStatus: "not_configured" as const,
    classesCount: 0,
    childrenCount: 20,
    volunteersCount: 7,
    assignmentsCount: 0,
    academicYearLabel: "2026-2027",
    updatedAt: "2026-04-28T08:00:00Z",
  },
];

// ── Tests — F-M1-4 ───────────────────────────────────────────────────────────

describe("SchoolListPage — F-M1-4", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterPush.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("test_schools_page_renders_table_with_data", async () => {
    vi.mocked(fetchSchools).mockResolvedValue({
      schools: MOCK_SCHOOLS,
      summary: MOCK_SUMMARY,
      scopeWarning: null,
    });

    renderWithProvider(<SchoolListPage userName="Ipshita Das" />);

    await waitFor(() => {
      expect(screen.getByText("Govt. High School Shaikpet")).toBeInTheDocument();
    });

    expect(screen.getByText("Municipal School Jubilee Hills")).toBeInTheDocument();

    // Column headers visible
    expect(screen.getByText("School")).toBeInTheDocument();
    expect(screen.getByText("City")).toBeInTheDocument();
    expect(screen.getByText("Children")).toBeInTheDocument();
  });

  it("test_schools_page_shows_empty_state_for_cho", async () => {
    vi.mocked(fetchSchools).mockResolvedValue({
      schools: [],
      summary: { ...MOCK_SUMMARY, totalSchools: 0 },
      scopeWarning: null,
    });

    renderWithProvider(<SchoolListPage userName="Test CHO" />);

    await waitFor(() => {
      expect(screen.getByText("No schools assigned yet")).toBeInTheDocument();
    });

    // Toolbar and table headers are NOT rendered for empty state
    expect(screen.queryByText("School")).not.toBeInTheDocument();
  });

  it("test_schools_page_shows_scope_warning_message_for_cho_with_no_worknode_mapping", async () => {
    vi.mocked(fetchSchools).mockResolvedValue({
      schools: [],
      summary: { ...MOCK_SUMMARY, totalSchools: 0 },
      scopeWarning: {
        code: "no_worknode_mapping",
        message:
          "You are not assigned to any schools or partner. Please contact your community organizer or admin.",
      },
    });

    renderWithProvider(<SchoolListPage userName="Test CHO" />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "You are not assigned to any schools or partner. Please contact your community organizer or admin."
        )
      ).toBeInTheDocument();
    });

    // The scope-warning message replaces the generic empty-state copy
    expect(screen.queryByText("No schools assigned yet")).not.toBeInTheDocument();
    expect(screen.getByText("No schools assigned")).toBeInTheDocument();
  });

  it("test_schools_page_scope_warning_survives_without_redux_login_state", async () => {
    // Simulates a page refresh: redux's login-time scopeWarning is gone,
    // but the schools list endpoint still returns the fresh scope_warning.
    vi.mocked(fetchSchools).mockResolvedValue({
      schools: [],
      summary: { ...MOCK_SUMMARY, totalSchools: 0 },
      scopeWarning: {
        code: "no_worknode_mapping",
        message:
          "You are not assigned to any schools or partner. Please contact your community organizer or admin.",
      },
    });

    renderWithProvider(<SchoolListPage userName="Test CHO" />, {
      auth: { scopeWarning: null },
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "You are not assigned to any schools or partner. Please contact your community organizer or admin."
        )
      ).toBeInTheDocument();
    });
  });

  it("test_schools_page_search_debounces_calls", async () => {
    vi.mocked(fetchSchools).mockResolvedValue({
      schools: MOCK_SCHOOLS,
      summary: MOCK_SUMMARY,
      scopeWarning: null,
    });

    renderWithProvider(<SchoolListPage userName="Ipshita Das" />);

    await waitFor(() => {
      expect(screen.getByText("Govt. High School Shaikpet")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by school name/i);
    await userEvent.type(searchInput, "Shaikpet");

    // After debounce settles (200ms), only the matching school remains
    await waitFor(
      () => {
        expect(screen.queryByText("Municipal School Jubilee Hills")).not.toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    expect(screen.getByText("Govt. High School Shaikpet")).toBeInTheDocument();

    // fetchSchools was called only once on mount — search is local, not per-keystroke
    expect(vi.mocked(fetchSchools)).toHaveBeenCalledTimes(1);
  });

  it("test_schools_page_row_click_navigates_to_detail", async () => {
    vi.mocked(fetchSchools).mockResolvedValue({
      schools: MOCK_SCHOOLS,
      summary: MOCK_SUMMARY,
      scopeWarning: null,
    });

    renderWithProvider(<SchoolListPage userName="Ipshita Das" />);

    await waitFor(() => {
      expect(screen.getByText("Govt. High School Shaikpet")).toBeInTheDocument();
    });

    // Click the first school row
    const row = screen.getByText("Govt. High School Shaikpet").closest('[role="row"]');
    expect(row).not.toBeNull();
    await userEvent.click(row!);

    expect(mockRouterPush).toHaveBeenCalledWith("/schools/580");
  });
});
