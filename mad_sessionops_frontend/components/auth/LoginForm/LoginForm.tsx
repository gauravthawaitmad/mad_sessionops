"use client";

import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import NextLink from "next/link";
import { useState } from "react";
import { useLoginForm } from "./useLoginForm";
import { Input, Button, Alert, Label } from "@/components/ui";
import { colors } from "@/config/design-tokens";

export function LoginForm() {
  const { formData, isLoading, authError, handleChange, handleBlur, handleSubmit, getFieldError } =
    useLoginForm();

  const [showPassword, setShowPassword] = useState(false);

  const emailError = getFieldError("email");
  const passwordError = getFieldError("password");

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      {authError && (
        <Alert severity="error" closable sx={{ mb: 2 }}>
          {authError}
        </Alert>
      )}

      <Stack spacing={2}>
        {/* Email */}
        <Box>
          <Label htmlFor="email" required sx={{ fontSize: "0.8125rem", mb: 0.5 }}>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            name="email"
            size="small"
            autoComplete="email"
            placeholder="you@email.com"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            onBlur={() => handleBlur("email")}
            error={emailError}
            disabled={isLoading}
          />
        </Box>

        {/* Password */}
        <Box>
          <Label htmlFor="password" required sx={{ fontSize: "0.8125rem", mb: 0.5 }}>
            Password
          </Label>
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            name="password"
            size="small"
            autoComplete="current-password"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => handleChange("password", e.target.value)}
            onBlur={() => handleBlur("password")}
            error={passwordError}
            disabled={isLoading}
            endIcon={
              <IconButton
                onClick={() => setShowPassword(!showPassword)}
                edge="end"
                size="small"
                tabIndex={-1}
                sx={{ color: colors.gray[400] }}
              >
                {showPassword ? (
                  <EyeOff size={16} strokeWidth={1.5} />
                ) : (
                  <Eye size={16} strokeWidth={1.5} />
                )}
              </IconButton>
            }
          />
          <Box display="flex" justifyContent="flex-end" mt={0.75}>
            <Link
              component={NextLink}
              href="/forgot-password"
              sx={{
                fontSize: "0.75rem",
                color: colors.gray[500],
                textDecoration: "none",
                fontWeight: 500,
                "&:hover": { color: colors.gray[700] },
              }}
            >
              Set password?
            </Link>
          </Box>
        </Box>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="medium"
          loading={isLoading}
          endIcon={!isLoading && <ArrowRight size={16} strokeWidth={2} />}
          sx={{
            py: 1.125,
            fontSize: "0.875rem",
            fontWeight: 600,
            textTransform: "none",
            boxShadow: "none",
            bgcolor: colors.gray[900],
            "&:hover": { bgcolor: colors.gray[800], boxShadow: "none" },
            mt: 0.5,
          }}
        >
          Sign in
        </Button>
      </Stack>
    </Box>
  );
}
