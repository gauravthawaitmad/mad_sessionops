"use client";

import { Container, Box, Typography, Breadcrumbs, Link } from "@mui/material";
import { NavigateNext } from "@mui/icons-material";
import { ReactNode } from "react";

/**
 * Page Container Component
 * Consistent wrapper for page content with breadcrumbs
 */

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageContainerProps {
  /** Page title */
  title?: string;
  /** Page description */
  description?: string;
  /** Breadcrumb items */
  breadcrumbs?: BreadcrumbItem[];
  /** Page content */
  children: ReactNode;
  /** Maximum width */
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
  /** Action buttons (top right) */
  actions?: ReactNode;
  /** Show back button */
  showBack?: boolean;
  /** Back handler */
  onBack?: () => void;
}

export function PageContainer({
  title,
  description,
  breadcrumbs,
  children,
  maxWidth = "lg",
  actions,
  showBack = false,
  onBack,
}: PageContainerProps) {
  return (
    <Box sx={{ py: 4 }}>
      <Container maxWidth={maxWidth}>
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ mb: 3 }}>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return isLast ? (
                <Typography key={index} color="text.primary" fontSize={14}>
                  {crumb.label}
                </Typography>
              ) : (
                <Link
                  key={index}
                  href={crumb.href}
                  underline="hover"
                  color="text.secondary"
                  fontSize={14}
                >
                  {crumb.label}
                </Link>
              );
            })}
          </Breadcrumbs>
        )}

        {/* Page Header */}
        {(title || description || actions) && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              mb: 4,
              gap: 2,
            }}
          >
            <Box sx={{ flexGrow: 1 }}>
              {title && (
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                  {title}
                </Typography>
              )}
              {description && (
                <Typography variant="body1" color="text.secondary">
                  {description}
                </Typography>
              )}
            </Box>
            {actions && <Box>{actions}</Box>}
          </Box>
        )}

        {/* Page Content */}
        <Box>{children}</Box>
      </Container>
    </Box>
  );
}

export default PageContainer;
