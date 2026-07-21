"use client";

import {
  FormControlLabel,
  Checkbox as MuiCheckbox,
  CheckboxProps as MuiCheckboxProps,
  FormHelperText,
  Box,
} from "@mui/material";
import { forwardRef } from "react";

/**
 * ============================================
 * CHECKBOX COMPONENT
 * ============================================
 *
 * Reusable checkbox with label and validation.
 */

export interface CheckboxProps extends Omit<MuiCheckboxProps, "color"> {
  /** Checkbox label */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Checkbox color */
  color?: "primary" | "secondary" | "success" | "error" | "warning" | "info" | "default";
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ label, error, helperText, color = "primary", ...props }, ref) => {
    const checkbox = <MuiCheckbox ref={ref} color={color} {...props} />;

    // If no label, return just checkbox
    if (!label) {
      return (
        <Box>
          {checkbox}
          {(error || helperText) && (
            <FormHelperText error={!!error}>{error || helperText}</FormHelperText>
          )}
        </Box>
      );
    }

    // With label
    return (
      <Box>
        <FormControlLabel
          control={checkbox}
          label={label}
          sx={{
            ...(error && {
              color: "error.main",
            }),
          }}
        />
        {(error || helperText) && (
          <FormHelperText error={!!error} sx={{ ml: 0 }}>
            {error || helperText}
          </FormHelperText>
        )}
      </Box>
    );
  }
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
