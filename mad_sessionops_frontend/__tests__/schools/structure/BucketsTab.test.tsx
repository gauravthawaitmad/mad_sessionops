import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BucketsTab } from '@/components/schools/structure/BucketsTab';
import type { BucketItem } from '@/lib/api/services/buckets.service';
import type { SchoolClassItem } from '@/lib/api/services/structure.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/api/services/buckets.service', () => ({
  fetchBuckets: vi.fn(),
  createBucket: vi.fn(),
  editBucket: vi.fn(),
  removeBucket: vi.fn(),
  addChildToBucket: vi.fn(),
  removeChildFromBucket: vi.fn(),
}));

vi.mock('@/lib/api/services/structure.service', () => ({
  fetchSchoolClasses: vi.fn(),
  removeSchoolClass: vi.fn(),
  fetchClassCatalog: vi.fn().mockResolvedValue([
    { classId: 5, className: 'Grade 5', classCode: 'G5', programName: 'Foundation' },
  ]),
  addClassToSchool: vi.fn(),
}));

vi.mock('@/lib/api/services/children.service', () => ({
  fetchChildren: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/toast/toast', () => ({
  showApiError: vi.fn(),
}));

import { fetchBuckets } from '@/lib/api/services/buckets.service';
import { fetchSchoolClasses, removeSchoolClass } from '@/lib/api/services/structure.service';

const MOCK_BUCKET: BucketItem = {
  classSectionId: 1,
  sectionName: 'care_monster',
  sectionDisplayName: 'Care Monster',
  activeChildrenCount: 3,
};

const MOCK_CLASS: SchoolClassItem = {
  schoolClassId: 11,
  gradeClassId: 5,
  className: 'Grade 5',
  classCode: 'G5',
  programName: 'Foundation',
  sectionsCount: 0,
  sections: [],
};

describe('BucketsTab — F-M6-6', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSchoolClasses).mockResolvedValue([]);
  });

  it('test_renders_flat_list_of_buckets', async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([MOCK_BUCKET]);

    render(<BucketsTab schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByText('Care Monster')).toBeInTheDocument();
    });

    // Class-agnostic: no "Mixed"/class label anywhere on the bucket itself
    expect(screen.queryByText(/Mixed/)).not.toBeInTheDocument();
  });

  it('test_empty_state_when_zero_buckets', async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([]);

    render(<BucketsTab schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByText('No buckets added yet.')).toBeInTheDocument();
    });
  });

  it('test_tab_shows_buckets_heading_not_structure', async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([]);

    render(<BucketsTab schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByText('Buckets')).toBeInTheDocument();
    });
    expect(screen.queryByText('Structure')).not.toBeInTheDocument();
  });

  it('test_loading_state_shows_spinner', () => {
    vi.mocked(fetchBuckets).mockReturnValue(new Promise(() => {}));

    render(<BucketsTab schoolId={580} />);

    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
  });

  it('test_error_state_when_fetch_fails', async () => {
    vi.mocked(fetchBuckets).mockRejectedValue(new Error('network error'));

    render(<BucketsTab schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load buckets.')).toBeInTheDocument();
    });
  });

  // ── Classes section ────────────────────────────────────────────────────────

  it('test_renders_classes_added_to_school', async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([]);
    vi.mocked(fetchSchoolClasses).mockResolvedValue([MOCK_CLASS]);

    render(<BucketsTab schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByText('Grade 5')).toBeInTheDocument();
    });
  });

  it('test_empty_state_when_zero_classes', async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([]);
    vi.mocked(fetchSchoolClasses).mockResolvedValue([]);

    render(<BucketsTab schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByText('No classes added yet.')).toBeInTheDocument();
    });
  });

  it('test_add_class_button_opens_modal', async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([]);
    vi.mocked(fetchSchoolClasses).mockResolvedValue([]);

    render(<BucketsTab schoolId={580} />);

    await waitFor(() => {
      expect(screen.getByText('No classes added yet.')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Add Class' }));

    await waitFor(() => {
      expect(screen.getByText('Select a class to add')).toBeInTheDocument();
    });
  });

  it('test_remove_class_calls_removeSchoolClass', async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([]);
    vi.mocked(fetchSchoolClasses).mockResolvedValue([MOCK_CLASS]);
    vi.mocked(removeSchoolClass).mockResolvedValue(undefined);

    render(<BucketsTab schoolId={580} />);

    await waitFor(() => expect(screen.getByText('Grade 5')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Remove Grade 5' }));

    await waitFor(() => {
      expect(screen.getByText('Remove Class')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(removeSchoolClass).toHaveBeenCalledWith(580, 11);
      expect(screen.queryByText('Grade 5')).not.toBeInTheDocument();
    });
  });

  it('test_no_class_delete_icon_when_cannot_modify', async () => {
    vi.mocked(fetchBuckets).mockResolvedValue([]);
    vi.mocked(fetchSchoolClasses).mockResolvedValue([MOCK_CLASS]);

    render(<BucketsTab schoolId={580} canModify={false} />);

    await waitFor(() => expect(screen.getByText('Grade 5')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Remove Grade 5' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Class' })).not.toBeInTheDocument();
  });
});
