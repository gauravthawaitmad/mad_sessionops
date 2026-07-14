import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnrollChildModal } from '@/components/schools/children/EnrollChildModal';
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
  enrollChild: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { fetchSchoolClasses } from '@/lib/api/services/structure.service';
import { fetchBuckets } from '@/lib/api/services/buckets.service';
import { enrollChild } from '@/lib/api/services/children.service';

const noop = () => {};

const MOCK_CLASS: SchoolClassItem = {
  schoolClassId: 1,
  gradeClassId: 5,
  className: 'Grade 5',
  classCode: 'G5',
  programName: 'Foundation',
  sectionsCount: 0,
  sections: [],
};

const MOCK_BUCKET: BucketItem = {
  classSectionId: 10,
  sectionName: 'group_1',
  sectionDisplayName: 'Group 1',
  activeChildrenCount: 2,
};

const MOCK_CHILD: ChildItem = {
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
  isActive: true,
  currentSection: null,
  currentSchoolClass: { schoolClassId: 1, className: 'Grade 5' },
};

async function fillRequiredFields() {
  await userEvent.type(screen.getByPlaceholderText('e.g. Asha'), 'Asha');
  await userEvent.type(screen.getByPlaceholderText('e.g. Kumar'), 'Kumar');
  await userEvent.click(screen.getByText('Female'));
  await userEvent.type(screen.getByPlaceholderText('10'), '10');
}

describe('EnrollChildModal — F-M6-7', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSchoolClasses).mockResolvedValue([MOCK_CLASS]);
    vi.mocked(fetchBuckets).mockResolvedValue([MOCK_BUCKET]);
  });

  it('test_submit_without_class_shows_zod_error_no_api_call', async () => {
    render(<EnrollChildModal open={true} schoolId={580} onClose={noop} onSuccess={noop} />);

    await waitFor(() => expect(screen.getByText('Grade 5')).toBeInTheDocument());
    await fillRequiredFields();

    await userEvent.click(screen.getByRole('button', { name: 'Enroll' }));

    await waitFor(() => {
      expect(screen.getByText('Select a class')).toBeInTheDocument();
    });
    expect(enrollChild).not.toHaveBeenCalled();
  });

  it('test_submit_without_bucket_omits_class_section_id', async () => {
    vi.mocked(enrollChild).mockResolvedValue(MOCK_CHILD);

    render(<EnrollChildModal open={true} schoolId={580} onClose={noop} onSuccess={noop} />);

    await waitFor(() => expect(screen.getByText('Grade 5')).toBeInTheDocument());
    await fillRequiredFields();
    await userEvent.click(screen.getByText('Grade 5'));

    await userEvent.click(screen.getByRole('button', { name: 'Enroll' }));

    await waitFor(() => {
      expect(enrollChild).toHaveBeenCalledWith(
        580,
        expect.objectContaining({ school_class_id: 1 })
      );
    });
    const payload = vi.mocked(enrollChild).mock.calls[0][1];
    expect(payload).not.toHaveProperty('class_section_id');
  });

  it('test_submit_with_bucket_includes_class_section_id', async () => {
    vi.mocked(enrollChild).mockResolvedValue(MOCK_CHILD);

    render(<EnrollChildModal open={true} schoolId={580} onClose={noop} onSuccess={noop} />);

    await waitFor(() => expect(screen.getByText('Grade 5')).toBeInTheDocument());
    await fillRequiredFields();
    await userEvent.click(screen.getByText('Grade 5'));
    await userEvent.click(screen.getByText('Group 1'));

    await userEvent.click(screen.getByRole('button', { name: 'Enroll' }));

    await waitFor(() => {
      expect(enrollChild).toHaveBeenCalledWith(
        580,
        expect.objectContaining({ school_class_id: 1, class_section_id: 10 })
      );
    });
  });

  it('test_class_selection_does_not_refetch_buckets', async () => {
    render(<EnrollChildModal open={true} schoolId={580} onClose={noop} onSuccess={noop} />);

    await waitFor(() => expect(screen.getByText('Grade 5')).toBeInTheDocument());
    expect(fetchBuckets).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByText('Grade 5'));

    expect(fetchBuckets).toHaveBeenCalledTimes(1);
  });

  it('test_bucket_picker_has_unassigned_tile', async () => {
    render(<EnrollChildModal open={true} schoolId={580} onClose={noop} onSuccess={noop} />);

    await waitFor(() => expect(screen.getByText('Group 1')).toBeInTheDocument());
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });
});
