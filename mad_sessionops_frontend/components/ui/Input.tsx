"use client";

import { TextField, TextFieldProps, InputAdornment } from "@mui/material";
import { forwardRef, ReactNode } from "react";

/**
 * Custom Input Component
 * Extends MUI TextField with additional features
 */

import { InputHTMLAttributes } from "react";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "color"> {
  label?: string;
  error?: string;
  helperText?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  fullWidth?: boolean;
  variant?: "outlined" | "filled" | "standard";
  size?: "small" | "medium";
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      startIcon,
      endIcon,
      fullWidth = true,
      variant = "outlined",
      size = "medium",
      required,
      ...props
    },
    ref
  ) => {
    return (
      <TextField
        inputRef={ref}
        label={label}
        error={!!error}
        helperText={error || helperText}
        fullWidth={fullWidth}
        variant={variant}
        size={size}
        required={required}
        InputProps={{
          startAdornment: startIcon ? (
            <InputAdornment position="start">{startIcon}</InputAdornment>
          ) : undefined,
          endAdornment: endIcon ? (
            <InputAdornment position="end">{endIcon}</InputAdornment>
          ) : undefined,
        }}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export default Input;
