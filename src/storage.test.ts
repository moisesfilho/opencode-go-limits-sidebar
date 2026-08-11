import { describe, expect, it } from "vitest"
import type { Session } from "@opencode-ai/sdk/v2/types"
import {
  DAY_MS,
  HOUR5_MS,
  computeUsage,
  getMonthlyBounds,
  getWeekBounds,
} from "./storage.js"
import type { LimitsConfig } from "./storage.js"

const makeSession = (overrides: Partial<Session>): Session =>
  ({
    id: "id",
    slug: "slug",
    projectID: "project",
    directory: "/tmp",
    title: "title",
    version: "v1",
    time: { created: 0, updated: 0 },
    model: { id: "model", providerID: "provider" },
    ...overrides,
  }) as Session

describe("getWeekBounds", () => {
  it("returns the Monday of the week containing a Wednesday", () => {
    const wednesday = Date.UTC(2026, 7, 12, 15, 30, 0)
    expect(new Date(wednesday).getUTCDay()).toBe(3) // Wednesday

    const { start, end } = getWeekBounds(wednesday)
    expect(start).toBe(Date.UTC(2026, 7, 10)) // Monday 2026-08-10T00:00:00Z
    expect(end).toBe(start + 7 * DAY_MS)
  })

  it("returns the same day as start when now is a Monday", () => {
    const monday = Date.UTC(2026, 7, 10, 5, 0, 0)
    expect(new Date(monday).getUTCDay()).toBe(1) // Monday

    const { start, end } = getWeekBounds(monday)
    expect(start).toBe(Date.UTC(2026, 7, 10)) // same Monday 00:00 UTC
    expect(end).toBe(start + 7 * DAY_MS)
  })
})

describe("getMonthlyBounds", () => {
  it("returns the calendar month containing now", () => {
    const now = Date.UTC(2026, 7, 15, 12, 0, 0) // 2026-08-15
    const { start, end } = getMonthlyBounds(now)
    expect(start).toBe(Date.UTC(2026, 7, 1))
    expect(end).toBe(Date.UTC(2026, 8, 1))
  })

  it("anchors to the subscription date even when now is later", () => {
    const now = Date.UTC(2026, 7, 15, 12, 0, 0) // August
    const { start, end } = getMonthlyBounds(now, "2026-06-15T12:00:00Z")
    expect(start).toBe(Date.UTC(2026, 5, 1)) // 2026-06-01
    expect(end).toBe(Date.UTC(2026, 6, 1)) // 2026-07-01
  })
})

describe("computeUsage", () => {
  const now = Date.UTC(2026, 7, 12, 12, 0, 0) // 2026-08-12T12:00:00Z (Wednesday)
  const config: LimitsConfig = {
    provider: "provider",
    limits: { hour5: 1, weekly: 10, monthly: 50 },
    subscriptionDate: null,
  }

  it("returns exactly 3 entries in order [hour5, weekly, monthly]", () => {
    const usage = computeUsage([], config, now)
    expect(usage).toHaveLength(3)
    expect(usage.map((u) => u.kind)).toEqual(["hour5", "weekly", "monthly"])
  })

  it("excludes sessions from other providers", () => {
    const usage = computeUsage(
      [
        makeSession({
          model: { id: "m", providerID: "other" },
          cost: 5,
          time: { created: 0, updated: now - 1000 },
        }),
      ],
      config,
      now,
    )
    expect(usage.map((u) => u.used)).toEqual([0, 0, 0])
  })

  it("excludes sessions without a cost field", () => {
    const usage = computeUsage(
      [makeSession({ time: { created: 0, updated: now - 1000 } })],
      config,
      now,
    )
    expect(usage.map((u) => u.used)).toEqual([0, 0, 0])
  })

  it("uses the rolling 5-hour window based on time.updated", () => {
    const usage = computeUsage(
      [
        makeSession({ cost: 1, time: { created: 0, updated: now - 4 * 60 * 60 * 1000 } }), // now - 4h → included
        makeSession({ cost: 2, time: { created: 0, updated: now - 6 * 60 * 60 * 1000 } }), // now - 6h → excluded
      ],
      config,
      now,
    )
    expect(usage[0].used).toBe(1)
  })

  it("sums costs across multiple sessions in a window", () => {
    const usage = computeUsage(
      [
        makeSession({ cost: 0.5, time: { created: 0, updated: now - 60 * 1000 } }),
        makeSession({ cost: 1.5, time: { created: 0, updated: now - 120 * 1000 } }),
      ],
      config,
      now,
    )
    expect(usage[0].used).toBe(2)
  })

  it("uses the calendar-week window (Monday start)", () => {
    const usage = computeUsage(
      [
        makeSession({
          cost: 3,
          time: { created: 0, updated: Date.UTC(2026, 7, 9, 23, 0, 0) }, // Sunday 2026-08-09 → excluded
        }),
        makeSession({
          cost: 4,
          time: { created: 0, updated: Date.UTC(2026, 7, 10, 0, 30, 0) }, // Monday 2026-08-10 → included
        }),
      ],
      config,
      now,
    )
    expect(usage[1].used).toBe(4)
  })

  it("anchors the monthly window to the subscription date", () => {
    const usage = computeUsage(
      [
        makeSession({
          cost: 5,
          time: { created: 0, updated: Date.UTC(2026, 6, 25, 10, 0, 0) }, // 2026-07-25 → included
        }),
        makeSession({
          cost: 6,
          time: { created: 0, updated: Date.UTC(2026, 5, 30, 10, 0, 0) }, // 2026-06-30 → excluded
        }),
      ],
      { ...config, subscriptionDate: "2026-07-20T00:00:00Z" },
      now,
    )
    expect(usage[2].used).toBe(5)
  })

  it("reads limits from config and reports labels, kinds and resetsAt correctly", () => {
    const usage = computeUsage(
      [makeSession({ cost: 0.5, time: { created: 0, updated: now - 1000 } })],
      config,
      now,
    )
    const [hour5, weekly, monthly] = usage

    expect(hour5.kind).toBe("hour5")
    expect(hour5.label).toBe("5 hours")
    expect(hour5.limit).toBe(1)
    expect(hour5.resetsAt).toBe(now + HOUR5_MS)

    const week = getWeekBounds(now)
    expect(weekly.kind).toBe("weekly")
    expect(weekly.label).toBe("Weekly")
    expect(weekly.limit).toBe(10)
    expect(weekly.resetsAt).toBe(week.end)

    const month = getMonthlyBounds(now, config.subscriptionDate)
    expect(monthly.kind).toBe("monthly")
    expect(monthly.label).toBe("Monthly")
    expect(monthly.limit).toBe(50)
    expect(monthly.resetsAt).toBe(month.end)
  })
})
