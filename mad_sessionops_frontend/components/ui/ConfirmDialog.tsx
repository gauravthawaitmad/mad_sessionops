"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Typography,
} from "@mui/material";
import { Warning, Error, Info, CheckCircle } from "@mui/icons-material";

/**
 * ============================================
 * CONFIRM DIALOG COMPONENT
 * ============================================
 *
 * Confirmation dialog for destructive actions.
 */

export interface ConfirmDialogProps {
  /** Dialog open state */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Confirm handler */
  onConfirm: () => void | Promise<void>;
  /** Dialog title */
  title: string;
  /** Dialog message */
  message: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Confirm button color */
  confirmColor?: "primary" | "error" | "warning" | "success";
  /** Dialog variant (affects icon and colors) */
  variant?: "warning" | "error" | "info" | "success";
  /** Loading state */
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = "primary",
  variant = "warning",
  loading = false,
}: ConfirmDialogProps) {
  // Icon mapping
  const iconMap = {
    warning: <Warning sx={{ fontSize: 48 }} />,
    error: <Error sx={{ fontSize: 48 }} />,
    info: <Info sx={{ fontSize: 48 }} />,
    success: <CheckCircle sx={{ fontSize: 48 }} />,
  };

  // Color mapping
  const colorMap = {
    warning: "warning.main",
    error: "error.main",
    info: "info.main",
    success: "success.main",
  };

  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      {/* Content */}
      <DialogContent sx={{ pt: 4, textAlign: "center" }}>
        {/* Icon */}
        <Box
          sx={{
            color: colorMap[variant],
            mb: 2,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {iconMap[variant]}
        </Box>

        {/* Title */}
        <Typography variant="h6" fontWeight={600} gutterBottom>
          {title}
        </Typography>

        {/* Message */}
        <DialogContentText sx={{ mt: 1 }}>{message}</DialogContentText>
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} disabled={loading} fullWidth variant="outlined" color="inherit">
          {cancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          color={confirmColor}
          variant="contained"
          disabled={loading}
          fullWidth
          autoFocus
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmDialog;
