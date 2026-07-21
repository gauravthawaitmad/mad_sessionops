"use client";

import { Box, Typography } from "@mui/material";
import { ReactNode } from "react";
import { Zap, Lock } from "lucide-react";
import { colors } from "@/config/design-tokens";

interface CenteredAuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function CenteredAuthLayout({ children, title, subtitle }: CenteredAuthLayoutProps) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: colors.gray[50],
        px: 3,
        py: 6,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 480 }}>
        {/* Logo section */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              bgcolor: colors.gray[900],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Zap size={18} strokeWidth={1.5} color={colors.white} />
          </Box>
          <Box>
            <Typography
              component="div"
              sx={{
                fontWeight: 700,
                fontSize: "0.9375rem",
                color: colors.gray[900],
                lineHeight: 1.2,
              }}
            >
              Session-Ops
            </Typography>
            <Typography
              component="div"
              sx={{
                fontSize: "0.6875rem",
                color: colors.gray[400],
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                lineHeight: 1.4,
                mt: 0.25,
              }}
            >
              Make a Difference · Internal
            </Typography>
          </Box>
        </Box>

        {/* Page heading */}
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, color: colors.gray[900], mb: 0.75, fontSize: "1.75rem" }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography
            sx={{ fontSize: "0.9375rem", color: colors.gray[500], mb: 3.5, lineHeight: 1.55 }}
          >
            {subtitle}
          </Typography>
        )}

        {/* Form content */}
        {children}

        {/* Footer */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.75,
            mt: 4,
          }}
        >
          <Lock size={12} strokeWidth={1.5} color={colors.gray[400]} />
          <Typography sx={{ fontSize: "0.75rem", color: colors.gray[400] }}>
            Secured via MAD SSO
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
