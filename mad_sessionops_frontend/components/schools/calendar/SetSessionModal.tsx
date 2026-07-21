"use client";

import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import DialogTitle from "@mui/material/DialogTitle";
import { X, AlertTriangle, ArrowRight } from "lucide-react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  fetchSessionDefaults,
  createSession,
  type SessionOut,
} from "@/lib/api/services/sessions.service";
import { colors } from "@/config/design-tokens";

// ── Schema ─────────────────────────────────────────────────────────────────────

const schema = z
  .object({
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),
  })
  .refine((d) => d.start_date < d.end_date, {
    message: "Start date must be before end date",
    path: ["end_date"],
  });

type FormValues = z.infer<typeof schema>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDurationLabel(start: string, end: string): string | null {
  if (!start || !end || start >= end) return null;
  const s = new Date(start);
  const e = new Date(end);
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (months <= 0) {
    const days = Math.round((e.getTime() - s.getTime()) / 86_400_000);
    return `${days} day${days !== 1 ? "s" : ""}`;
  }
  const rem = Math.round(
    (e.getTime() - new Date(s.getFullYear(), s.getMonth() + months, s.getDate()).getTime()) /
      86_400_000
  );
  return rem > 0 ? `${months} mo ${rem} d` : `${months} month${months !== 1 ? "s" : ""}`;
}

function fmtDate(d: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const BORDER = "#E2E8F0";
const LABEL = "#374151";

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    fontSize: "13px",
    bgcolor: "#FAFAFA",
    "& fieldset": { borderColor: BORDER },
    "&:hover fieldset": { borderColor: "#CBD5E1" },
    "&.Mui-focused fieldset": { borderColor: colors.primary[600], borderWidth: "1.5px" },
  },
  "& .MuiFormHelperText-root": { fontSize: "11px", mt: 0.5 },
};

// ── Duration bar ──────────────────────────────────────────────────────────────

function SessionPreview({ start, end }: { start: string; end: string }) {
  const label = getDurationLabel(start, end);
  const valid = !!label;

  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderRadius: "10px",
        border: `1px solid ${valid ? colors.primary[200] : BORDER}`,
        bgcolor: valid ? colors.primary[50] : colors.gray[50],
        transition: "all 0.2s",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {/* Start */}
        <Box sx={{ flex: 1, textAlign: "center" }}>
          <Typography
            sx={{
              fontSize: "10px",
              fontWeight: 600,
              color: colors.gray[400],
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              mb: 0.25,
            }}
          >
            Start
          </Typography>
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 700,
              color: valid ? colors.primary[700] : colors.gray[400],
            }}
          >
            {start ? fmtDate(start) : "—"}
          </Typography>
        </Box>

        {/* Arrow + duration */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", px: 1 }}>
          <ArrowRight
            size={14}
            strokeWidth={2}
            color={valid ? colors.primary[500] : colors.gray[300]}
          />
          {label && (
            <Typography
              sx={{ fontSize: "10px", fontWeight: 700, color: colors.primary[600], mt: 0.25 }}
            >
              {label}
            </Typography>
          )}
        </Box>

        {/* End */}
        <Box sx={{ flex: 1, textAlign: "center" }}>
          <Typography
            sx={{
              fontSize: "10px",
              fontWeight: 600,
              color: colors.gray[400],
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              mb: 0.25,
            }}
          >
            End
          </Typography>
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 700,
              color: valid ? colors.primary[700] : colors.gray[400],
            }}
          >
            {end ? fmtDate(end) : "—"}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SetSessionModalProps {
  open: boolean;
  schoolId: number;
  onClose: () => void;
  onSessionCreated: (session: SessionOut) => void;
}

export function SetSessionModal({
  open,
  schoolId,
  onClose,
  onSessionCreated,
}: SetSessionModalProps) {
  const [defaultsLoading, setDefaultsLoading] = useState(false);
  const [academicYearLabel, setAcademicYearLabel] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { start_date: "", end_date: "" },
  });

  const startVal = useWatch({ control, name: "start_date" });
  const endVal = useWatch({ control, name: "end_date" });

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setDefaultsLoading(true);

    fetchSessionDefaults(schoolId)
      .then((defaults) => {
        if (defaults.defaultStartDate) setValue("start_date", defaults.defaultStartDate);
        if (defaults.defaultEndDate) setValue("end_date", defaults.defaultEndDate);
        setAcademicYearLabel(defaults.academicYearLabel);
      })
      .catch(() => {})
      .finally(() => setDefaultsLoading(false));
  }, [open, schoolId, setValue]);

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    setSubmitError(null);
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      const session = await createSession(schoolId, {
        startDate: values.start_date,
        endDate: values.end_date,
      });
      reset();
      onSessionCreated(session);
    } catch (err: any) {
      if (err?.status === 409 || err?.code === "CONFLICT") {
        setSubmitError("Session already configured. Reload the page to see the current session.");
      } else {
        setSubmitError(err?.message || "Failed to save session. Please try again.");
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: "14px", boxShadow: "0 20px 60px rgba(0,0,0,0.12)" } }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          pt: 2.5,
          pb: 1.5,
          px: 3,
          borderBottom: `1px solid #E2E8F0`,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
            Configure academic session
          </Typography>
          <Typography sx={{ fontSize: "11px", color: "#94A3B8", mt: 0.25 }}>
            {academicYearLabel ? `Academic year ${academicYearLabel} · ` : ""}Set the session start
            and end dates
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={handleClose}
          disabled={isSubmitting}
          sx={{ mt: 0.25, color: "#94A3B8", "&:hover": { bgcolor: "#F1F5F9", color: "#475569" } }}
        >
          <X size={16} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 2.5, pb: 0 }}>
        {defaultsLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} sx={{ color: colors.primary[500] }} />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Live session preview */}
            <SessionPreview start={startVal} end={endVal} />

            {/* Date fields — side by side */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <Box>
                <Typography sx={{ fontSize: "12px", fontWeight: 600, color: LABEL, mb: 0.75 }}>
                  Start date{" "}
                  <Typography component="span" sx={{ color: "#EF4444", fontSize: "12px" }}>
                    *
                  </Typography>
                </Typography>
                <Controller
                  name="start_date"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="date"
                      size="small"
                      fullWidth
                      error={!!errors.start_date}
                      helperText={errors.start_date?.message}
                      sx={fieldSx}
                      inputProps={{ "data-testid": "start-date-input" }}
                    />
                  )}
                />
              </Box>

              <Box>
                <Typography sx={{ fontSize: "12px", fontWeight: 600, color: LABEL, mb: 0.75 }}>
                  End date{" "}
                  <Typography component="span" sx={{ color: "#EF4444", fontSize: "12px" }}>
                    *
                  </Typography>
                </Typography>
                <Controller
                  name="end_date"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="date"
                      size="small"
                      fullWidth
                      error={!!errors.end_date}
                      helperText={errors.end_date?.message}
                      sx={fieldSx}
                      inputProps={{ "data-testid": "end-date-input" }}
                    />
                  )}
                />
              </Box>
            </Box>

            {/* Helper text */}
            <Typography sx={{ fontSize: "11px", color: colors.gray[400], mt: -0.75 }}>
              Default values are based on your school's MOU dates. You can change them before
              saving.
            </Typography>

            {/* Submit error */}
            {submitError && (
              <Box
                sx={{
                  px: 1.5,
                  py: 1,
                  borderRadius: "7px",
                  bgcolor: "#FEF2F2",
                  border: "1px solid #FECACA",
                }}
              >
                <Typography sx={{ fontSize: "12px", color: "#DC2626" }}>{submitError}</Typography>
              </Box>
            )}

            {/* Warning */}
            <Box
              sx={{
                display: "flex",
                gap: 1.25,
                px: 1.75,
                py: 1.5,
                borderRadius: "8px",
                bgcolor: "#FFFBEB",
                border: "1px solid #FDE68A",
                mb: 0.5,
              }}
            >
              <AlertTriangle
                size={15}
                strokeWidth={1.75}
                color="#D97706"
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <Box>
                <Typography sx={{ fontSize: "12px", fontWeight: 600, color: "#92400E", mb: 0.25 }}>
                  This action cannot be undone
                </Typography>
                <Typography sx={{ fontSize: "11px", color: "#B45309", lineHeight: "17px" }}>
                  Once saved, the session dates are locked and cannot be edited. Please verify
                  before saving.
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2.25, gap: 1, borderTop: `1px solid ${colors.gray[100]}` }}>
        <Button
          onClick={handleClose}
          disabled={isSubmitting}
          variant="outlined"
          sx={{
            textTransform: "none",
            fontSize: "13px",
            fontWeight: 500,
            borderColor: BORDER,
            color: colors.gray[700],
            "&:hover": { borderColor: "#CBD5E1", bgcolor: colors.gray[50] },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting || defaultsLoading}
          variant="contained"
          sx={{
            textTransform: "none",
            fontSize: "13px",
            fontWeight: 700,
            bgcolor: colors.primary[600],
            boxShadow: "none",
            "&:hover": { bgcolor: colors.primary[700], boxShadow: "none" },
            minWidth: 100,
          }}
        >
          {isSubmitting ? <CircularProgress size={15} sx={{ color: "#fff" }} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
