"use client";

import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Stack,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge as MuiBadge,
  useMediaQuery,
  useTheme as useMuiTheme,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Notifications,
  Settings,
  AccountCircle,
  Logout,
  DarkMode,
  LightMode,
} from "@mui/icons-material";
import { useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Button } from "@/components/ui";

/**
 * Header Component
 * Top navigation bar with logo, actions, and user menu
 */

export interface HeaderProps {
  /** Logo text or component */
  logo?: string | React.ReactNode;
  /** Show menu toggle button (for mobile) */
  showMenuButton?: boolean;
  /** Menu toggle handler */
  onMenuToggle?: () => void;
  /** User name */
  userName?: string;
  /** User avatar URL */
  userAvatar?: string;
  /** Notification count */
  notificationCount?: number;
  /** Show search bar */
  showSearch?: boolean;
  /** Custom actions (buttons, etc.) */
  actions?: React.ReactNode;
  /** Logout handler */
  onLogout?: () => void;
  /** Settings handler */
  onSettings?: () => void;
  /** Notifications handler */
  onNotifications?: () => void;
}

export function Header({
  logo = "MAD Platform",
  showMenuButton = false,
  onMenuToggle,
  userName = "John Doe",
  userAvatar,
  notificationCount = 0,
  showSearch = false,
  actions,
  onLogout,
  onSettings,
  onNotifications,
}: HeaderProps) {
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const { mode, toggleTheme } = useTheme();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleLogout = () => {
    handleUserMenuClose();
    onLogout?.();
  };

  const handleSettings = () => {
    handleUserMenuClose();
    onSettings?.();
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
        color: "text.primary",
      }}
    >
      <Toolbar sx={{ gap: 2 }}>
        {/* Menu Toggle (Mobile) */}
        {showMenuButton && (
          <IconButton
            edge="start"
            color="inherit"
            onClick={onMenuToggle}
            sx={{ mr: 1, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Logo */}
        <Box sx={{ display: "flex", alignItems: "center", mr: 2 }}>
          {typeof logo === "string" ? (
            <Typography variant="h6" fontWeight="bold" noWrap>
              {logo}
            </Typography>
          ) : (
            logo
          )}
        </Box>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Custom Actions */}
        {actions && <Box sx={{ mr: 2 }}>{actions}</Box>}

        {/* Action Buttons */}
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Theme Toggle */}
          <IconButton onClick={toggleTheme} color="inherit">
            {mode === "light" ? <DarkMode /> : <LightMode />}
          </IconButton>

          {/* Notifications */}
          {!isMobile && (
            <IconButton color="inherit" onClick={onNotifications}>
              <MuiBadge badgeContent={notificationCount} color="error">
                <Notifications />
              </MuiBadge>
            </IconButton>
          )}

          {/* Settings */}
          {!isMobile && (
            <IconButton color="inherit" onClick={onSettings}>
              <Settings />
            </IconButton>
          )}

          {/* User Menu */}
          <IconButton onClick={handleUserMenuOpen} sx={{ ml: 1 }}>
            <Avatar src={userAvatar} alt={userName} sx={{ width: 32, height: 32 }}>
              {userName.charAt(0)}
            </Avatar>
          </IconButton>
        </Stack>

        {/* User Menu Dropdown */}
        <Menu
          anchorEl={userMenuAnchor}
          open={Boolean(userMenuAnchor)}
          onClose={handleUserMenuClose}
          transformOrigin={{ horizontal: "right", vertical: "top" }}
          anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
          PaperProps={{
            sx: { width: 220, mt: 1 },
          }}
        >
          {/* User Info */}
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {userName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              john@example.com
            </Typography>
          </Box>

          <Divider />

          {/* Menu Items */}
          <MenuItem onClick={handleUserMenuClose}>
            <ListItemIcon>
              <AccountCircle fontSize="small" />
            </ListItemIcon>
            <ListItemText>Profile</ListItemText>
          </MenuItem>

          <MenuItem onClick={handleSettings}>
            <ListItemIcon>
              <Settings fontSize="small" />
            </ListItemIcon>
            <ListItemText>Settings</ListItemText>
          </MenuItem>

          <Divider />

          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            <ListItemText>Logout</ListItemText>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

export default Header;
