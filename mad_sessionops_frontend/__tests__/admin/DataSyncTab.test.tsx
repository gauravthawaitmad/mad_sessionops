import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const EMPTY_STATS = {
  entityStats: {
    user:            { total: 0, active: 0, inactive: 0, removed: 0, lastSuccessfulSync: null },
    partner:         { total: 0, active: 0, inactive: 0, removed: 0, lastSuccessfulSync: null },
    partnerWorknode: { total: 0, active: 0, inactive: 0, removed: 0, lastSuccessfulSync: null },
  },
  cronHealth: {
    healthy: true, lastSuccessfulSyncAt: null, hoursSinceLastSuccess: null,
    nextExpectedRun: null, reason: null,
  },
};

const TRIGGER_RESULT = {
  userRunId: 1, partnerRunId: 2, partnerWorknodeRunId: 3,
};

const mockFetchSyncRuns      = vi.fn().mockResolvedValue([]);
const mockFetchAdminStats    = vi.fn().mockResolvedValue(EMPTY_STATS);
const mockTriggerManualSync  = vi.fn().mockResolvedValue(TRIGGER_RESULT);
const mockTriggerEntitySync  = vi.fn().mockResolvedValue({ userRunId: 10, partnerRunId: null, partnerWorknodeRunId: null });

vi.mock('@/lib/api/services/syncAdmin.service', () => ({
  fetchSyncRuns:      (...a: any[]) => mockFetchSyncRuns(...a),
  fetchAdminStats:    (...a: any[]) => mockFetchAdminStats(...a),
  fetchSyncRunDetail: vi.fn().mockResolvedValue(null),
  triggerManualSync:  (...a: any[]) => mockTriggerManualSync(...a),
  triggerEntitySync:  (...a: any[]) => mockTriggerEntitySync(...a),
  syncUserByLogin:    vi.fn(),
}));

import toast from 'react-hot-toast';
import { DataSyncTab } from '@/components/admin/DataSyncTab';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DataSyncTab — per-entity sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSyncRuns.mockResolvedValue([]);
    mockFetchAdminStats.mockResolvedValue(EMPTY_STATS);
    mockTriggerManualSync.mockResolvedValue(TRIGGER_RESULT);
    mockTriggerEntitySync.mockResolvedValue({ userRunId: 10, partnerRunId: null, partnerWorknodeRunId: null });
  });

  it('renders 3 entity cards with sync buttons', async () => {
    render(<DataSyncTab />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sync users/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /sync partners/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /sync partner worknodes/i })).toBeTruthy();
    });
  });

  it('clicking entity button calls triggerEntitySync with correct entity', async () => {
    render(<DataSyncTab />);
    await waitFor(() => screen.getByRole('button', { name: /sync users/i }));

    fireEvent.click(screen.getByRole('button', { name: /sync users/i }));
    await waitFor(() => {
      expect(mockTriggerEntitySync).toHaveBeenCalledWith('user');
    });
  });

  it('"Sync all" button calls triggerManualSync', async () => {
    render(<DataSyncTab />);
    await waitFor(() => screen.getByRole('button', { name: /^sync all$/i }));

    fireEvent.click(screen.getByRole('button', { name: /^sync all$/i }));
    await waitFor(() => {
      expect(mockTriggerManualSync).toHaveBeenCalledTimes(1);
    });
  });

  it('entity buttons show "Syncing…" when that entity has a running run', async () => {
    mockFetchSyncRuns.mockResolvedValue([
      { syncRunId: 20, status: 'running', entityType: 'user', syncType: 'manual',
        startedAt: new Date().toISOString(), completedAt: null, recordsFetched: 0 },
    ]);
    render(<DataSyncTab />);
    await waitFor(() => {
      // User button should show Syncing…
      expect(screen.getByRole('button', { name: /syncing/i })).toBeTruthy();
    });
    // Partner button should still be enabled
    expect(screen.getByRole('button', { name: /sync partners/i })).not.toBeDisabled();
  });

  it('shows toast.error on 409', async () => {
    mockTriggerEntitySync.mockRejectedValue({ response: { status: 409 } });
    render(<DataSyncTab />);
    await waitFor(() => screen.getByRole('button', { name: /sync users/i }));

    fireEvent.click(screen.getByRole('button', { name: /sync users/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('already running'));
    });
  });

  it('"Sync" user button is disabled while hasAnyRunningSync', async () => {
    mockFetchSyncRuns.mockResolvedValue([
      { syncRunId: 21, status: 'running', entityType: 'partner', syncType: 'manual',
        startedAt: new Date().toISOString(), completedAt: null, recordsFetched: 0 },
    ]);
    render(<DataSyncTab />);
    await waitFor(() => {
      // The single-user "Sync" submit button should be disabled while a sync runs
      const syncBtn = screen.getByRole('button', { name: /^sync$/i });
      expect(syncBtn).toBeDisabled();
    });
  });
});
