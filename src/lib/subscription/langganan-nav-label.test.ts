import { describe, expect, it } from "vitest";

import {
  buildLanggananSidebarLabel,
  formatSisaRemaining,
} from "./langganan-nav-label";
import type { SchoolAccessSnapshot } from "./types";

function snap(
  partial: Partial<SchoolAccessSnapshot> & Pick<SchoolAccessSnapshot, "mode">,
): SchoolAccessSnapshot {
  return {
    isSubscribed: false,
    isPremiumTrialActive: false,
    premiumTrialEndsAt: null,
    canStartPremiumTrial: false,
    trialEndsAt: new Date(Date.now() + 60 * 86400_000).toISOString(),
    trialDaysLeft: 60,
    subscriptionEndsAt: null,
    activeSubscriptionPackage: null,
    studentQuotaAllowance: 150,
    studentQuotaLimit: 150,
    studentQuotaUnlimited: false,
    studentAddsUsed: 0,
    studentAddsRemaining: 150,
    freeSecondsUsedToday: 0,
    freeSecondsRemainingToday: 0,
    canAccessDashboard: true,
    canGenerateStudentLoginCards: false,
    canAddAcademicYear: true,
    ...partial,
    mode: partial.mode,
  };
}

describe("formatSisaRemaining", () => {
  it("formats days, hours, minutes, seconds", () => {
    expect(formatSisaRemaining(60 * 86400_000)).toBe("sisa: 60 hari");
    expect(formatSisaRemaining(21 * 3600_000)).toBe("sisa: 21 jam");
    expect(formatSisaRemaining(27 * 60_000)).toBe("sisa: 27 menit");
    expect(formatSisaRemaining(45_000)).toBe("sisa: 45 detik");
  });

  it("returns null when expired", () => {
    expect(formatSisaRemaining(0)).toBeNull();
  });
});

describe("buildLanggananSidebarLabel", () => {
  const now = 1_700_000_000_000;

  it("shows trial countdown", () => {
    const label = buildLanggananSidebarLabel(
      snap({
        mode: "FREE_TRIAL",
        trialEndsAt: new Date(now + 5 * 86400_000).toISOString(),
      }),
      { nowMs: now },
    );
    expect(label).toBe("Langganan - sisa: 5 hari");
  });

  it("shows subscription countdown", () => {
    const label = buildLanggananSidebarLabel(
      snap({
        mode: "SUBSCRIBED",
        isSubscribed: true,
        subscriptionEndsAt: new Date(now + 2 * 3600_000).toISOString(),
      }),
      { nowMs: now },
    );
    expect(label).toBe("Langganan - sisa: 2 jam");
  });

  it("shows daily free limit", () => {
    const label = buildLanggananSidebarLabel(
      snap({ mode: "FREE_LIMITED", freeSecondsRemainingToday: 90 }),
      { remainingSecondsDaily: 90, nowMs: now },
    );
    expect(label).toBe("Langganan - sisa: 2 menit");
  });

  it("plain label when exhausted", () => {
    expect(
      buildLanggananSidebarLabel(
        snap({ mode: "FREE_EXHAUSTED", freeSecondsRemainingToday: 0 }),
        { nowMs: now },
      ),
    ).toBe("Langganan");
  });
});
