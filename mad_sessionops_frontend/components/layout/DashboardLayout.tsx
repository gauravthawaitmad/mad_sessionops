"use client";

import { Box } from "@mui/material";
import { useState, ReactNode } from "react";
import Header from "./Header";
import Sidebar, { MenuItem } from "./Sidebar";

/**
 * Dashboard Layout Component
 * Complete layout with header, sidebar, and footer
 */

export interface DashboardLayoutProps {
  /** Page content */
  children: ReactNode;
  /** Sidebar menu items */
  menuItems?: MenuItem[];
  /** Show sidebar */
  showSidebar?: boolean;
  /** Show footer */
  showFooter?: boolean;
  /** User name */
  userName?: string;
  /** User avatar */
  userAvatar?: string;
  /** Notification count */
  notificationCount?: number;
  /** Logout handler */
  onLogout?: () => void;
}

export function DashboardLayout({
  children,
  menuItems,
  showSidebar = true,
  showFooter = true,
  userName,
  userAvatar,
  notificationCount,
  onLogout,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", flexDirection: "column" }}>
      {/* Header */}
      <Header
        showMenuButton={showSidebar}
        onMenuToggle={handleSidebarToggle}
        userName={userName}
        userAvatar={userAvatar}
        notificationCount={notificationCount}
        onLogout={onLogout}
      />

      {/* Main Content Area */}
      <Box sx={{ display: "flex", flexGrow: 1 }}>
        {/* Sidebar */}
        {showSidebar && (
          <Sidebar open={sidebarOpen} onClose={handleSidebarClose} menuItems={menuItems} />
        )}

        {/* Page Content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0, // Prevent overflow
          }}
        >
          {/* Content */}
          <Box sx={{ flexGrow: 1 }}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
}

export default DashboardLayout;
