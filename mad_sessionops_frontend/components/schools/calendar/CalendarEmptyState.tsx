"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { CalendarDays, Clock, Palmtree, ArrowRight } from "lucide-react";
import { colors } from "@/config/design-tokens";

interface CalendarEmptyStateProps {
  onConfigure: () => void;
}

// ── Mini decorative calendar grid ─────────────────────────────────────────────

function MiniCalendar() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const cells = [
    null,
    null,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    23,
    24,
    25,
    26,
    27,
    28,
    29,
    30,
    null,
    null,
    null,
  ];
  const highlighted = new Set([3, 10, 11, 17, 24]);

  return (
    <Box
      sx={{
        width: 220,
        borderRadius: "12px",
        border: `1px solid ${colors.primary[200]}`,
        bgcolor: "#fff",
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(37,99,235,0.10)",
      }}
    >
      {/* Mini header */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          bgcolor: colors.primary[600],
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#fff" }}>
          Academic Calendar
        </Typography>
        <CalendarDays size={14} strokeWidth={2} color="rgba(255,255,255,0.8)" />
      </Box>

      {/* Day headers */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          px: 1,
          pt: 1,
          pb: 0.5,
          gap: "2px",
        }}
      >
        {days.map((d, i) => (
          <Box key={i} sx={{ textAlign: "center" }}>
            <Typography
              sx={{
                fontSize: "9px",
                fontWeight: 700,
                color: colors.gray[400],
                textTransform: "uppercase",
              }}
            >
              {d}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Day cells */}
      <Box
        sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", px: 1, pb: 1, gap: "2px" }}
      >
        {cells.map((d, i) => (
          <Box
            key={i}
            sx={{
              height: 22,
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: d && highlighted.has(d) ? colors.primary[100] : "transparent",
            }}
          >
            {d && (
              <Typography
                sx={{
                  fontSize: "9px",
                  fontWeight: highlighted.has(d) ? 700 : 400,
                  color: highlighted.has(d) ? colors.primary[700] : colors.gray[500],
                }}
              >
                {d}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Feature bullet ─────────────────────────────────────────────────────────────

function FeatureBullet({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: "7px",
          bgcolor: colors.primary[50],
          border: `1px solid ${colors.primary[100]}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={14} strokeWidth={1.75} color={colors.primary[600]} />
      </Box>
      <Typography sx={{ fontSize: "13px", color: colors.gray[600] }}>{text}</Typography>
    </Box>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CalendarEmptyState({ onConfigure }: CalendarEmptyStateProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        minHeight: 480,
        px: 4,
        py: 6,
        background: `radial-gradient(ellipse at 60% 40%, ${colors.primary[50]} 0%, #F8FAFC 70%)`,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          maxWidth: 760,
          width: "100%",
        }}
      >
        {/* Left — text + CTA */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Badge */}
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.25,
              py: 0.5,
              borderRadius: "20px",
              bgcolor: colors.primary[50],
              border: `1px solid ${colors.primary[200]}`,
              mb: 2,
            }}
          >
            <CalendarDays size={12} strokeWidth={2} color={colors.primary[600]} />
            <Typography sx={{ fontSize: "11px", fontWeight: 600, color: colors.primary[700] }}>
              Calendar Setup
            </Typography>
          </Box>

          <Typography
            sx={{
              fontSize: "22px",
              fontWeight: 800,
              color: colors.gray[900],
              lineHeight: "30px",
              mb: 1.25,
              letterSpacing: "-0.02em",
            }}
          >
            Academic session not configured
          </Typography>

          <Typography
            sx={{
              fontSize: "14px",
              color: colors.gray[500],
              lineHeight: "22px",
              mb: 3,
              maxWidth: 320,
            }}
          >
            Configure the academic session to enable calendar features for this school.
          </Typography>

          {/* Feature bullets */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mb: 3.5 }}>
            <FeatureBullet icon={CalendarDays} text="Session window with start & end dates" />
            <FeatureBullet icon={Palmtree} text="Track school holidays by reason" />
            <FeatureBullet icon={Clock} text="See month-by-month teaching calendar" />
          </Box>

          <Button
            variant="contained"
            onClick={onConfigure}
            endIcon={<ArrowRight size={15} strokeWidth={2.5} />}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              fontSize: "14px",
              px: 3,
              py: 1.125,
              borderRadius: "9px",
              bgcolor: colors.primary[600],
              boxShadow: `0 2px 8px ${colors.primary[300]}`,
              "&:hover": {
                bgcolor: colors.primary[700],
                boxShadow: `0 4px 12px ${colors.primary[300]}`,
              },
            }}
          >
            Configure session
          </Button>
        </Box>

        {/* Right — decorative calendar */}
        <Box sx={{ flexShrink: 0, display: { xs: "none", md: "flex" }, alignItems: "center" }}>
          <MiniCalendar />
        </Box>
      </Box>
    </Box>
  );
}
