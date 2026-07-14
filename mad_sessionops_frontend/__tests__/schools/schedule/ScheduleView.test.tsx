import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ScheduleView } from '@/components/schools/schedule/ScheduleView';
import type { SchoolSchedule } from '@/lib/api/services/schedule.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/api/services/schedule.service', () => ({
  fetchSchedule: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { fetchSchedule } from '@/lib/api/services/schedule.service';

const SCHEDULE_WITH_BUCKET: SchoolSchedule = {
  schoolId: 580,
  schoolName: 'Test School',
  academicYear: '2026-2027',
  days: [
    {
      dayOfWeek: 'monday',
      slots: [
        {
          slotId: 1,
          slotName: 'Monday 09:00',
          startTime: '09:00',
          endTime: '10:00',
          slotClasses: [
            {
              slotClassSectionId: 100,
              sectionName: 'care_monster',
              sectionDisplayName: 'Care Monster',
              subjectName: 'Foundation',
              volunteers: [{ userId: 1, userDisplayName: 'Asha Kumar', userRole: 'CHO' }],
              activeChildrenCount: 3,
            },
          ],
        },
      ],
    },
    { dayOfWeek: 'tuesday', slots: [] },
    { dayOfWeek: 'wednesday', slots: [] },
    { dayOfWeek: 'thursday', slots: [] },
    { dayOfWeek: 'friday', slots: [] },
    { dayOfWeek: 'saturday', slots: [] },
    { dayOfWeek: 'sunday', slots: [] },
  ],
};

describe('ScheduleView — F-M6-8', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('test_cell_shows_bucket_display_name_not_subject', async () => {
    vi.mocked(fetchSchedule).mockResolvedValue(SCHEDULE_WITH_BUCKET);

    render(<ScheduleView schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByText('Care Monster')).toBeInTheDocument();
    });
    expect(screen.queryByText('Foundation')).not.toBeInTheDocument();
  });

  it('test_cell_shows_volunteer_first_name', async () => {
    vi.mocked(fetchSchedule).mockResolvedValue(SCHEDULE_WITH_BUCKET);

    render(<ScheduleView schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByText('Asha')).toBeInTheDocument();
    });
    expect(screen.queryByText('Asha Kumar')).not.toBeInTheDocument();
  });

  it('test_falls_back_to_section_name_when_no_display_name', async () => {
    const schedule: SchoolSchedule = {
      ...SCHEDULE_WITH_BUCKET,
      days: SCHEDULE_WITH_BUCKET.days.map((d, i) =>
        i === 0
          ? {
              ...d,
              slots: [{
                ...d.slots[0],
                slotClasses: [{ ...d.slots[0].slotClasses[0], sectionDisplayName: null, sectionName: 'legacy_row' }],
              }],
            }
          : d
      ),
    };
    vi.mocked(fetchSchedule).mockResolvedValue(schedule);

    render(<ScheduleView schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByText('legacy_row')).toBeInTheDocument();
    });
  });
});
