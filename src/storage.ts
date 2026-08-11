import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import type { Session } from "@opencode-ai/sdk/v2/types"

export type WindowKind = "hour5" | "weekly" | "monthly"

export interface LimitsConfig {
  provider: string
  limits: Record<WindowKind, number>
  subscriptionDate: string | null
}

export interface WindowUsage {
  kind: WindowKind
  label: string
  used: number
  limit: number
  resetsAt: number | null // epoch ms
}

export const HOUR5_MS = 5 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000

export const getWeekBounds = (now: number): { start: number; end: number } => {
  const d = new Date(now)
  const daysSinceMonday = (d.getUTCDay() + 6) % 7
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday)
  return { start, end: start + 7 * DAY_MS }
}

export const getMonthlyBounds = (
  now: number,
  subscriptionDate?: string | null,
): { start: number; end: number } => {
  const anchor = subscriptionDate ? new Date(subscriptionDate) : new Date(now)
  const start = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)
  const end = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1)
  return { start, end }
}

const sumCosts = (sessions: Session[], windowStart: number): number =>
  sessions.reduce(
    (total, s) => (s.time.updated >= windowStart ? total + (s.cost ?? 0) : total),
    0,
  )

export const computeUsage = (
  sessions: Session[],
  config: LimitsConfig,
  now: number = Date.now(),
): WindowUsage[] => {
  const relevant = sessions.filter(
    (s) => s.model?.providerID === config.provider && typeof s.cost === "number",
  )

  const week = getWeekBounds(now)
  const month = getMonthlyBounds(now, config.subscriptionDate)

  return [
    {
      kind: "hour5",
      label: "5 hours",
      used: sumCosts(relevant, now - HOUR5_MS),
      limit: config.limits.hour5,
      resetsAt: now + HOUR5_MS,
    },
    {
      kind: "weekly",
      label: "Weekly",
      used: sumCosts(relevant, week.start),
      limit: config.limits.weekly,
      resetsAt: week.end,
    },
    {
      kind: "monthly",
      label: "Monthly",
      used: sumCosts(relevant, month.start),
      limit: config.limits.monthly,
      resetsAt: month.end,
    },
  ]
}

export const fetchUsage = async (
  client: OpencodeClient,
  config: LimitsConfig,
): Promise<WindowUsage[]> => {
  const sessions = await client.session.list({ limit: 1000 })
  return computeUsage(sessions.data ?? [], config)
}
