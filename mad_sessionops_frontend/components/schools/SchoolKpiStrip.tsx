"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import { colors } from "@/config/design-tokens";
import type { SchoolSummary } from "@/lib/api/services/schools.service";

interface SchoolKpiStripProps {
  summary: SchoolSummary | null;
  loading: boolean;
}

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  loading: boolean;
}

function KpiCard({ label, value, loading }: KpiCardProps) {
  return (
    <Box
      sx={{
        flex: 1,
        bgcolor: colors.white,
        border: `1px solid ${colors.gray[200]}`,
        borderRadius: "12px",
        p: 2,
        minWidth: 0,
      }}
    >
      {loading ? (
        <>
          <Skeleton width={80} height={16} sx={{ mb: 1 }} />
          <Skeleton width={60} height={36} />
        </>
      ) : (
        <>
          <Typography
            sx={{
              fontSize: "12px",
              lineHeight: "16px",
              fontWeight: 400,
              color: colors.gray[500],
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              mb: 0.5,
            }}
          >
            {label}
          </Typography>
          <Box>{value}</Box>
        </>
      )}
    </Box>
  );
}

function KpiValue({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      component="span"
      sx={{ fontSize: "28px", lineHeight: "32px", fontWeight: 700, color: colors.gray[900] }}
    >
      {children}
    </Typography>
  );
}

export function SchoolKpiStrip({ summary, loading }: SchoolKpiStripProps) {
  return (
    <Box sx={{ display: "flex", gap: 1.5 }}>
      <KpiCard
        label="Total schools"
        loading={loading}
        value={<KpiValue>{summary?.totalSchools ?? 0}</KpiValue>}
      />
      <KpiCard
        label="Fully configured"
        loading={loading}
        value={
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
            <KpiValue>{summary?.fullyConfigured ?? 0}</KpiValue>
            <Typography
              component="span"
              sx={{ fontSize: "16px", fontWeight: 400, color: colors.gray[500] }}
            >
              / {summary?.totalSchools ?? 0}
            </Typography>
          </Box>
        }
      />
      <KpiCard
        label="Children enrolled"
        loading={loading}
        value={<KpiValue>{(summary?.childrenEnrolled ?? 0).toLocaleString()}</KpiValue>}
      />
      <KpiCard
        label="Active volunteers"
        loading={loading}
        value={<KpiValue>{summary?.activeVolunteers ?? 0}</KpiValue>}
      />
    </Box>
  );
}
