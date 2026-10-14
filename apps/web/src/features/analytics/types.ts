import type { DashboardRange, EnvironmentFilter, RuntimeHealth } from "@/features/dashboard/types"

export type AnalyticsQuery = {
  environment: EnvironmentFilter
  range: DashboardRange
}

export type ThroughputPoint = {
  label: string
  executions: number
  succeeded: number
  failed: number
}

export type OutcomeSlice = {
  outcome: "succeeded" | "failed" | "cancelled"
  count: number
}

export type HeatCell = {
  day: string
  hour: number
  count: number
}

export type LeaderboardRow = {
  agentId: string
  agentName: string
  environment: string
  runs: number
  successRate: number | null
  p95DurationMs: number | null
  tokens: number
  cost: number
}

export type AnalyticsSnapshot = {
  simulated: true
  asOf: string
  environment: EnvironmentFilter
  range: DashboardRange
  throughput: ThroughputPoint[]
  outcomes: OutcomeSlice[]
  latency: { p50: number | null; p95: number | null; p99: number | null }
  heatmap: { days: string[]; hours: number[]; cells: HeatCell[]; max: number }
  tokens: number
  cost: number
  leaderboard: LeaderboardRow[]
  health: RuntimeHealth
}
