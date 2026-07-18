"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Box, Stack, Typography } from "@mui/material";
import { Send } from "lucide-react";
import Link from "next/link";
import { forgotPasswordSchema } from "../validation/authValidation";
import { Input, Button, Alert, Label } from "@/components/ui";
import services from "@/lib/api/services/index";

type FormData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [apiError, setApiError] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: FormData) => {
    setApiError(undefined);
    try {
      await services.auth.forgotPassword({ email: data.email });
      setSubmittedEmail(data.email);
      setSubmitted(true);
    } catch (err: any) {
      // 404 = email not in the system
      if (err?.status === 404) {
        setApiError("No account found with this email address.");
      } else {
        setApiError(err?.message || "Something went wrong. Please try again.");
      }
    }
  };

  if (submitted) {
    return (
      <Box textAlign="center">
        <Alert severity="success" sx={{ mb: 3 }}>
          A link has been sent to <strong>{submittedEmail}</strong>. Check your inbox and use it
          within 30 minutes.
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Back to{" "}
          <Link href="/login" style={{ fontWeight: 600 }}>
            Sign in
          </Link>
        </Typography>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ width: "100%" }}>
      {apiError && (
        <Alert severity="error" onClose={() => setApiError(undefined)} closable sx={{ mb: 2 }}>
          {apiError}
        </Alert>
      )}

      <Stack spacing={2}>
        <Box>
          <Label htmlFor="email" required sx={{ fontSize: "0.8125rem", mb: 0.5 }}>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            size="small"
            autoComplete="email"
            placeholder="you@email.com"
            {...register("email")}
            error={errors.email?.message}
            disabled={isSubmitting}
          />
        </Box>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="medium"
          loading={isSubmitting}
          endIcon={!isSubmitting && <Send size={16} strokeWidth={1.5} />}
          sx={{
            py: 1.125,
            fontSize: "0.875rem",
            fontWeight: 600,
            textTransform: "none",
            boxShadow: "none",
            bgcolor: "#111827",
            "&:hover": { bgcolor: "#1f2937", boxShadow: "none" },
            mt: 0.5,
          }}
        >
          Send link
        </Button>

        <Box textAlign="center">
          <Typography sx={{ fontSize: "0.8125rem", color: "#6b7280" }}>
            Remember your password?{" "}
            <Link href="/login" style={{ fontWeight: 600, color: "#111827" }}>
              Sign in
            </Link>
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
