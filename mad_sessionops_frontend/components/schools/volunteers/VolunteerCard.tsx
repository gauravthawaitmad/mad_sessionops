"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { User } from "lucide-react";
import type { VolunteerCard as VolunteerCardType } from "@/lib/api/services/volunteers.service";

// ── Design tokens ──────────────────────────────────────────────────────────────

const BORDER = "#E2E8F0";
const TEXT = "#1E293B";
const MUTED = "#64748B";
const SUBTLE = "#94A3B8";
const PILL_BG = "#F0FDF4";
const PILL_FG = "#16A34A";
const ZERO_BG = "#F8FAFC";
const ZERO_FG = "#94A3B8";

interface Props {
  volunteer: VolunteerCardType;
  onClick: () => void;
}

function roleChip(role: string) {
  const lower = role.toLowerCase();
  const isWingman = lower.includes("wingman");
  return {
    bg: isWingman ? "#EFF6FF" : "#FFF7ED",
    fg: isWingman ? "#1D4ED8" : "#C2410C",
    label: role,
  };
}

export function VolunteerCard({ volunteer, onClick }: Props) {
  const { activeSlotClassCount } = volunteer;
  const chip = roleChip(volunteer.userRole);

  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 2.5,
        py: 1.75,
        borderRadius: "10px",
        border: `1px solid ${BORDER}`,
        bgcolor: "#fff",
        cursor: "pointer",
        transition: "box-shadow 0.12s ease, border-color 0.12s ease",
        "&:hover": { boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderColor: "#93C5FD" },
      }}
    >
      {/* Avatar */}
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          bgcolor: "#EFF6FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <User size={16} strokeWidth={1.75} color="#2563EB" />
      </Box>

      {/* Name + login */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: "14px",
            fontWeight: 600,
            color: TEXT,
            lineHeight: "20px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {volunteer.userDisplayName}
        </Typography>
        <Typography
          sx={{
            fontSize: "12px",
            color: MUTED,
            lineHeight: "18px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {volunteer.userLogin}
        </Typography>
      </Box>

      {/* Role chip */}
      <Box
        sx={{
          px: 1.25,
          py: 0.375,
          borderRadius: "6px",
          bgcolor: chip.bg,
          flexShrink: 0,
        }}
      >
        <Typography sx={{ fontSize: "11px", fontWeight: 600, color: chip.fg }}>
          {chip.label}
        </Typography>
      </Box>

      {/* Active class count badge */}
      <Box
        sx={{
          px: 1.25,
          py: 0.375,
          borderRadius: "6px",
          bgcolor: activeSlotClassCount > 0 ? PILL_BG : ZERO_BG,
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            fontSize: "11px",
            fontWeight: 600,
            color: activeSlotClassCount > 0 ? PILL_FG : ZERO_FG,
            whiteSpace: "nowrap",
          }}
        >
          {activeSlotClassCount > 0
            ? `${activeSlotClassCount} class${activeSlotClassCount !== 1 ? "es" : ""}`
            : "Not teaching"}
        </Typography>
      </Box>
    </Box>
  );
}
