"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { CheckCircle, Users, Building2, Network } from "lucide-react";
import type { EntityStat } from "@/lib/api/services/syncAdmin.service";

const ICONS: Record<string, React.ElementType> = {
  user: Users,
  partner: Building2,
  partnerWorknode: Network,
};

const LABELS: Record<string, string> = {
  user: "Users",
  partner: "Partners",
  partnerWorknode: "Partner Worknodes",
};

interface EntityStatCardProps {
  entityKey: string;
  stat: EntityStat;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function EntityStatCard({ entityKey, stat }: EntityStatCardProps) {
  const Icon = ICONS[entityKey] ?? Users;
  const label = LABELS[entityKey] ?? entityKey;

  return (
    <Box
      sx={{
        border: "1px solid #E2E8F0",
        borderRadius: "10px",
        p: 2,
        bgcolor: "#FFFFFF",
        flex: 1,
        minWidth: 200,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Icon size={16} color="#64748B" strokeWidth={1.75} />
        <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
          {label}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 2, mb: 1.5 }}>
        <Tooltip title="Active">
          <Box sx={{ textAlign: "center" }}>
            <Typography
              sx={{ fontSize: "20px", fontWeight: 700, color: "#16A34A", lineHeight: 1.2 }}
            >
              {stat.active.toLocaleString()}
            </Typography>
            <Typography sx={{ fontSize: "10px", color: "#64748B" }}>active</Typography>
          </Box>
        </Tooltip>
        <Tooltip title="Inactive">
          <Box sx={{ textAlign: "center" }}>
            <Typography
              sx={{ fontSize: "20px", fontWeight: 700, color: "#D97706", lineHeight: 1.2 }}
            >
              {stat.inactive.toLocaleString()}
            </Typography>
            <Typography sx={{ fontSize: "10px", color: "#64748B" }}>inactive</Typography>
          </Box>
        </Tooltip>
        <Tooltip title="Removed">
          <Box sx={{ textAlign: "center" }}>
            <Typography
              sx={{ fontSize: "20px", fontWeight: 700, color: "#DC2626", lineHeight: 1.2 }}
            >
              {stat.removed.toLocaleString()}
            </Typography>
            <Typography sx={{ fontSize: "10px", color: "#64748B" }}>removed</Typography>
          </Box>
        </Tooltip>
      </Box>

      <Box sx={{ borderTop: "1px solid #F1F5F9", pt: 1 }}>
        <Typography sx={{ fontSize: "10px", color: "#94A3B8" }}>
          Last sync: {fmtDate(stat.lastSuccessfulSync)}
        </Typography>
      </Box>
    </Box>
  );
}
