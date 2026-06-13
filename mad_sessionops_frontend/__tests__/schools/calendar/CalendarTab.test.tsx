import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarTab } from '@/components/schools/calendar/CalendarTab';
import type { SessionOut } from '@/lib/api/services/sessions.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/api/services/sessions.service', () => ({
  fetchSchoolSession: vi.fn(),
  fetchSessionDefaults: vi.fn().mockResolvedValue({
    defaultStartDate: '2026-08-30',
    defaultEndDate: '2027-04-30',
    academicYearLabel: '2026-2027',
  }),
  createSession: vi.fn(),
}));

import { fetchSchoolSession } from '@/lib/api/services/sessions.service';

// ── Fixture ───────────────────────────────────────────────────────────────────

const MOCK_SESSION: SessionOut = {
  sessionId: 1,
  schoolId: 580,
  schoolAcademicYearId: 42,
  startDate: '2026-07-01',
  endDate: '2027-04-30',
  createdAt: '2026-06-04T10:00:00Z',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CalendarTab — F-M4-1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('test_calendar_tab_empty_state_when_no_session', async () => {
    vi.mocked(fetchSchoolSession).mockResolvedValue(null);

    render(<CalendarTab schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByText('Academic session not configured')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Configure the academic session to enable calendar features for this school.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure session' })).toBeInTheDocument();
  });

  it('test_calendar_tab_renders_configure_cta_in_empty_state', async () => {
    vi.mocked(fetchSchoolSession).mockResolvedValue(null);

    render(<CalendarTab schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Configure session' })).toBeInTheDocument();
    });
  });

  it('test_calendar_tab_renders_session_header_when_session_exists', async () => {
    vi.mocked(fetchSchoolSession).mockResolvedValue(MOCK_SESSION);

    render(<CalendarTab schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByText('Session:')).toBeInTheDocument();
    });

    // Should NOT show the empty state
    expect(screen.queryByText('Academic session not configured')).not.toBeInTheDocument();
  });

  it('test_calendar_tab_shows_error_state_on_non_404_error', async () => {
    vi.mocked(fetchSchoolSession).mockRejectedValue({
      status: 500,
      message: 'Internal server error',
    });

    render(<CalendarTab schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeInTheDocument();
    });
  });

  it('test_calendar_tab_calls_fetchSchoolSession_with_correct_schoolId', async () => {
    vi.mocked(fetchSchoolSession).mockResolvedValue(null);

    render(<CalendarTab schoolId={999} />);

    await waitFor(() => {
      expect(fetchSchoolSession).toHaveBeenCalledWith(999);
    });
  });

  it('test_calendar_tab_does_not_show_empty_state_when_session_is_present', async () => {
    vi.mocked(fetchSchoolSession).mockResolvedValue(MOCK_SESSION);

    render(<CalendarTab schoolId={580} />);

    await waitFor(() => {
      expect(screen.queryByText('Configure session')).not.toBeInTheDocument();
    });
  });
});

// ── SetSessionModal integration ───────────────────────────────────────────────

describe('CalendarTab + SetSessionModal — F-M4-2', () => {
  it('test_clicking_configure_opens_set_session_modal', async () => {
    vi.mocked(fetchSchoolSession).mockResolvedValue(null);

    render(<CalendarTab schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Configure session' })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Configure session' }));

    await waitFor(() => {
      expect(screen.getByText('Configure academic session')).toBeInTheDocument();
    });
  });

  it('test_configure_session_button_is_present', async () => {
    vi.mocked(fetchSchoolSession).mockResolvedValue(null);

    render(<CalendarTab schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Configure session' })).toBeInTheDocument();
    });
  });
});
