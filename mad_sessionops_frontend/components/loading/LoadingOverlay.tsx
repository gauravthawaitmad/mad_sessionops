"use client";

import { Box, CircularProgress, Typography, Backdrop } from "@mui/material";

/**
 * Loading Overlay Component
 * Full-screen or section loading overlay
 */

export interface LoadingOverlayProps {
  /** Show overlay */
  open: boolean;
  /** Loading message */
  message?: string;
  /** Full screen overlay */
  fullScreen?: boolean;
  /** Background blur */
  blur?: boolean;
  /** Spinner size */
  size?: number;
}

export function LoadingOverlay({
  open,
  message = "Loading...",
  fullScreen = true,
  blur = true,
  size = 40,
}: LoadingOverlayProps) {
  if (fullScreen) {
    return (
      <Backdrop
        open={open}
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.modal + 1,
          backdropFilter: blur ? "blur(3px)" : "none",
        }}
      >
        <Box sx={{ textAlign: "center" }}>
          <CircularProgress color="inherit" size={size} />
          {message && (
            <Typography variant="h6" sx={{ mt: 2 }}>
              {message}
            </Typography>
          )}
        </Box>
      </Backdrop>
    );
  }

  // Section overlay (relative positioning)
  return (
    <Box
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: open ? "flex" : "none",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "rgba(255, 255, 255, 0.8)",
        backdropFilter: blur ? "blur(3px)" : "none",
        zIndex: 10,
      }}
    >
      <Box sx={{ textAlign: "center" }}>
        <CircularProgress size={size} />
        {message && (
          <Typography variant="body2" sx={{ mt: 2 }}>
            {message}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default LoadingOverlay;
