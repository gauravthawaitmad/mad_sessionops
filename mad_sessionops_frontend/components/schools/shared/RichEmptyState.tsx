"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { ArrowRight } from "lucide-react";
import { colors } from "@/config/design-tokens";

// Generic version of CalendarEmptyState's badge + heading + subtext + bullets
// + CTA shape (minus the calendar-specific mini-calendar graphic) — the
// shared "here's what this is, how it works, and what to do next" empty
// state used across Children/Slots/Volunteers, not just Calendar.

export interface RichEmptyStateBullet {
  icon: React.ElementType;
  text: string;
}

interface RichEmptyStateProps {
  badgeIcon: React.ElementType;
  badgeText: string;
  heading: string;
  subtitle: string;
  bullets?: RichEmptyStateBullet[];
  ctaLabel?: string;
  onCta?: () => void;
  accent?: string;
}

function FeatureBullet({
  icon: Icon,
  text,
  accent,
}: {
  icon: React.ElementType;
  text: string;
  accent: string;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, textAlign: "left" }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: "7px",
          bgcolor: `${accent}14`,
          border: `1px solid ${accent}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={14} strokeWidth={1.75} color={accent} />
      </Box>
      <Typography sx={{ fontSize: "13px", color: colors.gray[600] }}>{text}</Typography>
    </Box>
  );
}

export function RichEmptyState({
  badgeIcon: BadgeIcon,
  badgeText,
  heading,
  subtitle,
  bullets,
  ctaLabel,
  onCta,
  accent = colors.primary[600],
}: RichEmptyStateProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        minHeight: 340,
        px: 4,
        py: 6,
        background: `radial-gradient(ellipse at 50% 0%, ${accent}0d 0%, transparent 60%)`,
      }}
    >
      <Box sx={{ textAlign: "center", maxWidth: 440 }}>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            px: 1.25,
            py: 0.5,
            borderRadius: "20px",
            bgcolor: `${accent}14`,
            border: `1px solid ${accent}40`,
            mb: 2,
          }}
        >
          <BadgeIcon size={12} strokeWidth={2} color={accent} />
          <Typography sx={{ fontSize: "11px", fontWeight: 600, color: accent }}>
            {badgeText}
          </Typography>
        </Box>

        <Typography
          sx={{
            fontSize: "20px",
            fontWeight: 800,
            color: colors.gray[900],
            lineHeight: "28px",
            mb: 1.25,
            letterSpacing: "-0.02em",
          }}
        >
          {heading}
        </Typography>

        <Typography
          sx={{
            fontSize: "14px",
            color: colors.gray[500],
            lineHeight: "22px",
            mb: bullets?.length ? 3 : ctaLabel ? 3 : 0,
          }}
        >
          {subtitle}
        </Typography>

        {bullets && bullets.length > 0 && (
          <Box sx={{ display: "inline-flex", flexDirection: "column", gap: 1.25, mb: 3 }}>
            {bullets.map((b, i) => (
              <FeatureBullet key={i} icon={b.icon} text={b.text} accent={accent} />
            ))}
          </Box>
        )}

        {ctaLabel && onCta && (
          <Button
            variant="contained"
            onClick={onCta}
            endIcon={<ArrowRight size={15} strokeWidth={2.5} />}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              fontSize: "14px",
              px: 3,
              py: 1.125,
              borderRadius: "9px",
              bgcolor: accent,
              boxShadow: `0 2px 8px ${accent}4d`,
              "&:hover": { bgcolor: accent, filter: "brightness(0.92)" },
            }}
          >
            {ctaLabel}
          </Button>
        )}
      </Box>
    </Box>
  );
}

export default RichEmptyState;
