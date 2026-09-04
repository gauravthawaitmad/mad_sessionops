"use client";

import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import { Eye, EyeOff, ArrowRight, CircleHelp, Sparkles, KeyRound, LifeBuoy } from "lucide-react";
import NextLink from "next/link";
import { useState } from "react";
import { useLoginForm } from "./useLoginForm";
import { Input, Button, Alert, Label, Modal } from "@/components/ui";
import { colors } from "@/config/design-tokens";

export function LoginForm() {
  const { formData, isLoading, authError, handleChange, handleBlur, handleSubmit, getFieldError } =
    useLoginForm();

  const [showPassword, setShowPassword] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const emailError = getFieldError("email");
  const passwordError = getFieldError("password");

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        maxWidth="xs"
        showCloseButton={false}
        actions={
          <Button
            fullWidth
            variant="contained"
            onClick={() => setHelpOpen(false)}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              boxShadow: "none",
              bgcolor: colors.gray[900],
              "&:hover": { bgcolor: colors.gray[800], boxShadow: "none" },
            }}
          >
            Got it, thanks
          </Button>
        }
      >
        {/* Banner */}
        <Box
          sx={{
            mx: -3,
            mt: -2.5,
            mb: 2.5,
            px: 3,
            py: 3.5,
            textAlign: "center",
            background: `linear-gradient(160deg, ${colors.brand.red[600]} 0%, ${colors.brand.red[500]} 55%, #8B1E1E 100%)`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              opacity: 0.1,
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='%23ffffff'/%3E%3C/svg%3E\")",
              backgroundSize: "18px 18px",
            }}
          />
          <Box
            sx={{
              position: "relative",
              zIndex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: "50%",
              bgcolor: "rgba(255,255,255,0.15)",
              mb: 1.5,
            }}
          >
            <Sparkles size={22} color="#fff" strokeWidth={1.75} />
          </Box>
          <Typography
            sx={{
              position: "relative",
              zIndex: 1,
              fontWeight: 700,
              fontSize: "1.0625rem",
              color: "#fff",
            }}
          >
            Welcome to the new Session-Ops
          </Typography>
          <Typography
            sx={{
              position: "relative",
              zIndex: 1,
              fontSize: "0.8125rem",
              color: "rgba(255,255,255,0.85)",
              mt: 0.5,
            }}
          >
            Faster, more reliable, and built around how your day actually runs.
          </Typography>
        </Box>

        {/* Steps */}
        <Stack spacing={2}>
          <Box display="flex" gap={1.5}>
            <Box
              sx={{
                flexShrink: 0,
                width: 34,
                height: 34,
                borderRadius: "10px",
                bgcolor: "#FDECEA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <KeyRound size={17} color={colors.brand.red[600]} strokeWidth={1.75} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: colors.gray[900] }}>
                Set a password here first
              </Typography>
              <Typography
                sx={{ fontSize: "0.8125rem", color: colors.gray[500], lineHeight: 1.6, mt: 0.25 }}
              >
                Your old login doesn&apos;t carry over.{" "}
                <Link
                  component={NextLink}
                  href="/forgot-password"
                  onClick={() => setHelpOpen(false)}
                  sx={{ fontWeight: 600 }}
                >
                  Set password
                </Link>{" "}
                takes less than a minute.
              </Typography>
            </Box>
          </Box>

          <Box display="flex" gap={1.5}>
            <Box
              sx={{
                flexShrink: 0,
                width: 34,
                height: 34,
                borderRadius: "10px",
                bgcolor: colors.gray[100],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LifeBuoy size={17} color={colors.gray[600]} strokeWidth={1.75} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: colors.gray[900] }}>
                Still stuck?
              </Typography>
              <Typography
                sx={{ fontSize: "0.8125rem", color: colors.gray[500], lineHeight: 1.6, mt: 0.25 }}
              >
                Contact the MAD support team, or use the feedback button on this page to report the
                issue directly.
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Modal>

      {authError && (
        <Alert severity="error" closable sx={{ mb: 2 }}>
          {authError}. If you used our old system before, you may not have a password set here yet —{" "}
          <Link component={NextLink} href="/forgot-password" sx={{ fontWeight: 600 }}>
            set one
          </Link>
          .
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

        <Box
          component="button"
          type="button"
          onClick={() => setHelpOpen(true)}
          sx={{
            display: "inline-flex",
            alignSelf: "center",
            alignItems: "center",
            gap: 0.5,
            border: "none",
            background: "none",
            p: 0,
            mt: 0.5,
            cursor: "pointer",
            fontSize: "0.75rem",
            fontWeight: 500,
            color: colors.gray[500],
            "&:hover": { color: colors.gray[800] },
          }}
        >
          <CircleHelp size={13} strokeWidth={2} />
          Facing issues signing in?
        </Box>
      </Stack>
    </Box>
  );
}
