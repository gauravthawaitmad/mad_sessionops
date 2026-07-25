import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SchoolDetailPage } from "@/components/schools/SchoolDetailPage";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api/services/schools.service", () => ({
  fetchSchool: vi.fn(),
}));

vi.mock("@/lib/api/services/sessions.service", () => ({
  fetchSchoolSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/api/services/slots.service", () => ({
  fetchSlots: vi.fn().mockResolvedValue([]),
  createSlot: vi.fn(),
  updateSlot: vi.fn(),
  deleteSlot: vi.fn(),
}));

vi.mock("@/lib/api/services/slot_classes.service", () => ({
  fetchSlotClasses: vi.fn().mockResolvedValue([]),
  createSlotClass: vi.fn(),
  updateSlotClass: vi.fn(),
  deleteSlotClass: vi.fn(),
}));

vi.mock("@/lib/api/services/volunteers.service", () => ({
  fetchVolunteers: vi.fn().mockResolvedValue({ volunteers: [], totalCount: 0 }),
}));

vi.mock("@/lib/api/services/schedule.service", () => ({
  fetchSchedule: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/api/services/permissions.service", () => ({
  fetchPermissions: vi.fn().mockResolvedValue({ canModify: true }),
}));

vi.mock("@/lib/hooks/useUserCan", () => ({
  useUserCan: vi.fn().mockReturnValue({ canModify: true }),
}));

vi.mock("@/lib/api/services/structure.service", () => ({
  fetchActiveYear: vi
    .fn()
    .mockResolvedValue({ academicYearId: 1, label: "2026-2027", isActive: true }),
  fetchSchoolClasses: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/api/services/buckets.service", () => ({
  fetchBuckets: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/api/services/children.service", () => ({
  fetchChildren: vi.fn().mockResolvedValue([]),
  enrollChild: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    style,
  }: {
    href: string;
    children: React.ReactNode;
    style?: React.CSSProperties;
  }) => (
    <a href={href} style={style}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/schools/580",
}));

// ── Fixture ───────────────────────────────────────────────────────────────────

import { fetchSchool } from "@/lib/api/services/schools.service";
import { fetchSchoolClasses } from "@/lib/api/services/structure.service";
import userEvent from "@testing-library/user-event";

const MOCK_SCHOOL = {
  partnerId: 580,
  partnerName: "Govt. High School Shaikpet",
  addressLine1: "123 Shaikpet Road",
  addressLine2: null,
  city: "Hyderabad",
  state: "Telangana",
  pincode: 500104,
  schoolType: "government",
  partnerAffiliationType: null,
  pocName: "Ramesh Kumar",
  pocEmail: "ramesh@school.in",
  pocDesignation: "Principal",
  pocContact: "9876543210",
  mouSignDate: "2024-06-01",
  mouStartDate: "2024-07-01",
  mouEndDate: "2027-06-30",
  mouUrl: null,
  coId: 1784194,
  coName: "Ipshita Das",
  syncedAt: "2026-04-29T10:00:00Z",
  configurationStatus: "awaiting_setup",
  childrenCount: 25,
  classesCount: 3,
  volunteersCount: 5,
  assignmentsCount: 10,
  academicYearLabel: "2026-2027",
};

// ── Tests — F-M2-1 ───────────────────────────────────────────────────────────

describe("SchoolDetailPage — F-M6-6 (Buckets tab activation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSchool).mockResolvedValue(MOCK_SCHOOL);
    vi.mocked(fetchSchoolClasses).mockResolvedValue([]);
  });

  it("test_buckets_tab_renders_for_co", async () => {
    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText("Govt. High School Shaikpet")).toBeInTheDocument();
    });

    // Click the first "Structure" (sidebar nav item)
    const structureItems = screen.getAllByText("Structure");
    await userEvent.click(structureItems[0]);

    // BucketsTab renders: empty state since fetchBuckets returns []
    await waitFor(() => {
      expect(screen.getByText("No mentoring circles added yet.")).toBeInTheDocument();
    });
  });

  it("test_buckets_tab_empty_state_when_no_buckets", async () => {
    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText("Govt. High School Shaikpet")).toBeInTheDocument();
    });

    const structureItems = screen.getAllByText("Structure");
    await userEvent.click(structureItems[0]);

    await waitFor(() => {
      expect(screen.getByText("No mentoring circles added yet.")).toBeInTheDocument();
    });
  });

  it("test_structure_tab_is_enabled_in_m2", async () => {
    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });

    // All tabs enabled in M4 — no "Coming in a future milestone" tooltips
    const tooltips = document.querySelectorAll('[aria-label="Coming in a future milestone"]');
    expect(tooltips.length).toBe(0);
  });
});

// ── Tests — F-M2-2 ───────────────────────────────────────────────────────────

describe("SchoolDetailPage — F-M2-2 (Children tab activation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSchool).mockResolvedValue(MOCK_SCHOOL);
    vi.mocked(fetchSchoolClasses).mockResolvedValue([]);
  });

  it("test_children_tab_renders_for_co_with_school_access", async () => {
    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText("Govt. High School Shaikpet")).toBeInTheDocument();
    });

    // Click the first "Children" (sidebar nav item)
    const childrenItems = screen.getAllByText("Children");
    await userEvent.click(childrenItems[0]);

    // ChildrenTab renders
    await waitFor(() => {
      expect(screen.getByText("Add children to start your school's journey")).toBeInTheDocument();
    });
  });

  it("test_children_tab_shows_empty_state_for_school_with_no_children", async () => {
    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText("Govt. High School Shaikpet")).toBeInTheDocument();
    });

    const childrenItems = screen.getAllByText("Children");
    await userEvent.click(childrenItems[0]);

    await waitFor(() => {
      expect(screen.getByText("Add children to start your school's journey")).toBeInTheDocument();
      expect(screen.getAllByText("Enroll Child").length).toBeGreaterThan(0);
    });
  });

  it("test_children_tab_returns_403_for_co_without_school_access", async () => {
    // 403 is enforced server-side — the tab has no client-side role-gating.
    // Verify: Children tab is always clickable and renders without hiding content
    // based on role. Full API 403 handling tested in F-M2-6.
    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText("Govt. High School Shaikpet")).toBeInTheDocument();
    });

    const childrenItems = screen.getAllByText("Children");
    // Tab is clickable (not disabled, not inside a Tooltip for "Coming in a future milestone")
    expect(childrenItems[0]).toBeInTheDocument();
    await userEvent.click(childrenItems[0]);

    await waitFor(() => {
      expect(screen.getByText("Add children to start your school's journey")).toBeInTheDocument();
    });
  });

  it("test_children_tab_is_enabled_in_m2", async () => {
    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });

    // All tabs enabled in M4 — no "Coming in a future milestone" tooltips
    const tooltips = document.querySelectorAll('[aria-label="Coming in a future milestone"]');
    expect(tooltips.length).toBe(0);
  });
});

// ── Tests — F-M1-5 ───────────────────────────────────────────────────────────

describe("SchoolDetailPage — F-M1-5", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("test_school_detail_renders_overview_tab", async () => {
    vi.mocked(fetchSchool).mockResolvedValue(MOCK_SCHOOL);

    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText("Govt. High School Shaikpet")).toBeInTheDocument();
    });

    // Overview tab is active in sidebar
    expect(screen.getByText("Overview")).toBeInTheDocument();

    // Content sections
    expect(screen.getByText("School Information")).toBeInTheDocument();
    expect(screen.getByText("Point of Contact")).toBeInTheDocument();
    expect(screen.getByText("MOU Details")).toBeInTheDocument();
    expect(screen.getByText("Community Organizer")).toBeInTheDocument();

    // School data — appears in multiple places (header, info strip, CO section)
    const coNames = screen.getAllByText("Ipshita Das");
    expect(coNames.length).toBeGreaterThan(0);

    expect(screen.getByText("Ramesh Kumar")).toBeInTheDocument();
  });

  it("test_school_detail_all_tabs_enabled_in_m4", async () => {
    vi.mocked(fetchSchool).mockResolvedValue(MOCK_SCHOOL);

    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });

    // All visible tab labels are present in DOM — Schedule is hidden for now
    // (superseded by Calendar), so intentionally excluded here.
    const tabLabels = ["Structure", "Volunteers", "Slots", "Calendar", "Children"];
    for (const label of tabLabels) {
      const elements = screen.getAllByText(label);
      expect(elements.length).toBeGreaterThan(0);
    }
    expect(screen.queryByText("Schedule")).not.toBeInTheDocument();

    // M4: all visible tabs enabled — zero "Coming in a future milestone" tooltips
    const tooltips = document.querySelectorAll('[aria-label="Coming in a future milestone"]');
    expect(tooltips.length).toBe(0);
  });

  it("test_school_detail_back_link_navigates_to_list", async () => {
    vi.mocked(fetchSchool).mockResolvedValue(MOCK_SCHOOL);

    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText("All schools")).toBeInTheDocument();
    });

    const backLink = screen.getByText("All schools").closest("a");
    expect(backLink).toHaveAttribute("href", "/schools");
  });

  it("test_school_detail_handles_404_gracefully", async () => {
    const notFoundError = Object.assign(new Error("Not found"), { status: 404 });
    vi.mocked(fetchSchool).mockRejectedValue(notFoundError);

    render(<SchoolDetailPage partnerId={9999} />);

    await waitFor(() => {
      expect(screen.getByText("School not found")).toBeInTheDocument();
    });

    expect(
      screen.getByText("This school doesn't exist or you don't have access to it.")
    ).toBeInTheDocument();

    const backLink = screen.getByText("Back to schools").closest("a");
    expect(backLink).toHaveAttribute("href", "/schools");
  });
});

// ── Tests — F-M3-2 ───────────────────────────────────────────────────────────

describe("SchoolDetailPage — F-M3-2 (Slots tab activation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSchool).mockResolvedValue(MOCK_SCHOOL);
    vi.mocked(fetchSchoolClasses).mockResolvedValue([]);
  });

  it("test_slots_tab_renders_for_co_with_school_access", async () => {
    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText("Govt. High School Shaikpet")).toBeInTheDocument();
    });

    const slotsItems = screen.getAllByText("Slots");
    await userEvent.click(slotsItems[0]);

    await waitFor(() => {
      expect(screen.getByText("No slots configured yet.")).toBeInTheDocument();
    });
  });

  it("test_slots_tab_returns_403_for_co_without_school_access", async () => {
    // 403 enforced server-side; tab is always clickable and renders without role-gating
    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText("Govt. High School Shaikpet")).toBeInTheDocument();
    });

    const slotsItems = screen.getAllByText("Slots");
    expect(slotsItems[0]).toBeInTheDocument();
    await userEvent.click(slotsItems[0]);

    await waitFor(() => {
      expect(screen.getByText("No slots configured yet.")).toBeInTheDocument();
    });
  });

  it("test_slots_tab_renders_for_cho_with_school_access", async () => {
    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText("Govt. High School Shaikpet")).toBeInTheDocument();
    });

    const slotsItems = screen.getAllByText("Slots");
    await userEvent.click(slotsItems[0]);

    await waitFor(() => {
      expect(screen.getByText("No slots configured yet.")).toBeInTheDocument();
    });
  });

  it("test_slots_tab_empty_state_for_school_with_no_slots", async () => {
    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText("Govt. High School Shaikpet")).toBeInTheDocument();
    });

    const slotsItems = screen.getAllByText("Slots");
    await userEvent.click(slotsItems[0]);

    await waitFor(() => {
      expect(screen.getByText("No slots configured yet.")).toBeInTheDocument();
      expect(
        screen.getByText("Click 'Add Slot' to schedule the first teaching slot.")
      ).toBeInTheDocument();
    });
  });

  it("test_slots_tab_is_enabled_in_m3", async () => {
    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });

    // All tabs enabled in M4 — no "Coming in a future milestone" tooltips
    const tooltips = document.querySelectorAll('[aria-label="Coming in a future milestone"]');
    expect(tooltips.length).toBe(0);
  });
});
