import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SlotGridView } from '@/components/schools/slots/SlotGridView';
import type { BucketItem } from '@/lib/api/services/buckets.service';
import type { SlotClassItem } from '@/lib/api/services/slot_classes.service';
import type { SlotItem } from '@/lib/api/services/slots.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/api/services/buckets.service', () => ({
  fetchBuckets: vi.fn(),
}));

vi.mock('@/lib/api/services/slot_classes.service', () => ({
  fetchSlotClasses: vi.fn(),
}));

vi.mock('@/lib/api/services/volunteers.service', () => ({
  fetchVolunteers: vi.fn().mockResolvedValue({ status: 'ok', volunteers: [] }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { fetchBuckets } from '@/lib/api/services/buckets.service';
import { fetchSlotClasses } from '@/lib/api/services/slot_classes.service';

const noop = () => {};

const SLOT: SlotItem = {
  slotId: 1, slotName: 'Monday 09:00', dayOfWeek: 'monday',
  startTime: '09:00:00', endTime: '10:00:00', recurring: true, slotClassCount: 1,
};

const BUCKET: BucketItem = {
  classSectionId: 10, sectionName: 'group_1', sectionDisplayName: 'Group 1', activeChildrenCount: 3,
};

const ASSIGNED_SCS: SlotClassItem = {
  slotClassSectionId: 100,
  classSectionId: 10,
  sectionName: 'group_1',
  sectionDisplayName: 'Group 1',
  subjectName: 'Foundation',
  volunteers: [{ userId: 1, userDisplayName: 'Asha Kumar', userRole: 'CHO' }],
  activeChildrenCount: 3,
};

describe('SlotGridView — F-M6-8', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('test_flat_bucket_rows_no_class_grouping', async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([BUCKET]);
    vi.mocked(fetchSlotClasses).mockResolvedValue([]);

    render(
      <SlotGridView
        schoolId={580}
        slots={[SLOT]}
        canModify={true}
        onCountChange={noop}
        onEditSlot={noop}
        onDeleteSlot={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Group 1')).toBeInTheDocument();
    });
    // "Bucket" column header, not the old class-grouped "Section" header
    expect(screen.getByText('Bucket')).toBeInTheDocument();
  });

  it('test_assigned_cell_shows_no_subject_pill', async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([BUCKET]);
    vi.mocked(fetchSlotClasses).mockResolvedValue([ASSIGNED_SCS]);

    render(
      <SlotGridView
        schoolId={580}
        slots={[SLOT]}
        canModify={true}
        onCountChange={noop}
        onEditSlot={noop}
        onDeleteSlot={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Asha')).toBeInTheDocument();
    });
    expect(screen.queryByText('Foundation')).not.toBeInTheDocument();
  });

  it('test_empty_state_when_no_buckets', async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([]);
    vi.mocked(fetchSlotClasses).mockResolvedValue([]);

    render(
      <SlotGridView
        schoolId={580}
        slots={[SLOT]}
        canModify={true}
        onCountChange={noop}
        onEditSlot={noop}
        onDeleteSlot={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/No buckets configured yet/)).toBeInTheDocument();
    });
  });
});
