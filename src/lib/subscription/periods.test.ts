import { describe, expect, it } from "vitest";

import {
  findActivePeriod,
  planSubscriptionPayment,
  type SubscriptionPeriodLike,
} from "./periods";

describe("planSubscriptionPayment", () => {
  const now = new Date("2026-06-01T12:00:00Z");

  it("paket 9 bulan diutamakan setelah paket 3 bulan aktif", () => {
    const periods: SubscriptionPeriodLike[] = [
      {
        id: "p3",
        package: "MONTHS_3",
        startsAt: new Date("2026-05-01T00:00:00Z"),
        endsAt: new Date("2026-08-01T00:00:00Z"),
      },
    ];

    const plan = planSubscriptionPayment(periods, "MONTHS_9", now, 300);
    expect(plan.kind).toBe("create_nine_priority");
    if (plan.kind !== "create_nine_priority") return;

    expect(plan.startsAt.getTime()).toBe(now.getTime());
    expect(plan.endsAt.getTime()).toBe(
      new Date("2027-03-01T12:00:00Z").getTime(),
    );
    expect(plan.shifts).toHaveLength(1);
    expect(plan.shifts[0]!.startsAt.getTime()).toBe(plan.endsAt.getTime());

    const after = [
      {
        id: "nine",
        package: "MONTHS_9" as const,
        startsAt: plan.startsAt,
        endsAt: plan.endsAt,
      },
      {
        id: "p3",
        package: "MONTHS_3" as const,
        startsAt: plan.shifts[0]!.startsAt,
        endsAt: plan.shifts[0]!.endsAt,
      },
    ];
    expect(findActivePeriod(after, now)?.package).toBe("MONTHS_9");
    expect(
      findActivePeriod(after, new Date("2027-04-01T00:00:00Z"))?.package,
    ).toBe("MONTHS_3");
  });

  it("paket 3 bulan mengantri setelah paket 9 bulan aktif", () => {
    const periods: SubscriptionPeriodLike[] = [
      {
        id: "p9",
        package: "MONTHS_9",
        startsAt: new Date("2026-01-01T00:00:00Z"),
        endsAt: new Date("2026-10-01T00:00:00Z"),
      },
    ];

    const plan = planSubscriptionPayment(periods, "MONTHS_3", now, 300);
    expect(plan.kind).toBe("create");
    if (plan.kind !== "create") return;

    expect(plan.startsAt.getTime()).toBe(
      new Date("2026-10-01T00:00:00Z").getTime(),
    );
  });
});
