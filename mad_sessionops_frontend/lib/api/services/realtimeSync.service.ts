import { api } from '../client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RealtimeSyncLogEntry {
  realtime_sync_log_id: number;
  user_id_from_source: number;
  sync_type: string;
  event_type: string;
  received_at: string;
  processed_at: string | null;
  status: string;
  action_taken: string;
  error_details: string | null;
  field_changes: Array<{ field: string; old: unknown; new: unknown }> | null;
  cascaded_changes: Array<{ table: string; id?: number; action: string }> | null;
  deferred_operations: Record<string, unknown> | null;
  rules_fired: string[] | null;
  triggered_by_user_id: number | null;
  external_event_id: string | null;
}

export interface RealtimeSyncLogDetail extends RealtimeSyncLogEntry {
  pre_snapshot: Record<string, unknown> | null;
  incoming_payload: Record<string, unknown> | null;
}

export interface RealtimeEventsListResponse {
  total: number;
  page: number;
  page_size: number;
  results: RealtimeSyncLogEntry[];
}

export interface ManualSyncResult {
  log_id: number;
  status: string;
  action_taken: string;
  field_changes: RealtimeSyncLogEntry['field_changes'];
  cascaded_changes: RealtimeSyncLogEntry['cascaded_changes'];
  deferred_operations: RealtimeSyncLogEntry['deferred_operations'];
  error_details: string | null;
}

// ── API calls ──────────────────────────────────────────────────────────────────

export async function listRealtimeEvents(params: {
  page?: number;
  page_size?: number;
  status?: string;
  sync_type?: string;
  event_type?: string;
  user_id_from_source?: number;
  date_from?: string;
  date_to?: string;
}): Promise<RealtimeEventsListResponse> {
  return api.get<RealtimeEventsListResponse>('/admin/realtime-events', { params });
}

export async function getRealtimeEvent(logId: number): Promise<RealtimeSyncLogDetail> {
  return api.get<RealtimeSyncLogDetail>(`/admin/realtime-events/${logId}`);
}

export async function manualSyncUser(
  payload: Record<string, unknown>,
): Promise<ManualSyncResult> {
  return api.post<ManualSyncResult>('/admin/realtime-events/sync-user', { payload });
}
