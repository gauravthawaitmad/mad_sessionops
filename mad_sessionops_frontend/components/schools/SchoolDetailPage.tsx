"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import {
  ArrowLeft,
  LayoutDashboard,
  BookOpen,
  Users,
  UserCheck,
  Clock,
  Calendar,
  AlertCircle,
  MapPin,
  FileText,
  User,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { fetchSchool, type SchoolDetail } from "@/lib/api/services/schools.service";
import { fetchActiveYear } from "@/lib/api/services/structure.service";
import { BucketsTab } from "@/components/schools/structure/BucketsTab";
import { ChildrenTab } from "@/components/schools/children/ChildrenTab";
import { VolunteerListTab } from "@/components/schools/volunteers/VolunteerListTab";
import { SlotListTab } from "@/components/schools/slots/SlotListTab";
import { ScheduleView } from "@/components/schools/schedule/ScheduleView";
import { CalendarTab } from "@/components/schools/calendar/CalendarTab";
import { useUserCan } from "@/lib/hooks/useUserCan";
import { colors } from "@/config/design-tokens";

// ── Constants ─────────────────────────────────────────────────────────────────

const SIDEBAR_BG = "#FFFFFF";
const SIDEBAR_BORDER = "#E2E8F0";
const ACTIVE_BG = "#E0F2FE";
const ACTIVE_COLOR = "#0284C7";
const ACTIVE_TEXT = "#0C4A6E";
const HOVER_BG = "#F5F3FF";
const TEXT_MUTED = "#94A3B8";
const TEXT_DEFAULT = "#64748B";
const MAD_RED = "#E53935";
const ACCENT = "#2563EB";

// ── Workspace sidebar ─────────────────────────────────────────────────────────

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, enabled: true },
  { key: "structure", label: "Structure", icon: BookOpen, enabled: true },
  { key: "children", label: "Children", icon: Users, enabled: true },
  { key: "volunteers", label: "Volunteers", icon: UserCheck, enabled: true },
  { key: "slots", label: "Slots", icon: Clock, enabled: true },
  // Hidden for now — superseded by the Calendar tab. Not deleted: content
  // route/component below is left intact in case this comes back.
  { key: "schedule", label: "Schedule", icon: Calendar, enabled: true, hidden: true },
  { key: "calendar", label: "Calendar", icon: Calendar, enabled: true },
];

function WorkspaceSidebar({
  active,
  onTabChange,
}: {
  active: string;
  onTabChange: (key: string) => void;
}) {
  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        borderRight: `1px solid ${SIDEBAR_BORDER}`,
        display: "flex",
        flexDirection: "column",
        bgcolor: SIDEBAR_BG,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      {/* Back link */}
      <Box
        sx={{ px: 2, pt: 2, pb: 1.25, borderBottom: `1px solid ${SIDEBAR_BORDER}`, flexShrink: 0 }}
      >
        <Link href="/schools" style={{ textDecoration: "none" }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1,
              py: 0.625,
              borderRadius: "6px",
              color: TEXT_DEFAULT,
              transition: "background 0.12s ease, color 0.12s ease",
              "&:hover": { bgcolor: HOVER_BG, color: ACTIVE_TEXT },
            }}
          >
            <ArrowLeft size={13} strokeWidth={2} />
            <Typography sx={{ fontSize: "12px", fontWeight: 500 }}>All schools</Typography>
          </Box>
        </Link>
      </Box>

      {/* Nav tabs */}
      <Box sx={{ flex: 1, py: 1.5 }}>
        <Typography
          sx={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: TEXT_MUTED,
            textTransform: "uppercase",
            px: 2.5,
            mb: 0.75,
          }}
        >
          Workspace
        </Typography>

        {TABS.filter((t) => !t.hidden).map(({ key, label, icon: Icon, enabled }) => {
          const isActive = key === active;

          const item = (
            <Box
              key={key}
              onClick={enabled ? () => onTabChange(key) : undefined}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                px: 1.5,
                py: 0.875,
                mx: 1,
                borderRadius: "7px",
                cursor: enabled ? "pointer" : "not-allowed",
                opacity: enabled ? 1 : 0.45,
                position: "relative",
                transition: "background 0.12s ease",
                bgcolor: isActive ? ACTIVE_BG : "transparent",
                ...(isActive && {
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    left: -8,
                    top: "20%",
                    bottom: "20%",
                    width: "3px",
                    borderRadius: "0 3px 3px 0",
                    bgcolor: MAD_RED,
                  },
                }),
                ...(!isActive && enabled && { "&:hover": { bgcolor: HOVER_BG } }),
              }}
            >
              <Icon
                size={15}
                strokeWidth={isActive ? 2 : 1.75}
                color={isActive ? ACTIVE_COLOR : TEXT_MUTED}
                style={{ flexShrink: 0 }}
              />
              <Typography
                sx={{
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? ACTIVE_TEXT : TEXT_DEFAULT,
                  letterSpacing: isActive ? "-0.01em" : 0,
                }}
              >
                {label}
              </Typography>
            </Box>
          );

          if (!enabled) {
            return (
              <Tooltip key={key} title="Coming in a future milestone" placement="right" arrow>
                <span style={{ display: "block" }}>{item}</span>
              </Tooltip>
            );
          }
          return item;
        })}
      </Box>
    </Box>
  );
}

// ── School avatar ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#06b6d4"];

function schoolAvatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: string }) {
  return (
    <Typography
      sx={{
        fontSize: "11px",
        fontWeight: 600,
        color: colors.gray[400],
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        mb: 0.5,
      }}
    >
      {children}
    </Typography>
  );
}

function FieldValue({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: "14px", color: colors.gray[700], lineHeight: "22px" }}>
      {children || "—"}
    </Typography>
  );
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box>
      <FieldLabel>{label}</FieldLabel>
      <FieldValue>{value}</FieldValue>
    </Box>
  );
}

function Section({
  title,
  cols = 3,
  children,
}: {
  title: string;
  cols?: number;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
        <Typography
          sx={{
            fontSize: "12px",
            fontWeight: 700,
            color: colors.gray[500],
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </Typography>
        <Box sx={{ flex: 1, height: "1px", bgcolor: colors.gray[200] }} />
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          columnGap: "32px",
          rowGap: "24px",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function formatDate(d: string | null): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function formatEnum(v: string | null | undefined): string {
  if (!v) return "";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Info strip (horizontal pill row under header) ─────────────────────────────

const _noopSubscribe = () => () => {};

/**
 * Reads Date.now() the React-sanctioned way for a value that comes from
 * outside React: useSyncExternalStore, not Date.now() in render (impure —
 * react-hooks/purity) or a useEffect+setState pair (cascading render —
 * react-hooks/set-state-in-effect). The subscribe callback is a no-op since
 * this only ever needs the value once, not a live-ticking clock. getServerSnapshot
 * returns null so SSR and the client's first paint agree — Date.now() only
 * ever runs client-side here, avoiding a real hydration-mismatch risk.
 *
 * getSnapshot MUST return the same value across calls until subscribe fires
 * (React compares snapshots via Object.is on every render to detect tears) —
 * cached in a ref so it's read once, not `() => Date.now()` directly, which
 * returns a different value every call and causes an infinite render loop.
 */
function useNow(): number | null {
  const cached = useRef<number | null>(null);
  return useSyncExternalStore(
    _noopSubscribe,
    () => {
      if (cached.current === null) cached.current = Date.now();
      return cached.current;
    },
    () => null
  );
}

function InfoStrip({ school }: { school: SchoolDetail }) {
  const now = useNow();

  const mouChip = (() => {
    if (!school.mouEndDate || now === null) return null;
    const end = new Date(school.mouEndDate);
    const daysLeft = Math.ceil((end.getTime() - now) / 86_400_000);
    if (daysLeft < 0) return { text: "MOU expired", color: colors.error[600] };
    if (daysLeft < 90) return { text: `MOU expires in ${daysLeft}d`, color: colors.warning[600] };
    return { text: `MOU until ${formatDate(school.mouEndDate)}`, color: colors.success[600] };
  })();

  const chips: { icon: React.ElementType; text: string; color: string }[] = [
    ...(school.city || school.state
      ? [
          {
            icon: MapPin,
            text: [school.city, school.state].filter(Boolean).join(", "),
            color: colors.gray[600],
          },
        ]
      : []),
    ...(school.schoolType
      ? [{ icon: GraduationCap, text: formatEnum(school.schoolType), color: colors.gray[600] }]
      : []),
    ...(school.coName ? [{ icon: User, text: school.coName, color: colors.gray[600] }] : []),
    ...(mouChip ? [{ icon: FileText, text: mouChip.text, color: mouChip.color }] : []),
  ];

  if (chips.length === 0) return null;

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3.5 }}>
      {chips.map(({ icon: Icon, text, color }, i) => (
        <Box
          key={i}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.625,
            px: 1.375,
            py: 0.5,
            borderRadius: "20px",
            bgcolor: colors.gray[100],
            border: `1px solid ${colors.gray[200]}`,
          }}
        >
          <Icon size={12} strokeWidth={1.75} color={color} />
          <Typography sx={{ fontSize: "12px", fontWeight: 500, color, lineHeight: "18px" }}>
            {text}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ── Overview metrics ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | null;
  accent: string;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        px: 2,
        py: 1.5,
        borderRadius: "10px",
        border: `1px solid ${colors.gray[200]}`,
        bgcolor: colors.white,
      }}
    >
      <Typography
        sx={{
          fontSize: "10px",
          fontWeight: 600,
          color: colors.gray[400],
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{ fontSize: "22px", fontWeight: 700, color: accent, lineHeight: 1.2, mt: 0.5 }}
      >
        {value === null ? "—" : value.toLocaleString()}
      </Typography>
    </Box>
  );
}

// ── Overview content (main area) ──────────────────────────────────────────────

function OverviewContent({ school }: { school: SchoolDetail }) {
  // Only append city/state/pincode if no structured address lines exist
  const addressParts = [school.addressLine1, school.addressLine2].filter(Boolean);
  if (addressParts.length === 0) {
    const loc = [school.city, school.state].filter(Boolean).join(", ");
    if (loc) addressParts.push(loc);
    if (school.pincode) addressParts.push(school.pincode.toString());
  }
  const address = addressParts.join("\n") || null;

  return (
    <Box sx={{ px: 4, pt: 3, pb: 6 }}>
      <InfoStrip school={school} />

      {/* Metrics row */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 4 }}>
        <StatCard label="Children enrolled" value={school.childrenCount} accent="#7C3AED" />
        <StatCard
          label="Confirmed children (CRM)"
          value={school.confirmedChildCount}
          accent="#DB2777"
        />
        <StatCard label="Classes" value={school.classesCount} accent="#0284C7" />
        <StatCard label="Volunteers" value={school.volunteersCount} accent="#059669" />
        <StatCard
          label="Volunteers assigned to slot"
          value={school.assignmentsCount}
          accent="#d97706"
        />
      </Box>

      <Section title="School Information" cols={3}>
        <Box sx={{ gridColumn: "1 / -1" }}>
          <FieldLabel>Address</FieldLabel>
          <Typography
            sx={{
              fontSize: "14px",
              color: colors.gray[700],
              lineHeight: "22px",
              whiteSpace: "pre-line",
            }}
          >
            {address ?? "—"}
          </Typography>
        </Box>
        <Field label="School type" value={formatEnum(school.schoolType)} />
        <Field label="Affiliation type" value={formatEnum(school.partnerAffiliationType)} />
      </Section>

      <Section title="Point of Contact" cols={3}>
        <Field label="Name" value={school.pocName} />
        <Field label="Designation" value={school.pocDesignation} />
        <Field label="Phone" value={school.pocContact} />
        <Box sx={{ gridColumn: "1 / -1" }}>
          <FieldLabel>Email</FieldLabel>
          {school.pocEmail ? (
            <Typography
              component="a"
              href={`mailto:${school.pocEmail}`}
              sx={{
                fontSize: "14px",
                color: ACCENT,
                textDecoration: "none",
                lineHeight: "22px",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              {school.pocEmail}
            </Typography>
          ) : (
            <FieldValue>—</FieldValue>
          )}
        </Box>
      </Section>

      <Section title="MOU Details" cols={3}>
        <Field label="Signed on" value={formatDate(school.mouSignDate)} />
        <Field label="Active from" value={formatDate(school.mouStartDate)} />
        <Field label="Expires on" value={formatDate(school.mouEndDate)} />
        <Box>
          <FieldLabel>MOU Document</FieldLabel>
          {school.mouUrl ? (
            <Typography
              component="a"
              href={school.mouUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                fontSize: "14px",
                color: ACCENT,
                textDecoration: "none",
                lineHeight: "22px",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              View document ↗
            </Typography>
          ) : (
            <FieldValue>—</FieldValue>
          )}
        </Box>
      </Section>

      <Section title="Community Organizer" cols={3}>
        <Field label="Name" value={school.coName} />
      </Section>

      <Section title="Chapter Organizer(s)" cols={3}>
        {school.chos.length > 0 ? (
          school.chos.map((cho) => (
            <Field key={cho.userId} label="Name" value={cho.userDisplayName} />
          ))
        ) : (
          <Field label="Name" />
        )}
      </Section>
    </Box>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function SidebarSkeleton() {
  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        borderRight: `1px solid ${SIDEBAR_BORDER}`,
        py: 1.5,
        px: 2,
        bgcolor: SIDEBAR_BG,
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <Skeleton width={60} height={12} sx={{ mb: 1.5 }} />
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 0.875, px: 0.5 }}>
          <Skeleton variant="circular" width={15} height={15} />
          <Skeleton width={80} height={13} />
        </Box>
      ))}
    </Box>
  );
}

function HeaderSkeleton() {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <Skeleton
        variant="rounded"
        width={48}
        height={48}
        sx={{ borderRadius: "12px", flexShrink: 0 }}
      />
      <Box sx={{ flex: 1 }}>
        <Skeleton width={300} height={24} sx={{ mb: 0.75 }} />
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Skeleton width={100} height={16} />
          <Skeleton width={80} height={16} />
        </Box>
      </Box>
    </Box>
  );
}

function ContentSkeleton() {
  return (
    <Box sx={{ px: 4, pt: 3, pb: 6 }}>
      {/* Info strip skeleton */}
      <Box sx={{ display: "flex", gap: 1, mb: 3.5 }}>
        {[110, 130, 150, 140].map((w, i) => (
          <Skeleton key={i} width={w} height={30} sx={{ borderRadius: "20px" }} />
        ))}
      </Box>
      {/* Metrics skeleton */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 4 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              px: 2,
              py: 1.5,
              borderRadius: "10px",
              border: `1px solid ${colors.gray[200]}`,
              bgcolor: colors.white,
            }}
          >
            <Skeleton width={80} height={10} />
            <Skeleton width={48} height={22} sx={{ mt: 0.75 }} />
          </Box>
        ))}
      </Box>
      {/* Section skeletons */}
      {[1, 2, 3].map((i) => (
        <Box key={i} sx={{ mb: 5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
            <Skeleton width={100} height={12} />
            <Box sx={{ flex: 1, height: "1px", bgcolor: colors.gray[200] }} />
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              columnGap: "32px",
              rowGap: "24px",
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <Box key={j}>
                <Skeleton width={70} height={11} sx={{ mb: 0.625 }} />
                <Skeleton width="80%" height={18} />
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SchoolDetailPage({ partnerId }: { partnerId: number }) {
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [activeYear, setActiveYear] = useState("");
  const { canModify } = useUserCan(partnerId);

  useEffect(() => {
    // No manual reset of loading/notFound here: the route (app/schools/[partnerId]/page.tsx)
    // keys this component by partnerId, so a school change remounts it fresh —
    // the useState initial values above already supply the correct starting state.
    let cancelled = false;

    Promise.all([fetchSchool(partnerId), fetchActiveYear()])
      .then(([data, year]) => {
        if (!cancelled) {
          setSchool(data);
          setActiveYear(year.label);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoading(false);
          if (err?.status === 404) setNotFound(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [partnerId]);

  // ── 404 ──────────────────────────────────────────────────────────────────────
  if (!loading && notFound) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: "12px",
            bgcolor: colors.gray[100],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 0.5,
          }}
        >
          <AlertCircle size={24} strokeWidth={1.5} color={colors.gray[400]} />
        </Box>
        <Typography sx={{ fontSize: "16px", fontWeight: 600, color: colors.gray[800] }}>
          School not found
        </Typography>
        <Typography
          sx={{ fontSize: "14px", color: colors.gray[500], textAlign: "center", maxWidth: 320 }}
        >
          This school doesn&apos;t exist or you don&apos;t have access to it.
        </Typography>
        <Link href="/schools" style={{ textDecoration: "none" }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              mt: 0.5,
              color: ACCENT,
              fontSize: "14px",
              fontWeight: 500,
              "&:hover": { textDecoration: "underline" },
            }}
          >
            <ArrowLeft size={15} strokeWidth={2} />
            Back to schools
          </Box>
        </Link>
      </Box>
    );
  }

  // ── Page ─────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: "flex", width: "100%", minHeight: "100vh", bgcolor: "#F8FAFC" }}>
      {/* Sidebar — sticky, full viewport height */}
      {loading ? (
        <SidebarSkeleton />
      ) : (
        <WorkspaceSidebar active={activeTab} onTabChange={setActiveTab} />
      )}

      {/* Right panel — scrollable */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        {/* Sticky school header */}
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            px: 4,
            py: 2.25,
            bgcolor: "#fff",
            borderBottom: `1px solid ${colors.gray[200]}`,
            flexShrink: 0,
          }}
        >
          {loading ? (
            <HeaderSkeleton />
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              {/* Avatar */}
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: "12px",
                  bgcolor: schoolAvatarColor(school?.partnerName ?? ""),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "#fff",
                  fontSize: "15px",
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                }}
              >
                {initials(school?.partnerName ?? "?")}
              </Box>

              {/* Name + meta */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: "17px",
                    fontWeight: 700,
                    color: colors.gray[900],
                    lineHeight: "24px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    mb: 0.375,
                  }}
                >
                  {school?.partnerName}
                </Typography>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                  {(school?.city || school?.state) && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        color: colors.gray[500],
                      }}
                    >
                      <MapPin size={12} strokeWidth={1.75} />
                      <Typography sx={{ fontSize: "13px" }}>
                        {[school?.city, school?.state].filter(Boolean).join(", ")}
                      </Typography>
                    </Box>
                  )}
                  {school?.coName && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        color: colors.gray[400],
                      }}
                    >
                      <User size={12} strokeWidth={1.75} />
                      <Typography sx={{ fontSize: "12px" }}>{school.coName}</Typography>
                    </Box>
                  )}
                  {school?.academicYearLabel && (
                    <Box
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 1,
                        py: 0.25,
                        borderRadius: "6px",
                        bgcolor: "#EFF6FF",
                        border: "1px solid #BFDBFE",
                      }}
                    >
                      <BookOpen size={11} strokeWidth={2} color="#2563EB" />
                      <Typography sx={{ fontSize: "11px", fontWeight: 600, color: "#1D4ED8" }}>
                        {school.academicYearLabel}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          )}
        </Box>

        {/* Content */}
        {loading ? (
          <ContentSkeleton />
        ) : (
          school && (
            <>
              {activeTab === "overview" && <OverviewContent school={school} />}
              {activeTab === "structure" && (
                <BucketsTab schoolId={partnerId} canModify={canModify} />
              )}
              {activeTab === "children" && (
                <ChildrenTab schoolId={partnerId} activeYear={activeYear} canModify={canModify} />
              )}
              {activeTab === "volunteers" && <VolunteerListTab schoolId={partnerId} />}
              {activeTab === "slots" && <SlotListTab schoolId={partnerId} canModify={canModify} />}
              {activeTab === "schedule" && <ScheduleView schoolId={partnerId} />}
              {activeTab === "calendar" && <CalendarTab schoolId={partnerId} />}
            </>
          )
        )}
      </Box>
    </Box>
  );
}
