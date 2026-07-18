"use client";

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import {
  RefreshCw,
  UserSearch,
  Users,
  Building2,
  Network,
  CheckCircle,
  XCircle,
  Loader,
} from "lucide-react";
import { SyncRunList } from "./SyncRunList";
import { SyncRunDetail } from "./SyncRunDetail";
import toast from "react-hot-toast";
import {
  fetchAdminStats,
  fetchSyncRunDetail,
  fetchSyncRuns,
  syncUserByLogin,
  triggerEntitySync,
  triggerManualSync,
} from "@/lib/api/services/syncAdmin.service";
import type {
  AdminStats,
  SyncEntityType,
  SyncRunDetail as SyncRunDetailType,
  SyncRunListItem,
} from "@/lib/api/services/syncAdmin.service";

const BORDER = "#E2E8F0";

// ── Tab config ────────────────────────────────────────────────────────────────

interface TabConfig {
  key: SyncEntityType;
  label: string;
  Icon: React.ElementType;
  color: string;
  bg: string;
  statKey: "user" | "partner" | "partnerWorknode";
}

const TABS: TabConfig[] = [
  { key: "user", label: "Users", Icon: Users, color: "#0284C7", bg: "#EFF6FF", statKey: "user" },
  {
    key: "partner",
    label: "Partners",
    Icon: Building2,
    color: "#7C3AED",
    bg: "#F5F3FF",
    statKey: "partner",
  },
  {
    key: "partner_worknode",
    label: "PW Nodes",
    Icon: Network,
    color: "#059669",
    bg: "#F0FDF4",
    statKey: "partnerWorknode",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtLastSync(iso: string | null | undefined): string {
  if (!iso) return "Never";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffH = (now.getTime() - d.getTime()) / 3_600_000;
    if (diffH < 1) return `${Math.round(diffH * 60)}m ago`;
    if (diffH < 24) return `${Math.round(diffH)}h ago`;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch {
    return iso ?? "—";
  }
}

// ── Chrome-style tab button ───────────────────────────────────────────────────

interface TabButtonProps {
  tab: TabConfig;
  isActive: boolean;
  hasRunning: boolean;
  onClick: () => void;
}

function TabButton({ tab, isActive, hasRunning, onClick }: TabButtonProps) {
  const { Icon, label, color } = tab;
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        px: 1.75,
        py: 1,
        cursor: "pointer",
        borderRadius: "8px 8px 0 0",
        borderTop: isActive ? `2px solid ${color}` : "2px solid transparent",
        borderLeft: `1px solid ${isActive ? BORDER : "transparent"}`,
        borderRight: `1px solid ${isActive ? BORDER : "transparent"}`,
        borderBottom: isActive ? "1px solid #FFF" : "1px solid transparent",
        bgcolor: isActive ? "#FFF" : "transparent",
        mb: isActive ? "-1px" : 0,
        transition: "all 0.1s",
        "&:hover": { bgcolor: isActive ? "#FFF" : "#F1F5F9" },
      }}
    >
      <Icon size={13} color={isActive ? color : "#94A3B8"} strokeWidth={2} />
      <Typography
        sx={{
          fontSize: "12px",
          fontWeight: isActive ? 700 : 500,
          color: isActive ? "#0F172A" : "#64748B",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Typography>
      {hasRunning && (
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            bgcolor: "#0284C7",
            animation: "pulse 1.5s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
      )}
    </Box>
  );
}

// ── Single user sync form ─────────────────────────────────────────────────────

interface SingleUserFormProps {
  disabled: boolean;
  onSyncComplete: () => void;
}

function SingleUserForm({ disabled, onSyncComplete }: SingleUserFormProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [inlineErr, setInlineErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setInlineErr(null);
    try {
      const result = await syncUserByLogin(trimmed);
      toast.success(`Synced ${result.userName} (Run #${result.syncRunId})`);
      setEmail("");
      onSyncComplete();
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status;
      if (status === 404) setInlineErr("No user found with this email in Hasura");
      else if (status === 409) toast.error("Another sync is in progress. Try again shortly.");
      else toast.error("Sync failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        border: `1px solid ${BORDER}`,
        borderRadius: "8px",
        p: 2,
        bgcolor: "#FFF",
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.875 }}>
        <Box sx={{ p: 0.5, borderRadius: "6px", bgcolor: "#FFF7ED" }}>
          <UserSearch size={13} color="#EA580C" strokeWidth={2} />
        </Box>
        <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#0F172A" }}>
          Sync Single User
        </Typography>
      </Box>
      <Typography sx={{ fontSize: "11px", color: "#64748B", lineHeight: 1.5 }}>
        Fetch and update one user from Hasura by login email.
      </Typography>
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
      >
        <TextField
          size="small"
          type="email"
          placeholder="user@makeadiff.in"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setInlineErr(null);
          }}
          disabled={disabled || loading}
          error={Boolean(inlineErr)}
          helperText={inlineErr ?? ""}
          inputProps={{ maxLength: 254 }}
          sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: "12px" } }}
        />
        <Button
          type="submit"
          variant="outlined"
          size="small"
          disabled={disabled || loading || !email.trim()}
          startIcon={loading ? <CircularProgress size={12} color="inherit" /> : undefined}
          sx={{ fontSize: "11px", textTransform: "none", flexShrink: 0 }}
        >
          {loading ? "Syncing…" : "Sync"}
        </Button>
      </Box>
    </Box>
  );
}

// ── Entity stat row ───────────────────────────────────────────────────────────

interface StatBadgeProps {
  count: number;
  label: string;
  color: string;
}

function StatBadge({ count, label, color }: StatBadgeProps) {
  return (
    <Box>
      <Typography sx={{ fontSize: "20px", fontWeight: 700, color, lineHeight: 1.1 }}>
        {count.toLocaleString()}
      </Typography>
      <Typography sx={{ fontSize: "10px", color: "#64748B", fontWeight: 500 }}>{label}</Typography>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DataSyncTab() {
  const [activeTab, setActiveTab] = useState<SyncEntityType>("user");
  const [runs, setRuns] = useState<SyncRunListItem[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SyncRunDetailType | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingEntity, setSyncingEntity] = useState<SyncEntityType | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [runsData, statsData] = await Promise.all([fetchSyncRuns(), fetchAdminStats()]);
      setRuns(runsData);
      setStats(statsData);
      setError(null);
      setLastRefreshed(new Date());
    } catch {
      setError("Failed to load sync data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const handleRefreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      await load();
    } finally {
      setStatusLoading(false);
    }
  }, [load]);

  const handleSelectRun = useCallback(async (id: number) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      setDetail(await fetchSyncRunDetail(id));
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSyncEntity = useCallback(
    async (entityKey: SyncEntityType) => {
      setSyncingEntity(entityKey);
      try {
        const result = await triggerEntitySync(entityKey);
        await load();
        const runId =
          entityKey === "user"
            ? result.userRunId
            : entityKey === "partner"
              ? result.partnerRunId
              : result.partnerWorknodeRunId;
        if (runId) {
          setSelectedId(runId);
          setDetailLoading(true);
          try {
            setDetail(await fetchSyncRunDetail(runId));
          } catch {
            setDetail(null);
          } finally {
            setDetailLoading(false);
          }
        }
      } catch (err: any) {
        const status = err?.response?.status ?? err?.status;
        toast.error(
          status === 409 ? "This entity sync is already running." : "Failed to start sync."
        );
      } finally {
        setSyncingEntity(null);
      }
    },
    [load]
  );

  const handleSyncAll = useCallback(async () => {
    setSyncingAll(true);
    try {
      await triggerManualSync();
      await load();
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status;
      toast.error(
        status === 409 ? "Another sync is already in progress." : "Failed to start sync."
      );
    } finally {
      setSyncingAll(false);
    }
  }, [load]);

  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );

  if (error)
    return (
      <Box sx={{ p: 3 }}>
        <Typography sx={{ fontSize: "13px", color: "#DC2626" }}>{error}</Typography>
      </Box>
    );

  const tab = TABS.find((t) => t.key === activeTab)!;
  const stat = stats?.entityStats[tab.statKey] ?? null;
  const tabRuns = runs.filter((r) => r.entityType === activeTab);
  const lastRun = tabRuns[0];
  const isRunning = lastRun?.status === "running";
  const isSyncing = syncingEntity === activeTab || syncingAll;
  const isActive = isSyncing || isRunning;

  const anyRunningEntity = (key: SyncEntityType) =>
    syncingAll ||
    syncingEntity === key ||
    runs.some((r) => r.entityType === key && r.status === "running");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* ── Chrome tab bar ──────────────────────────────────────────────── */}
      <Box
        sx={{
          borderBottom: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "flex-end",
          px: 2.5,
          pt: 1.5,
          gap: 0.5,
          bgcolor: "#F8FAFC",
          flexShrink: 0,
        }}
      >
        {TABS.map((t) => (
          <TabButton
            key={t.key}
            tab={t}
            isActive={activeTab === t.key}
            hasRunning={anyRunningEntity(t.key)}
            onClick={() => {
              setActiveTab(t.key);
              setSelectedId(null);
              setDetail(null);
            }}
          />
        ))}

        <Box sx={{ flex: 1 }} />

        {/* Sync All */}
        <Button
          variant="outlined"
          size="small"
          startIcon={
            syncingAll ? <CircularProgress size={11} color="inherit" /> : <RefreshCw size={12} />
          }
          onClick={handleSyncAll}
          disabled={syncingAll || syncingEntity !== null}
          sx={{
            fontSize: "11px",
            textTransform: "none",
            mb: 0.75,
            borderColor: BORDER,
            color: "#475569",
            "&:hover": { borderColor: "#94A3B8" },
          }}
        >
          {syncingAll ? "Syncing all…" : "Sync all"}
        </Button>
      </Box>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 2.5,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {/* ── Top: stat + sync button + (users: single user form) ───── */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {/* Entity stat card */}
          <Box
            sx={{
              border: `1px solid ${BORDER}`,
              borderRadius: "10px",
              p: 2,
              bgcolor: "#FFF",
              minWidth: 200,
              flex: "0 0 auto",
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.875 }}>
              <Box sx={{ p: 0.625, borderRadius: "6px", bgcolor: tab.bg }}>
                <tab.Icon size={14} color={tab.color} strokeWidth={2} />
              </Box>
              <Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>
                {tab.label}
              </Typography>
              {isActive && (
                <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.375 }}>
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: "#0284C7",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  />
                  <Typography sx={{ fontSize: "9px", color: "#0284C7", fontWeight: 700 }}>
                    LIVE
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Counts */}
            {stat && (
              <Box sx={{ display: "flex", gap: 2 }}>
                <StatBadge count={stat.active} label="active" color="#0F172A" />
                {stat.inactive > 0 && (
                  <StatBadge count={stat.inactive} label="inactive" color="#D97706" />
                )}
                {stat.removed > 0 && (
                  <StatBadge count={stat.removed} label="removed" color="#DC2626" />
                )}
              </Box>
            )}

            <Divider />

            {/* Last sync + status */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: "10px", color: "#94A3B8" }}>
                Last sync: {fmtLastSync(stat?.lastSuccessfulSync)}
              </Typography>
              {lastRun && (
                <Box
                  onClick={() => handleSelectRun(lastRun.syncRunId)}
                  sx={{
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.375,
                    "&:hover": { opacity: 0.75 },
                  }}
                >
                  {lastRun.status === "success" && (
                    <>
                      <CheckCircle size={11} color="#16A34A" strokeWidth={2} />
                      <Typography sx={{ fontSize: "10px", color: "#16A34A", fontWeight: 600 }}>
                        success
                      </Typography>
                    </>
                  )}
                  {lastRun.status === "failed" && (
                    <>
                      <XCircle size={11} color="#DC2626" strokeWidth={2} />
                      <Typography sx={{ fontSize: "10px", color: "#DC2626", fontWeight: 600 }}>
                        failed
                      </Typography>
                    </>
                  )}
                  {lastRun.status === "running" && (
                    <>
                      <Loader
                        size={11}
                        color="#0284C7"
                        strokeWidth={2}
                        style={{ animation: "spin 1.2s linear infinite" }}
                      />
                      <Typography sx={{ fontSize: "10px", color: "#0284C7", fontWeight: 600 }}>
                        running
                      </Typography>
                    </>
                  )}
                </Box>
              )}
            </Box>

            {/* Sync button */}
            <Button
              variant="outlined"
              size="small"
              startIcon={
                isActive ? <CircularProgress size={12} color="inherit" /> : <RefreshCw size={13} />
              }
              onClick={() => handleSyncEntity(activeTab)}
              disabled={isActive}
              sx={{
                fontSize: "11px",
                textTransform: "none",
                alignSelf: "flex-start",
                borderColor: tab.color,
                color: tab.color,
                "&:hover": { borderColor: tab.color, bgcolor: tab.bg },
              }}
            >
              {isActive ? "Syncing…" : `Sync ${tab.label.toLowerCase()}`}
            </Button>
          </Box>

          {/* Users tab: single user form */}
          {activeTab === "user" && (
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <SingleUserForm
                disabled={Boolean(syncingEntity) || syncingAll || isRunning}
                onSyncComplete={load}
              />
            </Box>
          )}
        </Box>

        {/* ── Sync history ────────────────────────────────────────────── */}
        <Box
          sx={{
            border: `1px solid ${BORDER}`,
            borderRadius: "10px",
            overflow: "hidden",
            flex: 1,
            minHeight: 320,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 1.75,
              py: 1,
              borderBottom: `1px solid ${BORDER}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              bgcolor: "#FAFBFC",
              flexShrink: 0,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography
                sx={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#94A3B8",
                  letterSpacing: "0.08em",
                }}
              >
                SYNC HISTORY
              </Typography>
              {isRunning && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: "#0284C7",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  />
                  <Typography sx={{ fontSize: "9px", color: "#0284C7", fontWeight: 700 }}>
                    LIVE
                  </Typography>
                </Box>
              )}
              {lastRefreshed && (
                <Typography sx={{ fontSize: "10px", color: "#CBD5E1" }}>
                  · as of{" "}
                  {lastRefreshed.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </Typography>
              )}
            </Box>

            <Button
              variant="outlined"
              size="small"
              startIcon={
                statusLoading ? (
                  <CircularProgress size={11} color="inherit" />
                ) : (
                  <RefreshCw size={11} />
                )
              }
              onClick={handleRefreshStatus}
              disabled={statusLoading}
              sx={{
                fontSize: "10px",
                textTransform: "none",
                py: 0.25,
                px: 0.875,
                borderColor: "#E2E8F0",
                color: "#64748B",
                "&:hover": { borderColor: "#94A3B8", bgcolor: "#F8FAFC" },
              }}
            >
              {statusLoading ? "Refreshing…" : "Refresh status"}
            </Button>
          </Box>

          {/* Master + detail */}
          <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
            <Box
              sx={{
                width: 240,
                flexShrink: 0,
                borderRight: `1px solid ${BORDER}`,
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
              }}
            >
              <SyncRunList runs={tabRuns} selectedId={selectedId} onSelect={handleSelectRun} />
            </Box>
            <Box sx={{ flex: 1, overflow: "hidden" }}>
              <SyncRunDetail run={detail} loading={detailLoading} />
            </Box>
          </Box>
        </Box>
      </Box>

      <style>{`
        @keyframes spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </Box>
  );
}
