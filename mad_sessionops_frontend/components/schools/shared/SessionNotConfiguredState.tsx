"use client";

import { CalendarDays } from "lucide-react";
import { RichEmptyState } from "./RichEmptyState";

// Thin wrapper over the generic RichEmptyState for the "no academic session"
// shape shared by Calendar/Children/Slots — kept as its own named component
// so call sites read clearly (subtitle + a single "Configure session" action).

interface SessionNotConfiguredStateProps {
  subtitle: string;
  onConfigure: () => void;
}

export function SessionNotConfiguredState({
  subtitle,
  onConfigure,
}: SessionNotConfiguredStateProps) {
  return (
    <RichEmptyState
      badgeIcon={CalendarDays}
      badgeText="Setup required"
      heading="Academic session not configured"
      subtitle={subtitle}
      ctaLabel="Configure session"
      onCta={onConfigure}
    />
  );
}

export default SessionNotConfiguredState;
