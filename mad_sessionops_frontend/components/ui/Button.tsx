"use client";

import {
  Button as MuiButton,
  ButtonProps as MuiButtonProps,
  CircularProgress,
} from "@mui/material";
import { forwardRef } from "react";

/**
 * Custom Button Component
 * Extends MUI Button with additional features
 */

export interface ButtonProps extends MuiButtonProps {
  /** Show loading spinner */
  loading?: boolean;
  /** Loading text (optional) */
  loadingText?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ loading = false, loadingText, disabled, children, startIcon, ...props }, ref) => {
    return (
      <MuiButton
        ref={ref}
        disabled={disabled || loading}
        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : startIcon}
        {...props}
      >
        {loading && loadingText ? loadingText : children}
      </MuiButton>
    );
  }
);

Button.displayName = "Button";

export default Button;
