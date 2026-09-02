"use client";

import { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import { X } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  fetchSchoolClasses,
  filterAssignableClasses,
  type SchoolClassItem,
} from "@/lib/api/services/structure.service";
import { fetchBuckets, type BucketItem } from "@/lib/api/services/buckets.service";
import { enrollChild, type EnrollChildInput } from "@/lib/api/services/children.service";
import toast from "react-hot-toast";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  first_name: z.string().min(1, "Required"),
  last_name: z.string().min(1, "Required"),
  gender: z.enum(["male", "female", "other"]),
  age: z.number().int().min(3, "Min 3").max(25, "Max 25"),
  school_class_id: z.number().min(1, "Select a class"),
  class_section_id: z.number().nullable().optional(),
  date_of_birth: z.string().optional(),
  date_of_enrollment: z.string().optional(),
  mad_joining_date: z.string().optional(),
  city: z.string().optional(),
  mother_tongue: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface EnrollChildModalProps {
  open: boolean;
  schoolId: number;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const BORDER = "#E2E8F0";
const MUTED = "#94A3B8";
const LABEL = "#374151";
const MAX_CAP = 5;

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    fontSize: "13px",
    bgcolor: "#FAFAFA",
    "& fieldset": { borderColor: BORDER },
    "&:hover fieldset": { borderColor: "#CBD5E1" },
    "&.Mui-focused fieldset": { borderColor: "#2563EB", borderWidth: "1.5px" },
  },
  "& .MuiFormHelperText-root": { fontSize: "11px", mt: 0.5 },
};

function capacityColor(count: number): string {
  if (count >= MAX_CAP) return "#EF4444";
  if (count >= MAX_CAP - 1) return "#F59E0B";
  return "#22C55E";
}

// ── FieldLabel ────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Typography
      sx={{ fontSize: "12px", fontWeight: 600, color: LABEL, mb: 0.625, letterSpacing: "0.01em" }}
    >
      {children}
      {required && (
        <Typography component="span" sx={{ color: "#EF4444", ml: 0.25, fontSize: "12px" }}>
          *
        </Typography>
      )}
    </Typography>
  );
}

// ── GenderPicker ──────────────────────────────────────────────────────────────
// Three adjacent boxes — avoids MUI ButtonGroup border-merging artifacts.

const GENDER_OPTS = [
  { value: "female", label: "Female", color: "#DB2777", bg: "#FDF2F8" },
  { value: "male", label: "Male", color: "#2563EB", bg: "#EFF6FF" },
  { value: "other", label: "Other", color: "#7C3AED", bg: "#F5F3FF" },
];

function GenderPicker({
  value,
  onChange,
  error,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  return (
    <Box>
      <FieldLabel required>Gender</FieldLabel>
      <Box
        sx={{
          display: "flex",
          border: `1.5px solid ${error ? "#EF4444" : BORDER}`,
          borderRadius: "8px",
          overflow: "hidden",
          bgcolor: "#FAFAFA",
        }}
      >
        {GENDER_OPTS.map((o, i) => {
          const active = value === o.value;
          return (
            <Box
              key={o.value}
              onClick={() => onChange(o.value)}
              sx={{
                flex: 1,
                py: 0.875,
                textAlign: "center",
                cursor: "pointer",
                userSelect: "none",
                bgcolor: active ? o.color : "transparent",
                borderRight:
                  i < GENDER_OPTS.length - 1 ? `1px solid ${active ? o.color : BORDER}` : "none",
                transition: "background 0.12s ease",
                "&:hover": { bgcolor: active ? o.color : o.bg },
              }}
            >
              <Typography
                sx={{
                  fontSize: "13px",
                  fontWeight: active ? 700 : 500,
                  color: active ? "#fff" : "#64748B",
                  lineHeight: 1,
                }}
              >
                {o.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
      {error && (
        <Typography sx={{ fontSize: "11px", color: "#EF4444", mt: 0.5 }}>Required</Typography>
      )}
    </Box>
  );
}

// ── ClassPicker ───────────────────────────────────────────────────────────────

function ClassPicker({
  classes,
  value,
  onChange,
  error,
}: {
  classes: SchoolClassItem[];
  value: number | undefined;
  onChange: (id: number) => void;
  error?: boolean;
}) {
  if (classes.length === 0) {
    return (
      <Box>
        <FieldLabel required>Class</FieldLabel>
        <Box
          sx={{ p: 2, borderRadius: "8px", border: `1px dashed ${BORDER}`, textAlign: "center" }}
        >
          <Typography sx={{ fontSize: "12px", color: MUTED }}>
            No classes added to this school yet.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <FieldLabel required>Class</FieldLabel>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {classes.map((c) => {
          const selected = value === c.schoolClassId;
          return (
            <Box
              key={c.schoolClassId}
              onClick={() => onChange(c.schoolClassId)}
              sx={{
                px: 2,
                py: 1,
                borderRadius: "8px",
                border: `1.5px solid ${selected ? "#2563EB" : BORDER}`,
                bgcolor: selected ? "#EFF6FF" : "#FAFAFA",
                cursor: "pointer",
                transition: "all 0.12s ease",
                "&:hover": { borderColor: "#93C5FD", bgcolor: "#F0F9FF" },
              }}
            >
              <Typography
                sx={{
                  fontSize: "13px",
                  fontWeight: selected ? 700 : 500,
                  color: selected ? "#1D4ED8" : "#374151",
                  lineHeight: 1.3,
                }}
              >
                {c.className}
              </Typography>
              <Typography sx={{ fontSize: "10px", color: MUTED, lineHeight: 1.3 }}>
                {c.programName}
              </Typography>
            </Box>
          );
        })}
      </Box>
      {error && (
        <Typography sx={{ fontSize: "11px", color: "#EF4444", mt: 0.5 }}>Select a class</Typography>
      )}
    </Box>
  );
}

// ── BucketPicker ──────────────────────────────────────────────────────────────
// Class-agnostic: pulls from fetchBuckets(schoolId), not scoped to the selected
// class. Bucket assignment is optional (M6 decision #9) — includes an
// "Unassigned" tile that clears the selection.

function BucketPicker({
  buckets,
  loading,
  value,
  onChange,
}: {
  buckets: BucketItem[];
  loading: boolean;
  value: number | null | undefined;
  onChange: (id: number | undefined) => void;
}) {
  return (
    <Box>
      <FieldLabel>Mentoring Circle</FieldLabel>

      {loading ? (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rounded" height={80} sx={{ borderRadius: "8px" }} />
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
            gap: 1,
          }}
        >
          {/* Unassigned tile */}
          <Box
            onClick={() => onChange(undefined)}
            sx={{
              p: 1.25,
              borderRadius: "8px",
              border: `1.5px solid ${!value ? "#2563EB" : BORDER}`,
              bgcolor: !value ? "#EFF6FF" : "#FAFAFA",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 80,
              transition: "all 0.12s ease",
              ...(value && { "&:hover": { borderColor: "#93C5FD", bgcolor: "#F0F9FF" } }),
            }}
          >
            <Typography
              sx={{
                fontSize: "11px",
                fontWeight: 600,
                color: !value ? "#1D4ED8" : MUTED,
                textAlign: "center",
              }}
            >
              Unassigned
            </Typography>
          </Box>

          {buckets.map((b) => {
            const count = b.activeChildrenCount;
            const full = count >= MAX_CAP;
            const pct = Math.min((count / MAX_CAP) * 100, 100);
            const color = capacityColor(count);
            const selected = value === b.classSectionId;
            const name = b.sectionDisplayName ?? b.sectionName;

            return (
              <Box
                key={b.classSectionId}
                onClick={() => !full && onChange(b.classSectionId)}
                sx={{
                  p: 1.25,
                  borderRadius: "8px",
                  border: `1.5px solid ${selected ? "#2563EB" : full ? "#FECACA" : BORDER}`,
                  bgcolor: selected ? "#EFF6FF" : full ? "#FFF5F5" : "#FAFAFA",
                  cursor: full ? "not-allowed" : "pointer",
                  opacity: full ? 0.55 : 1,
                  transition: "all 0.12s ease",
                  ...(!full &&
                    !selected && { "&:hover": { borderColor: "#93C5FD", bgcolor: "#F0F9FF" } }),
                }}
              >
                <Typography
                  sx={{
                    fontSize: "12px",
                    fontWeight: selected ? 700 : 600,
                    color: selected ? "#1D4ED8" : "#374151",
                    mb: 0.75,
                    lineHeight: 1.2,
                  }}
                >
                  {name}
                </Typography>

                {/* Capacity bar */}
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    mb: 0.5,
                    bgcolor: "#E2E8F0",
                    "& .MuiLinearProgress-bar": {
                      bgcolor: selected ? "#2563EB" : color,
                      borderRadius: 2,
                    },
                  }}
                />

                <Typography
                  sx={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: selected ? "#1D4ED8" : full ? "#EF4444" : "#374151",
                    lineHeight: 1.4,
                  }}
                >
                  {full ? "Full" : `${count}/${MAX_CAP}`}
                </Typography>
                <Typography sx={{ fontSize: "10px", color: MUTED, lineHeight: 1.4 }}>
                  {full ? "0 open" : `${MAX_CAP - count} open`}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: string }) {
  return (
    <Typography
      sx={{
        fontSize: "10px",
        fontWeight: 700,
        color: MUTED,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        mb: 1.5,
      }}
    >
      {children}
    </Typography>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function EnrollChildModal({ open, schoolId, onClose, onSuccess }: EnrollChildModalProps) {
  const [classes, setClasses] = useState<SchoolClassItem[]>([]);
  const [buckets, setBuckets] = useState<BucketItem[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [bucketsLoading, setBucketsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: "",
      last_name: "",
      city: "",
      mother_tongue: "",
      date_of_birth: "",
      date_of_enrollment: "",
      mad_joining_date: "",
    },
  });

  const selectedSectionId = watch("class_section_id");

  // Load classes on open
  useEffect(() => {
    if (!open) return;
    setClassesLoading(true);
    fetchSchoolClasses(schoolId)
      .then((cs) => setClasses(filterAssignableClasses(cs)))
      .catch(() => toast.error("Could not load classes"))
      .finally(() => setClassesLoading(false));
  }, [open, schoolId]);

  // Load buckets on open — independent of class selection (buckets are class-agnostic)
  useEffect(() => {
    if (!open) return;
    setBucketsLoading(true);
    fetchBuckets(schoolId)
      .then(setBuckets)
      .catch(() => toast.error("Could not load mentoring circles"))
      .finally(() => setBucketsLoading(false));
  }, [open, schoolId]);

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const payload: EnrollChildInput = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      gender: values.gender,
      age: values.age,
      school_class_id: values.school_class_id,
    };
    if (values.class_section_id) payload.class_section_id = values.class_section_id;
    if (values.date_of_birth?.trim()) payload.date_of_birth = values.date_of_birth;
    if (values.date_of_enrollment?.trim()) payload.date_of_enrollment = values.date_of_enrollment;
    if (values.mad_joining_date?.trim()) payload.mad_joining_date = values.mad_joining_date;
    if (values.city?.trim()) payload.city = values.city.trim();
    if (values.mother_tongue?.trim()) payload.mother_tongue = values.mother_tongue.trim();

    try {
      await enrollChild(schoolId, payload);
      toast.success("Child enrolled successfully");
      handleClose();
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Enrollment failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "14px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
          maxHeight: "92vh",
        },
      }}
    >
      {/* ── Header ── */}
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          pt: 2.5,
          pb: 1.5,
          px: 3,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
            Enroll Child
          </Typography>
          <Typography sx={{ fontSize: "11px", color: MUTED, mt: 0.25 }}>
            Fields marked{" "}
            <Typography component="span" sx={{ color: "#EF4444", fontWeight: 700 }}>
              *
            </Typography>{" "}
            are required
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={handleClose}
          sx={{ mt: 0.25, color: MUTED, "&:hover": { bgcolor: "#F1F5F9", color: "#475569" } }}
        >
          <X size={16} />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent sx={{ px: 3, pt: 2.5, pb: 1, overflowY: "auto" }}>
          {classesLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress size={28} sx={{ color: "#2563EB" }} />
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {/* ── Personal Info ── */}
              <Box sx={{ mb: 2.5 }}>
                <SectionHeading>Personal Info</SectionHeading>

                {/* First + Last name */}
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 1.75 }}>
                  <Box>
                    <FieldLabel required>First name</FieldLabel>
                    <Controller
                      name="first_name"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          fullWidth
                          placeholder="e.g. Asha"
                          error={!!errors.first_name}
                          helperText={errors.first_name?.message}
                          sx={fieldSx}
                        />
                      )}
                    />
                  </Box>
                  <Box>
                    <FieldLabel required>Last name</FieldLabel>
                    <Controller
                      name="last_name"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          fullWidth
                          placeholder="e.g. Kumar"
                          error={!!errors.last_name}
                          helperText={errors.last_name?.message}
                          sx={fieldSx}
                        />
                      )}
                    />
                  </Box>
                </Box>

                {/* Gender */}
                <Box sx={{ mb: 1.75 }}>
                  <Controller
                    name="gender"
                    control={control}
                    render={({ field }) => (
                      <GenderPicker
                        value={field.value}
                        onChange={field.onChange}
                        error={!!errors.gender}
                      />
                    )}
                  />
                </Box>

                {/* Age + DOB */}
                <Box sx={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 1.5, mb: 1.75 }}>
                  <Box>
                    <FieldLabel required>Age</FieldLabel>
                    <Controller
                      name="age"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          size="small"
                          fullWidth
                          type="number"
                          placeholder="10"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : parseInt(e.target.value, 10)
                            )
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          inputProps={{ min: 3, max: 25 }}
                          error={!!errors.age}
                          helperText={errors.age?.message}
                          sx={fieldSx}
                        />
                      )}
                    />
                  </Box>
                  <Box>
                    <FieldLabel>Date of birth</FieldLabel>
                    <Controller
                      name="date_of_birth"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          fullWidth
                          type="date"
                          InputLabelProps={{ shrink: true }}
                          sx={fieldSx}
                        />
                      )}
                    />
                  </Box>
                </Box>

                {/* City + Mother tongue */}
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                  <Box>
                    <FieldLabel>City</FieldLabel>
                    <Controller
                      name="city"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          fullWidth
                          placeholder="e.g. Hyderabad"
                          sx={fieldSx}
                        />
                      )}
                    />
                  </Box>
                  <Box>
                    <FieldLabel>Mother tongue</FieldLabel>
                    <Controller
                      name="mother_tongue"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          fullWidth
                          placeholder="e.g. Telugu"
                          sx={fieldSx}
                        />
                      )}
                    />
                  </Box>
                </Box>
              </Box>

              {/* ── Enrollment Dates ── */}
              <Box sx={{ mb: 2.5, pt: 2, borderTop: `1px solid ${BORDER}` }}>
                <SectionHeading>Enrollment Dates</SectionHeading>

                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                  <Box>
                    <FieldLabel>Date of enrollment</FieldLabel>
                    <Controller
                      name="date_of_enrollment"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          fullWidth
                          type="date"
                          InputLabelProps={{ shrink: true }}
                          sx={fieldSx}
                        />
                      )}
                    />
                  </Box>
                  <Box>
                    <FieldLabel>MAD joining date</FieldLabel>
                    <Controller
                      name="mad_joining_date"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          size="small"
                          fullWidth
                          type="date"
                          InputLabelProps={{ shrink: true }}
                          sx={fieldSx}
                        />
                      )}
                    />
                  </Box>
                </Box>
              </Box>

              {/* ── Class & Bucket ── */}
              <Box sx={{ pt: 2, borderTop: `1px solid ${BORDER}` }}>
                <SectionHeading>Class &amp; Mentoring Circle</SectionHeading>

                {/* Class chips — required */}
                <Box sx={{ mb: 2 }}>
                  <Controller
                    name="school_class_id"
                    control={control}
                    render={({ field }) => (
                      <ClassPicker
                        classes={classes}
                        value={field.value}
                        onChange={field.onChange}
                        error={!!errors.school_class_id}
                      />
                    )}
                  />
                </Box>

                {/* Bucket cards — independent of class, optional */}
                <Controller
                  name="class_section_id"
                  control={control}
                  render={({ field }) => (
                    <BucketPicker
                      buckets={buckets}
                      loading={bucketsLoading}
                      value={selectedSectionId}
                      onChange={field.onChange}
                    />
                  )}
                />
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${BORDER}`, gap: 1 }}>
          <Button
            onClick={handleClose}
            variant="outlined"
            size="small"
            disabled={submitting}
            sx={{
              fontSize: "13px",
              fontWeight: 500,
              borderColor: BORDER,
              color: "#64748B",
              "&:hover": { borderColor: "#CBD5E1", bgcolor: "#F8FAFC" },
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={submitting || classesLoading || classes.length === 0}
            sx={{
              fontSize: "13px",
              fontWeight: 600,
              minWidth: 80,
              bgcolor: "#2563EB",
              boxShadow: "none",
              "&:hover": { bgcolor: "#1D4ED8", boxShadow: "none" },
              "&.Mui-disabled": { bgcolor: "#BFDBFE", color: "#fff" },
            }}
          >
            {submitting ? <CircularProgress size={14} color="inherit" /> : "Enroll"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default EnrollChildModal;
