"use client";

import Box from "@mui/material/Box";
import { EntityStatCard } from "./EntityStatCard";
import type { EntityStats } from "@/lib/api/services/syncAdmin.service";

interface EntityStatsRowProps {
  stats: EntityStats;
}

export function EntityStatsRow({ stats }: EntityStatsRowProps) {
  return (
    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
      <EntityStatCard entityKey="user" stat={stats.user} />
      <EntityStatCard entityKey="partner" stat={stats.partner} />
      <EntityStatCard entityKey="partnerWorknode" stat={stats.partnerWorknode} />
    </Box>
  );
}
