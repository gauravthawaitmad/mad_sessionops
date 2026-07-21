"use client";

import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { type HolidayOut, type HolidayReason } from "@/lib/api/services/holidays.service";

// ── Reason colours ────────────────────────────────────────────────────────────

const REASON_STYLES: Record<HolidayReason, { bg: string; border: string; text: string }> = {
  mad_event: { bg: "#EDE9FE", border: "#C4B5FD", text: "#5B21B6" },
  holidays: { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E" },
  cancelled_from_school_end: { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B" },
};

interface HolidayPillProps {
  holiday: HolidayOut;
  onClick?: (holiday: HolidayOut) => void;
}

export function HolidayPill({ holiday, onClick }: HolidayPillProps) {
  const style = REASON_STYLES[holiday.holidayReason] ?? REASON_STYLES.holidays;
  const label = holiday.holidayDescription ?? holiday.holidayReasonDisplay;

  return (
    <Tooltip
      title={
        <Box>
          <Typography sx={{ fontSize: "12px", fontWeight: 600 }}>
            {holiday.holidayReasonDisplay}
          </Typography>
          {holiday.holidayDescription && (
            <Typography sx={{ fontSize: "11px", opacity: 0.85, mt: 0.25 }}>
              {holiday.holidayDescription}
            </Typography>
          )}
          {holiday.startDate !== holiday.endDate && (
            <Typography sx={{ fontSize: "11px", opacity: 0.75, mt: 0.25 }}>
              {holiday.startDate} → {holiday.endDate}
            </Typography>
          )}
        </Box>
      }
      placement="top"
      arrow
    >
      <Box
        onClick={() => onClick?.(holiday)}
        sx={{
          display: "flex",
          alignItems: "center",
          px: 0.75,
          py: 0.25,
          borderRadius: "4px",
          bgcolor: style.bg,
          border: `1px solid ${style.border}`,
          cursor: onClick ? "pointer" : "default",
          overflow: "hidden",
          "&:hover": onClick ? { opacity: 0.8 } : {},
          transition: "opacity 0.15s",
        }}
      >
        <Typography
          sx={{
            fontSize: "10px",
            fontWeight: 600,
            color: style.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}
        >
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );
}
