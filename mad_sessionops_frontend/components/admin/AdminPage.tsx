"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Activity, Database } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DataSyncTab } from "./DataSyncTab";
import { RealtimeEventsTab } from "./RealtimeEventsTab";

const SIDEBAR_W = 200;
const SIDEBAR_BG = "#FFFFFF";
const SIDEBAR_BORDER = "#E2E8F0";
const ACTIVE_BG = "#E0F2FE";
const ACTIVE_COLOR = "#0284C7";
const ACTIVE_TEXT = "#0C4A6E";
const HOVER_BG = "#F5F3FF";
const TEXT_MUTED = "#94A3B8";
const TEXT_DEFAULT = "#64748B";

const TABS = [
  { key: "data-sync", label: "Data Sync", icon: Database },
  { key: "realtime-events", label: "Realtime Events", icon: Activity },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function TabItem({
  tab,
  active,
  onClick,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.5,
        py: 0.875,
        mx: 1,
        borderRadius: "7px",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.15s ease",
        bgcolor: active ? ACTIVE_BG : "transparent",
        ...(active && {
          "&::before": {
            content: '""',
            position: "absolute",
            left: -8,
            top: "25%",
            bottom: "25%",
            width: "3px",
            borderRadius: "0 3px 3px 0",
            bgcolor: "#E53935",
          },
        }),
        ...(!active && { "&:hover": { bgcolor: HOVER_BG } }),
      }}
    >
      <Icon
        size={16}
        strokeWidth={active ? 2 : 1.75}
        color={active ? ACTIVE_COLOR : TEXT_MUTED}
        style={{ flexShrink: 0 }}
      />
      <Typography
        sx={{
          fontSize: "13px",
          fontWeight: active ? 600 : 400,
          color: active ? ACTIVE_TEXT : TEXT_DEFAULT,
        }}
      >
        {tab.label}
      </Typography>
    </Box>
  );
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("data-sync");

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden", bgcolor: "#F8FAFC" }}>
      {/* Workspace sidebar */}
      <Box
        sx={{
          width: SIDEBAR_W,
          flexShrink: 0,
          borderRight: `1px solid ${SIDEBAR_BORDER}`,
          display: "flex",
          flexDirection: "column",
          bgcolor: SIDEBAR_BG,
          height: "100vh",
        }}
      >
        {/* Back link */}
        <Box
          sx={{
            px: 2,
            pt: 2,
            pb: 1.25,
            borderBottom: `1px solid ${SIDEBAR_BORDER}`,
            flexShrink: 0,
          }}
        >
          <Link href="/schools" style={{ textDecoration: "none" }}>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                color: TEXT_MUTED,
                fontSize: "12px",
                "&:hover": { color: "#334155" },
                transition: "color 0.15s ease",
              }}
            >
              <ArrowLeft size={13} strokeWidth={2} />
              <Typography sx={{ fontSize: "12px", color: "inherit" }}>Schools</Typography>
            </Box>
          </Link>
          <Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", mt: 1 }}>
            Admin
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{ flex: 1, overflowY: "auto", py: 1.5 }}>
          <Typography
            sx={{
              fontSize: "10px",
              fontWeight: 600,
              color: TEXT_MUTED,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              px: 2.5,
              mb: 0.75,
            }}
          >
            Sections
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            {TABS.map((tab) => (
              <TabItem
                key={tab.key}
                tab={tab}
                active={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
              />
            ))}
          </Box>
        </Box>
      </Box>

      {/* Main content */}
      <Box
        sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto" }}
      >
        <Box
          sx={{ px: 3, py: 2, borderBottom: `1px solid ${SIDEBAR_BORDER}`, bgcolor: SIDEBAR_BG }}
        >
          <Typography sx={{ fontSize: "16px", fontWeight: 600, color: "#0F172A" }}>
            {TABS.find((t) => t.key === activeTab)?.label}
          </Typography>
        </Box>

        {activeTab === "data-sync" && <DataSyncTab />}
        {activeTab === "realtime-events" && <RealtimeEventsTab />}
      </Box>
    </Box>
  );
}
