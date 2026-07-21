import { api } from "../client";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SyncRunListItem {
  syncRunId: number;
  syncType: string | null;
  entityType: string | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  recordsFetched: number;
}

export interface SyncedUserLogin {
  user_login: string;
  user_name: string;
}

export interface SyncedPartnerId {
  partner_id: number;
  partner_name: string;
}

export interface SyncRunDetail {
  syncRunId: number;
  syncType: string | null;
  entityType: string | null;
  updatedAfter: string | null;
  cursorEnd: string | null;
  targetIdentifier: string | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  recordsFetched: number;
  usersFetched: number;
  usersCreated: number;
  usersUpdated: number;
  partnersFetched: number;
  partnersCreated: number;
  partnersUpdated: number;
  errorDetails: string | null;
  triggeredByName: string | null;
  userLogins: SyncedUserLogin[] | null;
  partnerIds: SyncedPartnerId[] | null;
}

export interface EntityStat {
  total: number;
  active: number;
  inactive: number;
  removed: number;
  lastSuccessfulSync: string | null;
}

export interface EntityStats {
  user: EntityStat;
  partner: EntityStat;
  partnerWorknode: EntityStat;
}

export interface CronHealth {
  healthy: boolean;
  lastSuccessfulSyncAt: string | null;
  hoursSinceLastSuccess: number | null;
  nextExpectedRun: string | null;
  reason: string | null;
}

export interface AdminStats {
  entityStats: EntityStats;
  cronHealth: CronHealth;
}

// ── Raw backend shapes ─────────────────────────────────────────────────────────

interface RawSyncRunListItem {
  sync_run_id: number;
  sync_type: string | null;
  entity_type: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  records_fetched: number;
}

interface RawSyncRunDetail {
  sync_run_id: number;
  sync_type: string | null;
  entity_type: string | null;
  updated_after: string | null;
  cursor_end: string | null;
  target_identifier: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  records_fetched: number;
  users_fetched: number;
  users_created: number;
  users_updated: number;
  partners_fetched: number;
  partners_created: number;
  partners_updated: number;
  error_details: string | null;
  triggered_by_name: string | null;
  user_logins: SyncedUserLogin[] | null;
  partner_ids: SyncedPartnerId[] | null;
}

interface RawEntityStat {
  total: number;
  active: number;
  inactive: number;
  removed: number;
  last_successful_sync: string | null;
}

interface RawAdminStats {
  entity_stats: {
    user: RawEntityStat;
    partner: RawEntityStat;
    partner_worknode: RawEntityStat;
  };
  cron_health: {
    healthy: boolean;
    last_successful_sync_at: string | null;
    hours_since_last_success: number | null;
    next_expected_run: string | null;
    reason: string | null;
  };
}

// ── Mappers ────────────────────────────────────────────────────────────────────

function mapListItem(raw: RawSyncRunListItem): SyncRunListItem {
  return {
    syncRunId: raw.sync_run_id,
    syncType: raw.sync_type,
    entityType: raw.entity_type,
    status: raw.status,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
    recordsFetched: raw.records_fetched,
  };
}

function mapDetail(raw: RawSyncRunDetail): SyncRunDetail {
  return {
    syncRunId: raw.sync_run_id,
    syncType: raw.sync_type,
    entityType: raw.entity_type,
    updatedAfter: raw.updated_after,
    cursorEnd: raw.cursor_end,
    targetIdentifier: raw.target_identifier,
    status: raw.status,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
    recordsFetched: raw.records_fetched,
    usersFetched: raw.users_fetched ?? 0,
    usersCreated: raw.users_created ?? 0,
    usersUpdated: raw.users_updated ?? 0,
    partnersFetched: raw.partners_fetched ?? 0,
    partnersCreated: raw.partners_created ?? 0,
    partnersUpdated: raw.partners_updated ?? 0,
    errorDetails: raw.error_details,
    triggeredByName: raw.triggered_by_name,
    userLogins: raw.user_logins,
    partnerIds: raw.partner_ids,
  };
}

function mapEntityStat(raw: RawEntityStat): EntityStat {
  return {
    total: raw.total,
    active: raw.active,
    inactive: raw.inactive,
    removed: raw.removed,
    lastSuccessfulSync: raw.last_successful_sync,
  };
}

function mapStats(raw: RawAdminStats): AdminStats {
  return {
    entityStats: {
      user: mapEntityStat(raw.entity_stats.user),
      partner: mapEntityStat(raw.entity_stats.partner),
      partnerWorknode: mapEntityStat(raw.entity_stats.partner_worknode),
    },
    cronHealth: {
      healthy: raw.cron_health.healthy,
      lastSuccessfulSyncAt: raw.cron_health.last_successful_sync_at,
      hoursSinceLastSuccess: raw.cron_health.hours_since_last_success,
      nextExpectedRun: raw.cron_health.next_expected_run,
      reason: raw.cron_health.reason,
    },
  };
}

// ── API calls ──────────────────────────────────────────────────────────────────

// ── Sync user by login ─────────────────────────────────────────────────────────

export interface SyncUserByLoginOut {
  syncRunId: number;
  userLogin: string;
  userName: string;
}

interface RawSyncUserByLoginOut {
  sync_run_id: number;
  user_login: string;
  user_name: string;
}

export async function syncUserByLogin(userLogin: string): Promise<SyncUserByLoginOut> {
  const raw = await api.post<RawSyncUserByLoginOut>("/admin/sync/user-by-login/", {
    user_login: userLogin,
  });
  return {
    syncRunId: raw.sync_run_id,
    userLogin: raw.user_login,
    userName: raw.user_name,
  };
}

// ── Trigger manual sync ────────────────────────────────────────────────────────

export interface SyncTriggerOut {
  userRunId: number | null;
  partnerRunId: number | null;
  partnerWorknodeRunId: number | null;
}

interface RawSyncTriggerOut {
  user_run_id?: number | null;
  partner_run_id?: number | null;
  partner_worknode_run_id?: number | null;
}

function mapTriggerOut(raw: RawSyncTriggerOut): SyncTriggerOut {
  return {
    userRunId: raw.user_run_id ?? null,
    partnerRunId: raw.partner_run_id ?? null,
    partnerWorknodeRunId: raw.partner_worknode_run_id ?? null,
  };
}

export type SyncEntityType = "user" | "partner" | "partner_worknode";

/** Trigger all 3 entities together (global concurrent guard). */
export async function triggerManualSync(): Promise<SyncTriggerOut> {
  const raw = await api.post<RawSyncTriggerOut>("/admin/sync/trigger/", {});
  return mapTriggerOut(raw);
}

/** Trigger a single entity (per-entity concurrent guard). */
export async function triggerEntitySync(entity: SyncEntityType): Promise<SyncTriggerOut> {
  const raw = await api.post<RawSyncTriggerOut>(`/admin/sync/trigger/?entity=${entity}`, {});
  return mapTriggerOut(raw);
}

// ── Existing read API calls ────────────────────────────────────────────────────

export async function fetchSyncRuns(limit = 50): Promise<SyncRunListItem[]> {
  const raw = await api.get<RawSyncRunListItem[]>("/admin/sync/runs/", { params: { limit } });
  return raw.map(mapListItem);
}

export async function fetchSyncRunDetail(runId: number): Promise<SyncRunDetail> {
  const raw = await api.get<RawSyncRunDetail>(`/admin/sync/runs/${runId}/`);
  return mapDetail(raw);
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const raw = await api.get<RawAdminStats>("/admin/sync/stats/");
  return mapStats(raw);
}
