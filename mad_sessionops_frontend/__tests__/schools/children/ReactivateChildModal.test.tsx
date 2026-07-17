import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactivateChildModal } from '@/components/schools/children/ReactivateChildModal';
import type { SchoolClassItem } from '@/lib/api/services/structure.service';
import type { BucketItem } from '@/lib/api/services/buckets.service';
import type { ChildItem } from '@/lib/api/services/children.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/api/services/structure.service', () => ({
  fetchSchoolClasses: vi.fn(),
}));

vi.mock('@/lib/api/services/buckets.service', () => ({
  fetchBuckets: vi.fn(),
}));

vi.mock('@/lib/api/services/children.service', () => ({
  reactivateChild: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { fetchSchoolClasses } from '@/lib/api/services/structure.service';
import { fetchBuckets } from '@/lib/api/services/buckets.service';
import { reactivateChild } from '@/lib/api/services/children.service';

const noop = () => {};

const MOCK_CLASS: SchoolClassItem = {
  schoolClassId: 1, gradeClassId: 5, className: 'Grade 5', classCode: 'G5', programName: 'Foundation', sectionsCount: 0, sections: [],
};
const MOCK_BUCKET: BucketItem = {
  classSectionId: 10, sectionName: 'group_1', sectionDisplayName: 'Group 1', activeChildrenCount: 2,
};

const INACTIVE_CHILD: ChildItem = {
  childId: 100,
  firstName: 'Asha',
  lastName: 'Kumar',
  gender: 'female',
  age: 10,
  city: null,
  motherTongue: null,
  dateOfBirth: null,
  dateOfEnrollment: null,
  madJoiningDate: null,
  isActive: false,
  currentSection: null,
  currentSchoolClass: null,
};

describe('ReactivateChildModal — F-M6-7', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSchoolClasses).mockResolvedValue([MOCK_CLASS]);
    vi.mocked(fetchBuckets).mockResolvedValue([MOCK_BUCKET]);
  });

  it('test_submit_disabled_until_class_selected', async () => {
    render(<ReactivateChildModal open={true} schoolId={580} child={INACTIVE_CHILD} onClose={noop} onSuccess={noop} />);

    await waitFor(() => expect(screen.getByText('Grade 5')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeDisabled();
  });

  it('test_submit_sends_school_class_id_without_bucket', async () => {
    vi.mocked(reactivateChild).mockResolvedValue(INACTIVE_CHILD);

    render(<ReactivateChildModal open={true} schoolId={580} child={INACTIVE_CHILD} onClose={noop} onSuccess={noop} />);

    await waitFor(() => expect(screen.getByText('Grade 5')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Grade 5'));

    await userEvent.click(screen.getByRole('button', { name: 'Reactivate' }));

    await waitFor(() => {
      expect(reactivateChild).toHaveBeenCalledWith(580, 100, { school_class_id: 1 });
    });
  });

  it('test_submit_sends_bucket_when_selected', async () => {
    vi.mocked(reactivateChild).mockResolvedValue(INACTIVE_CHILD);

    render(<ReactivateChildModal open={true} schoolId={580} child={INACTIVE_CHILD} onClose={noop} onSuccess={noop} />);

    await waitFor(() => expect(screen.getByText('Grade 5')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Grade 5'));
    await userEvent.click(screen.getByText('Group 1'));

    await userEvent.click(screen.getByRole('button', { name: 'Reactivate' }));

    await waitFor(() => {
      expect(reactivateChild).toHaveBeenCalledWith(580, 100, { school_class_id: 1, class_section_id: 10 });
    });
  });

  it('test_bucket_picker_shown_independent_of_class_selection', async () => {
    render(<ReactivateChildModal open={true} schoolId={580} child={INACTIVE_CHILD} onClose={noop} onSuccess={noop} />);

    // Bucket picker (and its "Unassigned" tile) is visible immediately, before any class is picked
    await waitFor(() => {
      expect(screen.getByText('Group 1')).toBeInTheDocument();
      expect(screen.getByText('Unassigned')).toBeInTheDocument();
    });
  });
});
