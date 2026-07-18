import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CronHealthBadge } from "@/components/admin/CronHealthBadge";

const HEALTHY_HEALTH = {
  healthy: true,
  lastSuccessfulSyncAt: "2026-06-05T08:00:00Z",
  hoursSinceLastSuccess: 0.5,
  nextExpectedRun: "2026-06-05T10:00:00Z",
  reason: null,
};

const UNHEALTHY_HEALTH = {
  healthy: false,
  lastSuccessfulSyncAt: null,
  hoursSinceLastSuccess: null,
  nextExpectedRun: "2026-06-05T10:00:00Z",
  reason: "no_successful_sync_ever",
};

describe("CronHealthBadge", () => {
  it('shows "Cron healthy" badge when healthy', () => {
    render(<CronHealthBadge health={HEALTHY_HEALTH} />);
    expect(screen.getByText("Cron healthy")).toBeTruthy();
  });

  it('shows "Cron silent" badge when unhealthy', () => {
    render(<CronHealthBadge health={UNHEALTHY_HEALTH} />);
    expect(screen.getByText("Cron silent")).toBeTruthy();
  });

  it("shows no_successful_sync_ever reason text", () => {
    render(<CronHealthBadge health={UNHEALTHY_HEALTH} />);
    expect(screen.getByText("No successful sync on record")).toBeTruthy();
  });
});
