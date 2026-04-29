"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Box,
  Typography,
  Divider,
} from "@mui/material";
import { Close } from "@mui/icons-material";
import { ReactNode } from "react";

/**
 * Custom Modal Component
 * Extends MUI Dialog with consistent layout
 */

export interface ModalProps {
  /** Modal open state */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal content */
  children: ReactNode;
  /** Modal actions (buttons) */
  actions?: ReactNode;
  /** Maximum width */
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
  /** Full width */
  fullWidth?: boolean;
  /** Show close button */
  showCloseButton?: boolean;
  /** Disable close on backdrop click */
  disableBackdropClick?: boolean;
  /** Show dividers */
  dividers?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = "sm",
  fullWidth = true,
  showCloseButton = true,
  disableBackdropClick = false,
  dividers = false,
}: ModalProps) {
  const handleClose = (event: {}, reason: "backdropClick" | "escapeKeyDown") => {
    if (disableBackdropClick && reason === "backdropClick") {
      return;
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth={maxWidth} fullWidth={fullWidth}>
      {/* Title */}
      {title && (
        <>
          <DialogTitle>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="h6" component="div" fontWeight={600}>
                {title}
              </Typography>
              {showCloseButton && (
                <IconButton
                  onClick={onClose}
                  size="small"
                  sx={{
                    color: "text.secondary",
                    "&:hover": {
                      bgcolor: "action.hover",
                    },
                  }}
                >
                  <Close fontSize="small" />
                </IconButton>
              )}
            </Box>
          </DialogTitle>
          {dividers && <Divider />}
        </>
      )}

      {/* Content */}
      <DialogContent dividers={dividers}>{children}</DialogContent>

      {/* Actions */}
      {actions && (
        <>
          {dividers && <Divider />}
          <DialogActions sx={{ p: 2 }}>{actions}</DialogActions>
        </>
      )}
    </Dialog>
  );
}

export default Modal;
