"use client";

import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Divider,
  Collapse,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Dashboard,
  People,
  Settings,
  ShoppingCart,
  BarChart,
  ExpandLess,
  ExpandMore,
} from "@mui/icons-material";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

/**
 * Sidebar Menu Item Type
 */
export interface MenuItem {
  /** Menu item ID */
  id: string;
  /** Display label */
  label: string;
  /** Icon component */
  icon?: React.ReactNode;
  /** Navigation path */
  path?: string;
  /** Sub-menu items */
  children?: MenuItem[];
  /** Badge text */
  badge?: string | number;
  /** Divider after item */
  divider?: boolean;
}

/**
 * Sidebar Component
 * Navigation drawer with nested menu support
 */

export interface SidebarProps {
  /** Sidebar open state */
  open: boolean;
  /** Close handler (for mobile) */
  onClose?: () => void;
  /** Menu items */
  menuItems?: MenuItem[];
  /** Sidebar width */
  width?: number;
  /** Variant (permanent for desktop, temporary for mobile) */
  variant?: "permanent" | "temporary";
}

const defaultMenuItems: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <Dashboard />,
    path: "/dashboard",
  },
  {
    id: "users",
    label: "Users",
    icon: <People />,
    path: "/users",
    badge: "12",
  },
  {
    id: "products",
    label: "Products",
    icon: <ShoppingCart />,
    children: [
      { id: "all-products", label: "All Products", path: "/products" },
      { id: "add-product", label: "Add Product", path: "/products/add" },
      { id: "categories", label: "Categories", path: "/products/categories" },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: <BarChart />,
    path: "/analytics",
    divider: true,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings />,
    path: "/settings",
  },
];

export function Sidebar({
  open,
  onClose,
  menuItems = defaultMenuItems,
  width = 260,
  variant = "permanent",
}: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Toggle sub-menu expansion
  const handleToggleExpand = (itemId: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  // Check if menu item is active
  const isActive = (path?: string) => {
    if (!path) return false;
    return pathname === path;
  };

  // Render menu item
  const renderMenuItem = (item: MenuItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.id);
    const active = isActive(item.path);

    return (
      <Box key={item.id}>
        <ListItem disablePadding>
          <ListItemButton
            component={item.path && !hasChildren ? Link : "div"}
            href={item.path || ""}
            selected={active}
            onClick={() => {
              if (hasChildren) {
                handleToggleExpand(item.id);
              }
              if (isMobile && item.path) {
                onClose?.();
              }
            }}
            sx={{
              pl: 2 + level * 2,
              py: 1.5,
              borderRadius: 1,
              mx: 1,
              "&.Mui-selected": {
                bgcolor: "primary.main",
                color: "primary.contrastText",
                "&:hover": {
                  bgcolor: "primary.dark",
                },
                "& .MuiListItemIcon-root": {
                  color: "primary.contrastText",
                },
              },
            }}
          >
            {item.icon && (
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: active ? "inherit" : "text.secondary",
                }}
              >
                {item.icon}
              </ListItemIcon>
            )}
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                fontSize: 14,
                fontWeight: active ? 600 : 400,
              }}
            />
            {item.badge && (
              <Box
                component="span"
                sx={{
                  bgcolor: "error.main",
                  color: "white",
                  px: 1,
                  py: 0.25,
                  borderRadius: 2,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {item.badge}
              </Box>
            )}
            {hasChildren && (isExpanded ? <ExpandLess /> : <ExpandMore />)}
          </ListItemButton>
        </ListItem>

        {/* Sub-menu */}
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children?.map((child) => renderMenuItem(child, level + 1))}
            </List>
          </Collapse>
        )}

        {/* Divider */}
        {item.divider && <Divider sx={{ my: 1 }} />}
      </Box>
    );
  };

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Sidebar Header */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h6" fontWeight="bold">
          Navigation
        </Typography>
      </Box>

      {/* Menu Items */}
      <Box sx={{ flexGrow: 1, overflowY: "auto", py: 2 }}>
        <List>{menuItems.map((item) => renderMenuItem(item))}</List>
      </Box>

      {/* Sidebar Footer */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">
          Version 1.0.0
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      {!isMobile && variant === "permanent" && (
        <Drawer
          variant="permanent"
          sx={{
            width: width,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: width,
              boxSizing: "border-box",
              borderRight: 1,
              borderColor: "divider",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile Sidebar */}
      {(isMobile || variant === "temporary") && (
        <Drawer
          variant="temporary"
          open={open}
          onClose={onClose}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: width,
              boxSizing: "border-box",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}
    </>
  );
}

export default Sidebar;
