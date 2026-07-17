import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetSessionModal } from '@/components/schools/calendar/SetSessionModal';
import type { SessionDefaultsOut, SessionOut } from '@/lib/api/services/sessions.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/api/services/sessions.service', () => ({
  fetchSessionDefaults: vi.fn(),
  createSession: vi.fn(),
}));

import { fetchSessionDefaults, createSession } from '@/lib/api/services/sessions.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_DEFAULTS: SessionDefaultsOut = {
  defaultStartDate: '2026-08-30',
  defaultEndDate: '2027-04-30',
  academicYearLabel: '2026-2027',
};

const MOCK_SESSION: SessionOut = {
  sessionId: 1,
  schoolId: 580,
  schoolAcademicYearId: 42,
  startDate: '2026-08-30',
  endDate: '2027-04-30',
  createdAt: '2026-06-04T10:00:00Z',
};

const noop = () => {};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SetSessionModal — F-M4-2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSessionDefaults).mockResolvedValue(MOCK_DEFAULTS);
  });

  it('test_modal_does_not_render_when_closed', () => {
    render(
      <SetSessionModal open={false} schoolId={580} onClose={noop} onSessionCreated={noop} />
    );
    expect(screen.queryByText('Configure academic session')).not.toBeInTheDocument();
  });

  it('test_modal_renders_when_open', async () => {
    render(
      <SetSessionModal open={true} schoolId={580} onClose={noop} onSessionCreated={noop} />
    );
    await waitFor(() => {
      expect(screen.getByText('Configure academic session')).toBeInTheDocument();
    });
  });

  it('test_modal_prefills_dates_from_defaults', async () => {
    render(
      <SetSessionModal open={true} schoolId={580} onClose={noop} onSessionCreated={noop} />
    );

    await waitFor(() => {
      const startInput = screen.getByTestId('start-date-input') as HTMLInputElement;
      expect(startInput.value).toBe('2026-08-30');
    });

    const endInput = screen.getByTestId('end-date-input') as HTMLInputElement;
    expect(endInput.value).toBe('2027-04-30');
  });

  it('test_modal_shows_academic_year_label', async () => {
    render(
      <SetSessionModal open={true} schoolId={580} onClose={noop} onSessionCreated={noop} />
    );
    await waitFor(() => {
      expect(screen.getByText(/2026-2027/)).toBeInTheDocument();
    });
  });

  it('test_modal_shows_immutability_warning', async () => {
    render(
      <SetSessionModal open={true} schoolId={580} onClose={noop} onSessionCreated={noop} />
    );
    await waitFor(() => {
      expect(screen.getByText('This action cannot be undone')).toBeInTheDocument();
    });
  });

  it('test_submit_with_valid_dates_calls_createSession', async () => {
    vi.mocked(createSession).mockResolvedValue(MOCK_SESSION);
    const onSessionCreated = vi.fn();

    render(
      <SetSessionModal
        open={true}
        schoolId={580}
        onClose={noop}
        onSessionCreated={onSessionCreated}
      />
    );

    await waitFor(() => {
      expect((screen.getByTestId('start-date-input') as HTMLInputElement).value).toBe('2026-08-30');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith(580, {
        startDate: '2026-08-30',
        endDate: '2027-04-30',
      });
      expect(onSessionCreated).toHaveBeenCalledWith(MOCK_SESSION);
    });
  });

  it('test_submit_with_end_before_start_shows_validation_error', async () => {
    render(
      <SetSessionModal open={true} schoolId={580} onClose={noop} onSessionCreated={noop} />
    );

    await waitFor(() => {
      expect((screen.getByTestId('start-date-input') as HTMLInputElement).value).toBe('2026-08-30');
    });

    // Set end date before start date
    fireEvent.change(screen.getByTestId('end-date-input'), { target: { value: '2026-01-01' } });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Start date must be before end date')).toBeInTheDocument();
    });

    expect(createSession).not.toHaveBeenCalled();
  });

  it('test_submit_shows_409_conflict_error', async () => {
    vi.mocked(createSession).mockRejectedValue({ status: 409, code: 'CONFLICT', message: 'Conflict' });

    render(
      <SetSessionModal open={true} schoolId={580} onClose={noop} onSessionCreated={noop} />
    );

    await waitFor(() => {
      expect((screen.getByTestId('start-date-input') as HTMLInputElement).value).toBe('2026-08-30');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText(/Session already configured/)).toBeInTheDocument();
    });
  });

  it('test_cancel_button_calls_onClose', async () => {
    const onClose = vi.fn();

    render(
      <SetSessionModal open={true} schoolId={580} onClose={onClose} onSessionCreated={noop} />
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });
});
