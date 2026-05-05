"use client";

import {
  Alert as MuiAlert,
  AlertTitle,
  AlertProps as MuiAlertProps,
  IconButton,
} from "@mui/material";
import { X } from "lucide-react";
import { ReactNode } from "react";

/**
 * Custom Alert Component
 * Extends MUI Alert with additional features
 */

export interface AlertProps extends MuiAlertProps {
  /** Alert title */
  title?: string;
  /** Alert message */
  message?: ReactNode;
  /** Show close button */
  closable?: boolean;
  /** Close handler */
  onClose?: () => void;
}

export function Alert({
  title,
  message,
  children,
  closable = false,
  onClose,
  severity = "info",
  variant = "standard",
  ...props
}: AlertProps) {
  return (
    <MuiAlert
      severity={severity}
      variant={variant}
      action={
        closable && onClose ? (
          <IconButton size="small" onClick={onClose} color="inherit">
            <X size={16} strokeWidth={1.5} />
          </IconButton>
        ) : undefined
      }
      {...props}
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      {message || children}
    </MuiAlert>
  );
}

export default Alert;
