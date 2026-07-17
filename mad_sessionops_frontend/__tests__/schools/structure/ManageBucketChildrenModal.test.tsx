import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManageBucketChildrenModal } from '@/components/schools/structure/ManageBucketChildrenModal';
import type { BucketItem } from '@/lib/api/services/buckets.service';
import type { ChildItem } from '@/lib/api/services/children.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/api/services/buckets.service', () => ({
  addChildToBucket: vi.fn(),
  removeChildFromBucket: vi.fn(),
}));

vi.mock('@/lib/api/services/children.service', () => ({
  fetchChildren: vi.fn(),
}));

vi.mock('@/lib/toast/toast', () => ({
  showSuccess: vi.fn(),
}));

import { addChildToBucket, removeChildFromBucket } from '@/lib/api/services/buckets.service';
import { fetchChildren } from '@/lib/api/services/children.service';

const noop = () => {};

function makeChild(id: number, firstName: string, currentSectionId: number | null): ChildItem {
  return {
    childId: id,
    firstName,
    lastName: 'Test',
    gender: 'other',
    age: 10,
    city: null,
    motherTongue: null,
    dateOfBirth: null,
    dateOfEnrollment: null,
    madJoiningDate: null,
    isActive: true,
    currentSchoolClass: { schoolClassId: 1, className: 'Class 1' },
    currentSection: currentSectionId
      ? { classSectionId: currentSectionId, sectionDisplayName: 'Bucket', sectionName: 'bucket' }
      : null,
  };
}

const BUCKET_2_CHILDREN: BucketItem = {
  classSectionId: 10,
  sectionName: 'group_1',
  sectionDisplayName: 'Group 1',
  activeChildrenCount: 2,
};

const BUCKET_5_CHILDREN: BucketItem = {
  classSectionId: 10,
  sectionName: 'group_1',
  sectionDisplayName: 'Group 1',
  activeChildrenCount: 5,
};

describe('ManageBucketChildrenModal — UX polish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('test_renders_as_centered_dialog_not_side_drawer', async () => {
    vi.mocked(fetchChildren).mockResolvedValue([]);

    render(
      <ManageBucketChildrenModal
        open={true}
        schoolId={580}
        bucket={BUCKET_2_CHILDREN}
        onClose={noop}
        onChildAdded={noop}
        onChildRemoved={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('test_search_field_has_visible_label', async () => {
    vi.mocked(fetchChildren).mockResolvedValue([]);

    render(
      <ManageBucketChildrenModal
        open={true}
        schoolId={580}
        bucket={BUCKET_2_CHILDREN}
        onClose={noop}
        onChildAdded={noop}
        onChildRemoved={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Search children')).toBeInTheDocument();
    });
  });

  it('test_renders_roster_and_available_children', async () => {
    const roster = [makeChild(1, 'Asha', 10)];
    const allActive = [makeChild(1, 'Asha', 10), makeChild(2, 'Kiran', null)];
    vi.mocked(fetchChildren).mockImplementation((_schoolId, params) => {
      if (params?.section_id) return Promise.resolve(roster);
      return Promise.resolve(allActive);
    });

    render(
      <ManageBucketChildrenModal
        open={true}
        schoolId={580}
        bucket={BUCKET_2_CHILDREN}
        onClose={noop}
        onChildAdded={noop}
        onChildRemoved={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Asha Test')).toBeInTheDocument();
      expect(screen.getByText('Kiran Test')).toBeInTheDocument();
    });
  });

  it('test_add_child_calls_addChildToBucket_and_shows_success_toast', async () => {
    const roster: ChildItem[] = [];
    const allActive = [makeChild(2, 'Kiran', null)];
    vi.mocked(fetchChildren).mockImplementation((_schoolId, params) => {
      if (params?.section_id) return Promise.resolve(roster);
      return Promise.resolve(allActive);
    });
    vi.mocked(addChildToBucket).mockResolvedValue({ childClassSectionId: 1, childId: 2, classSectionId: 10 });
    const onChildAdded = vi.fn();

    const { showSuccess } = await import('@/lib/toast/toast');

    render(
      <ManageBucketChildrenModal
        open={true}
        schoolId={580}
        bucket={BUCKET_2_CHILDREN}
        onClose={noop}
        onChildAdded={onChildAdded}
        onChildRemoved={noop}
      />
    );

    await waitFor(() => expect(screen.getByText('Kiran Test')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Add child' }));

    await waitFor(() => {
      expect(addChildToBucket).toHaveBeenCalledWith(580, 10, 2);
      expect(onChildAdded).toHaveBeenCalled();
      expect(showSuccess).toHaveBeenCalledWith('Kiran added to Group 1');
    });
  });

  it('test_remove_child_calls_removeChildFromBucket', async () => {
    const roster = [makeChild(1, 'Asha', 10)];
    vi.mocked(fetchChildren).mockImplementation((_schoolId, params) => {
      if (params?.section_id) return Promise.resolve(roster);
      return Promise.resolve([]);
    });
    vi.mocked(removeChildFromBucket).mockResolvedValue(undefined);
    const onChildRemoved = vi.fn();

    render(
      <ManageBucketChildrenModal
        open={true}
        schoolId={580}
        bucket={BUCKET_2_CHILDREN}
        onClose={noop}
        onChildAdded={noop}
        onChildRemoved={onChildRemoved}
      />
    );

    await waitFor(() => expect(screen.getByText('Asha Test')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Remove child' }));

    await waitFor(() => {
      expect(removeChildFromBucket).toHaveBeenCalledWith(580, 10, 1);
      expect(onChildRemoved).toHaveBeenCalled();
    });
  });

  it('test_add_disabled_at_5_children', async () => {
    const allActive = [makeChild(2, 'Kiran', null)];
    vi.mocked(fetchChildren).mockImplementation((_schoolId, params) => {
      if (params?.section_id) return Promise.resolve([]);
      return Promise.resolve(allActive);
    });

    render(
      <ManageBucketChildrenModal
        open={true}
        schoolId={580}
        bucket={BUCKET_5_CHILDREN}
        onClose={noop}
        onChildAdded={noop}
        onChildRemoved={noop}
      />
    );

    await waitFor(() => expect(screen.getByText('Kiran Test')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Add child' })).toBeDisabled();
  });

  it('test_server_409_already_in_another_bucket_shown_inline', async () => {
    const allActive = [makeChild(2, 'Kiran', null)];
    vi.mocked(fetchChildren).mockImplementation((_schoolId, params) => {
      if (params?.section_id) return Promise.resolve([]);
      return Promise.resolve(allActive);
    });
    vi.mocked(addChildToBucket).mockRejectedValue({
      status: 409,
      code: 'CONFLICT',
      message: 'Kiran Test is already in bucket "Group 2". Remove them from that bucket first.',
    });

    render(
      <ManageBucketChildrenModal
        open={true}
        schoolId={580}
        bucket={BUCKET_2_CHILDREN}
        onClose={noop}
        onChildAdded={noop}
        onChildRemoved={noop}
      />
    );

    await waitFor(() => expect(screen.getByText('Kiran Test')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Add child' }));

    await waitFor(() => {
      expect(
        screen.getByText('Kiran Test is already in bucket "Group 2". Remove them from that bucket first.')
      ).toBeInTheDocument();
    });
  });
});
