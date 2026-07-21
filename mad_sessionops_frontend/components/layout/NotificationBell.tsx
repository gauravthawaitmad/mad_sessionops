"use client";

import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import Menu from "@mui/material/Menu";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Bell } from "lucide-react";

// Shell component — wired with real data in F-M4-8.
// Renders a zero-count bell; click opens an empty dropdown.

export function NotificationBell() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ color: "#64748B", "&:hover": { bgcolor: "#F5F3FF" } }}
      >
        <Badge badgeContent={0} color="error" invisible>
          <Bell size={18} strokeWidth={1.75} />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        PaperProps={{
          sx: { width: 280, mt: 0.5, borderRadius: "10px", border: "1px solid #E2E8F0" },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", mb: 0.5 }}>
            Notifications
          </Typography>
          <Typography sx={{ fontSize: "12px", color: "#94A3B8" }}>No notifications yet</Typography>
        </Box>
      </Menu>
    </>
  );
}
