import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SchoolDetailPage } from '@/components/schools/SchoolDetailPage';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/api/services/schools.service', () => ({
  fetchSchool: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, style }: { href: string; children: React.ReactNode; style?: React.CSSProperties }) => (
    <a href={href} style={style}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/schools/580',
}));

// ── Fixture ───────────────────────────────────────────────────────────────────

import { fetchSchool } from '@/lib/api/services/schools.service';

const MOCK_SCHOOL = {
  partnerId: 580,
  partnerName: 'Govt. High School Shaikpet',
  addressLine1: '123 Shaikpet Road',
  addressLine2: null,
  city: 'Hyderabad',
  state: 'Telangana',
  pincode: 500104,
  schoolType: 'government',
  partnerAffiliationType: null,
  pocName: 'Ramesh Kumar',
  pocEmail: 'ramesh@school.in',
  pocDesignation: 'Principal',
  pocContact: '9876543210',
  mouSignDate: '2024-06-01',
  mouStartDate: '2024-07-01',
  mouEndDate: '2027-06-30',
  mouUrl: null,
  coId: 1784194,
  coName: 'Ipshita Das',
  syncedAt: '2026-04-29T10:00:00Z',
  configurationStatus: 'awaiting_setup',
  childrenCount: 25,
  classesCount: 3,
  volunteersCount: 5,
  assignmentsCount: 10,
};

// ── Tests — F-M1-5 ───────────────────────────────────────────────────────────

describe('SchoolDetailPage — F-M1-5', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('test_school_detail_renders_overview_tab', async () => {
    vi.mocked(fetchSchool).mockResolvedValue(MOCK_SCHOOL);

    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText('Govt. High School Shaikpet')).toBeInTheDocument();
    });

    // Overview tab is active in sidebar
    expect(screen.getByText('Overview')).toBeInTheDocument();

    // Content sections
    expect(screen.getByText('School Information')).toBeInTheDocument();
    expect(screen.getByText('Point of Contact')).toBeInTheDocument();
    expect(screen.getByText('MOU Details')).toBeInTheDocument();
    expect(screen.getByText('Community Organizer')).toBeInTheDocument();

    // School data — appears in multiple places (header, info strip, CO section)
    const coNames = screen.getAllByText('Ipshita Das');
    expect(coNames.length).toBeGreaterThan(0);

    expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
  });

  it('test_school_detail_disables_other_tabs', async () => {
    vi.mocked(fetchSchool).mockResolvedValue(MOCK_SCHOOL);

    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    // All non-overview tab labels are present in DOM
    // MUI Tooltip clones elements internally, so multiple matches are expected
    const disabledLabels = ['Structure', 'Volunteers', 'Slots', 'Calendar'];
    for (const label of disabledLabels) {
      const elements = screen.getAllByText(label);
      expect(elements.length).toBeGreaterThan(0);
    }

    // "Children" tab exists (MUI Tooltip may clone it, so use getAllByText)
    const childrenTabs = screen.getAllByText('Children');
    expect(childrenTabs.length).toBeGreaterThan(0);

    // Disabled tabs are wrapped in Tooltip with "Coming in a future milestone"
    const tooltips = document.querySelectorAll('[aria-label="Coming in a future milestone"]');
    expect(tooltips.length).toBe(5); // Structure, Children, Volunteers, Slots, Calendar
  });

  it('test_school_detail_back_link_navigates_to_list', async () => {
    vi.mocked(fetchSchool).mockResolvedValue(MOCK_SCHOOL);

    render(<SchoolDetailPage partnerId={580} />);

    await waitFor(() => {
      expect(screen.getByText('All schools')).toBeInTheDocument();
    });

    const backLink = screen.getByText('All schools').closest('a');
    expect(backLink).toHaveAttribute('href', '/schools');
  });

  it('test_school_detail_handles_404_gracefully', async () => {
    const notFoundError = Object.assign(new Error('Not found'), { status: 404 });
    vi.mocked(fetchSchool).mockRejectedValue(notFoundError);

    render(<SchoolDetailPage partnerId={9999} />);

    await waitFor(() => {
      expect(screen.getByText('School not found')).toBeInTheDocument();
    });

    expect(
      screen.getByText("This school doesn't exist or you don't have access to it."),
    ).toBeInTheDocument();

    const backLink = screen.getByText('Back to schools').closest('a');
    expect(backLink).toHaveAttribute('href', '/schools');
  });
});
