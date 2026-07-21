"use client";

import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getRealtimeEvent } from "@/lib/api/services/realtimeSync.service";
import type { RealtimeSyncLogDetail } from "@/lib/api/services/realtimeSync.service";

interface RealtimeEventDetailProps {
  logId: number | null;
  onClose: () => void;
}

const BORDER = "#E2E8F0";

// ── Collapsible JSON section ───────────────────────────────────────────────────

function JsonSection({ title, data }: { title: string; data: unknown }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <Box>
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          cursor: "pointer",
          py: 0.75,
          "&:hover": { opacity: 0.75 },
        }}
      >
        {open ? (
          <ChevronDown size={13} color="#64748B" />
        ) : (
          <ChevronRight size={13} color="#64748B" />
        )}
        <Typography sx={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
          {title}
        </Typography>
      </Box>
      <Collapse in={open}>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1.25,
            bgcolor: "#F8FAFC",
            borderRadius: "6px",
            border: `1px solid ${BORDER}`,
            fontSize: "11px",
            fontFamily: "monospace",
            color: "#334155",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {JSON.stringify(data, null, 2)}
        </Box>
      </Collapse>
    </Box>
  );
}

// ── Field changes table ────────────────────────────────────────────────────────

function FieldChangesTable({
  changes,
}: {
  changes: Array<{ field: string; old: unknown; new: unknown }>;
}) {
  if (!changes.length)
    return <Typography sx={{ fontSize: "12px", color: "#94A3B8" }}>—</Typography>;
  return (
    <Box
      component="table"
      sx={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "12px",
        "& th, & td": { px: 1, py: 0.625, textAlign: "left", borderBottom: `1px solid ${BORDER}` },
        "& th": { bgcolor: "#FAFBFC", fontWeight: 600, color: "#64748B", fontSize: "11px" },
      }}
    >
      <thead>
        <tr>
          <th>Field</th>
          <th>Before</th>
          <th>After</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((c, i) => (
          <tr key={i}>
            <td>
              <Typography sx={{ fontSize: "11px", fontFamily: "monospace", color: "#334155" }}>
                {c.field}
              </Typography>
            </td>
            <td>
              <Typography sx={{ fontSize: "11px", color: "#DC2626" }}>
                {String(c.old ?? "—")}
              </Typography>
            </td>
            <td>
              <Typography sx={{ fontSize: "11px", color: "#16A34A" }}>
                {String(c.new ?? "—")}
              </Typography>
            </td>
          </tr>
        ))}
      </tbody>
    </Box>
  );
}

// ── Cascaded changes table ─────────────────────────────────────────────────────

function CascadeTable({
  changes,
}: {
  changes: Array<{ table: string; id?: number; action: string }>;
}) {
  if (!changes.length)
    return <Typography sx={{ fontSize: "12px", color: "#94A3B8" }}>—</Typography>;
  return (
    <Box
      component="table"
      sx={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "12px",
        "& th, & td": { px: 1, py: 0.625, textAlign: "left", borderBottom: `1px solid ${BORDER}` },
        "& th": { bgcolor: "#FAFBFC", fontWeight: 600, color: "#64748B", fontSize: "11px" },
      }}
    >
      <thead>
        <tr>
          <th>Table</th>
          <th>ID</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((c, i) => (
          <tr key={i}>
            <td>
              <Typography sx={{ fontSize: "11px", fontFamily: "monospace", color: "#334155" }}>
                {c.table}
              </Typography>
            </td>
            <td>
              <Typography sx={{ fontSize: "11px", color: "#64748B" }}>{c.id ?? "—"}</Typography>
            </td>
            <td>
              <Typography sx={{ fontSize: "11px", color: "#475569" }}>
                {c.action.replace(/_/g, " ")}
              </Typography>
            </td>
          </tr>
        ))}
      </tbody>
    </Box>
  );
}

// ── Label + value row ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
      <Typography
        sx={{ fontSize: "11px", color: "#94A3B8", fontWeight: 500, minWidth: 140, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: "12px", color: "#0F172A", wordBreak: "break-all" }}>
        {value ?? "—"}
      </Typography>
    </Box>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: "10px",
        fontWeight: 700,
        color: "#94A3B8",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        mb: 1,
      }}
    >
      {children}
    </Typography>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function RealtimeEventDetail({ logId, onClose }: RealtimeEventDetailProps) {
  const [detail, setDetail] = useState<RealtimeSyncLogDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (logId === null) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    getRealtimeEvent(logId)
      .then(setDetail)
      .catch(() => setError("Failed to load event details"))
      .finally(() => setLoading(false));
  }, [logId]);

  function fmtTs(iso: string | null) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("en-IN");
    } catch {
      return iso;
    }
  }

  return (
    <Dialog open={logId !== null} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontSize: "14px", fontWeight: 700, pb: 1 }}>
        {loading ? "Loading…" : detail ? `Event #${detail.realtime_sync_log_id}` : "Event Detail"}
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {error && (
          <Box sx={{ p: 3 }}>
            <Typography sx={{ fontSize: "13px", color: "#DC2626" }}>{error}</Typography>
          </Box>
        )}

        {detail && !loading && (
          <Box sx={{ px: 3, py: 2, display: "flex", flexDirection: "column", gap: 2.5 }}>
            {/* Header info */}
            <Box>
              <SectionHeader>Overview</SectionHeader>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.875 }}>
                <InfoRow
                  label="Status"
                  value={
                    <Box
                      component="span"
                      sx={{
                        fontWeight: 600,
                        color: detail.status.startsWith("skipped")
                          ? "#94A3B8"
                          : detail.status === "failed"
                            ? "#DC2626"
                            : "#16A34A",
                      }}
                    >
                      {detail.status}
                    </Box>
                  }
                />
                <InfoRow label="Action taken" value={detail.action_taken.replace(/_/g, " ")} />
                <InfoRow label="Received" value={fmtTs(detail.received_at)} />
                <InfoRow label="Processed" value={fmtTs(detail.processed_at)} />
              </Box>
            </Box>

            <Divider />

            {/* User info */}
            <Box>
              <SectionHeader>Sync details</SectionHeader>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.875 }}>
                <InfoRow label="User ID (source)" value={detail.user_id_from_source} />
                <InfoRow label="Sync type" value={detail.sync_type} />
                <InfoRow label="Event type" value={detail.event_type} />
                <InfoRow
                  label="Triggered by"
                  value={
                    detail.triggered_by_user_id
                      ? `User #${detail.triggered_by_user_id}`
                      : "automated"
                  }
                />
                {detail.external_event_id && (
                  <InfoRow label="External event ID" value={detail.external_event_id} />
                )}
              </Box>
            </Box>

            {/* Field changes */}
            {detail.field_changes && detail.field_changes.length > 0 && (
              <>
                <Divider />
                <Box>
                  <SectionHeader>Field changes</SectionHeader>
                  <FieldChangesTable
                    changes={
                      detail.field_changes as Array<{ field: string; old: unknown; new: unknown }>
                    }
                  />
                </Box>
              </>
            )}

            {/* Cascaded changes */}
            {detail.cascaded_changes && detail.cascaded_changes.length > 0 && (
              <>
                <Divider />
                <Box>
                  <SectionHeader>Cascaded changes ({detail.cascaded_changes.length})</SectionHeader>
                  <CascadeTable
                    changes={
                      detail.cascaded_changes as Array<{
                        table: string;
                        id?: number;
                        action: string;
                      }>
                    }
                  />
                </Box>
              </>
            )}

            {/* Rules fired */}
            {detail.rules_fired && detail.rules_fired.length > 0 && (
              <>
                <Divider />
                <Box>
                  <SectionHeader>Rules fired</SectionHeader>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {detail.rules_fired.map((r) => (
                      <Box
                        key={r}
                        sx={{ px: 0.875, py: 0.25, bgcolor: "#EFF6FF", borderRadius: "4px" }}
                      >
                        <Typography
                          sx={{ fontSize: "11px", fontFamily: "monospace", color: "#0284C7" }}
                        >
                          {r}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </>
            )}

            {/* Error details */}
            {detail.error_details && (
              <>
                <Divider />
                <Box>
                  <SectionHeader>Error details</SectionHeader>
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 1.25,
                      bgcolor: "#FEF2F2",
                      borderRadius: "6px",
                      border: "1px solid #FECACA",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      color: "#DC2626",
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {detail.error_details}
                  </Box>
                </Box>
              </>
            )}

            {/* Deferred operations */}
            {detail.deferred_operations && (
              <>
                <Divider />
                <JsonSection title="Deferred operations" data={detail.deferred_operations} />
              </>
            )}

            {/* Pre-snapshot and incoming payload */}
            <Divider />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <SectionHeader>Snapshots</SectionHeader>
              <JsonSection title="Pre-snapshot (before sync)" data={detail.pre_snapshot} />
              <JsonSection title="Incoming payload" data={detail.incoming_payload} />
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} size="small" color="inherit">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
