"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { CheckCircle, XCircle, Loader, Users, Building2, Network, Zap } from "lucide-react";
import type { SyncRunListItem } from "@/lib/api/services/syncAdmin.service";

interface SyncRunListProps {
  runs: SyncRunListItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

const STATUS_COLOR: Record<string, string> = {
  success: "#16A34A",
  failed: "#DC2626",
  running: "#0284C7",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  success: CheckCircle,
  failed: XCircle,
  running: Loader,
};

const ENTITY_ICON: Record<string, React.ElementType> = {
  user: Users,
  partner: Building2,
  partner_worknode: Network,
};

const ENTITY_LABEL: Record<string, string> = {
  user: "Users",
  partner: "Partners",
  partner_worknode: "PW Nodes",
};

const TYPE_LABEL: Record<string, string> = {
  auto: "cron",
  manual: "manual",
  manual_single_user: "single user",
};

const TYPE_COLOR: Record<string, string> = {
  auto: "#64748B",
  manual: "#7C3AED",
  manual_single_user: "#0284C7",
};

function fmtShort(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const isSameDay = d.toDateString() === now.toDateString();
    if (isSameDay) {
      return d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "";
  const secs = Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export function SyncRunList({ runs, selectedId, onSelect }: SyncRunListProps) {
  if (runs.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography sx={{ fontSize: "12px", color: "#94A3B8" }}>No sync runs yet</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ overflowY: "auto", flex: 1 }}>
      {runs.map((run) => {
        const isRunning = run.status === "running";
        const statusColor = STATUS_COLOR[run.status] ?? "#64748B";
        const StatusIcon = STATUS_ICON[run.status] ?? CheckCircle;
        const EntityIcon = run.entityType ? (ENTITY_ICON[run.entityType] ?? Zap) : Zap;
        const entityLabel = run.entityType
          ? (ENTITY_LABEL[run.entityType] ?? run.entityType)
          : "all";
        const typeLabel = run.syncType ? (TYPE_LABEL[run.syncType] ?? run.syncType) : null;
        const typeColor = run.syncType ? (TYPE_COLOR[run.syncType] ?? "#64748B") : "#64748B";
        const duration = fmtDuration(run.startedAt, run.completedAt);
        const isSelected = run.syncRunId === selectedId;

        return (
          <Box
            key={run.syncRunId}
            onClick={() => onSelect(run.syncRunId)}
            sx={{
              px: 1.75,
              py: 1,
              borderBottom: "1px solid #F1F5F9",
              cursor: "pointer",
              bgcolor: isSelected ? "#EFF6FF" : "transparent",
              borderLeft: isSelected ? "2px solid #0284C7" : "2px solid transparent",
              transition: "background 0.1s ease",
              "&:hover": { bgcolor: isSelected ? "#EFF6FF" : "#F8FAFC" },
              display: "flex",
              alignItems: "flex-start",
              gap: 1,
            }}
          >
            {/* Status icon */}
            <StatusIcon
              size={13}
              color={statusColor}
              strokeWidth={2}
              style={{
                marginTop: 3,
                flexShrink: 0,
                animation: isRunning ? "spin 1.2s linear infinite" : undefined,
              }}
            />

            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Row 1: entity + type badge */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.625, mb: 0.25 }}>
                <EntityIcon size={11} color="#64748B" strokeWidth={1.75} />
                <Typography sx={{ fontSize: "11px", fontWeight: 600, color: "#334155" }}>
                  {entityLabel}
                </Typography>
                {typeLabel && (
                  <Typography
                    sx={{
                      fontSize: "9px",
                      color: typeColor,
                      fontWeight: 500,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {typeLabel}
                  </Typography>
                )}
              </Box>

              {/* Row 2: time + records + duration */}
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: "10px", color: "#94A3B8" }}>
                  {fmtShort(run.startedAt)}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  {run.recordsFetched > 0 && (
                    <Typography sx={{ fontSize: "9px", color: "#64748B" }}>
                      {run.recordsFetched.toLocaleString()} rec
                    </Typography>
                  )}
                  {duration && (
                    <Typography sx={{ fontSize: "9px", color: "#94A3B8" }}>{duration}</Typography>
                  )}
                  {isRunning && (
                    <Typography sx={{ fontSize: "9px", color: "#0284C7", fontWeight: 600 }}>
                      live
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
