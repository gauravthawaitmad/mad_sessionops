"use client";

import { forwardRef, ReactNode } from "react";
import { FormLabel, FormLabelProps } from "@mui/material";

/**
 * ============================================
 * LABEL COMPONENT
 * ============================================
 *
 * Clean label for form inputs
 */

export interface LabelProps extends Omit<FormLabelProps, 'children'> {
  /** Label text */
  children: ReactNode;
  /** Show required asterisk */
  required?: boolean;
  /** Error state */
  error?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ children, required, error, sx, ...props }, ref) => {
    return (
      <FormLabel
        ref={ref}
        required={required}
        error={error}
        sx={{
          display: "block",
          mb: 0.5,
          fontSize: "0.875rem",
          fontWeight: 500,
          color: error ? "error.main" : "text.primary",
          ...sx,
        }}
        {...props}
      >
        {children}
      </FormLabel>
    );
  }
);

Label.displayName = "Label";

export default Label;
