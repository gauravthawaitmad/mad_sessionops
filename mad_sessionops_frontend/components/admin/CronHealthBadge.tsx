"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import type { CronHealth } from "@/lib/api/services/syncAdmin.service";

interface CronHealthBadgeProps {
  health: CronHealth;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function CronHealthBadge({ health }: CronHealthBadgeProps) {
  const Icon = health.healthy ? CheckCircle : XCircle;
  const color = health.healthy ? "#16A34A" : "#DC2626";
  const bg = health.healthy ? "#F0FDF4" : "#FEF2F2";
  const label = health.healthy ? "Cron healthy" : "Cron silent";

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          px: 1.5,
          py: 0.5,
          borderRadius: "20px",
          bgcolor: bg,
          border: `1px solid ${color}20`,
        }}
      >
        <Icon size={14} color={color} strokeWidth={2} />
        <Typography sx={{ fontSize: "12px", fontWeight: 600, color }}>{label}</Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap" }}>
        <Box>
          <Typography sx={{ fontSize: "10px", color: "#94A3B8", mb: 0.25 }}>
            Last success
          </Typography>
          <Typography sx={{ fontSize: "12px", color: "#334155" }}>
            {fmtDate(health.lastSuccessfulSyncAt)}
            {health.hoursSinceLastSuccess !== null && (
              <Typography component="span" sx={{ fontSize: "10px", color: "#94A3B8", ml: 0.5 }}>
                ({health.hoursSinceLastSuccess.toFixed(1)}h ago)
              </Typography>
            )}
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: "10px", color: "#94A3B8", mb: 0.25 }}>
            <Clock size={10} style={{ verticalAlign: "middle", marginRight: 2 }} />
            Next run
          </Typography>
          <Typography sx={{ fontSize: "12px", color: "#334155" }}>
            {fmtDate(health.nextExpectedRun)}
          </Typography>
        </Box>
        {health.reason === "no_successful_sync_ever" && (
          <Typography sx={{ fontSize: "11px", color: "#DC2626", alignSelf: "center" }}>
            No successful sync on record
          </Typography>
        )}
      </Box>
    </Box>
  );
}
