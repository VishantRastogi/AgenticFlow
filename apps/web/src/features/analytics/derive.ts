import { percentile } from "@/features/dashboard/derive"
import {
  isSuccessfulExecution,
  type AgentRecord,
  type DashboardRange,
  type ExecutionRecord,
} from "@/features/dashboard/types"
import type { AnalyticsQuery, AnalyticsSnapshot, HeatCell, LeaderboardRow, ThroughputPoint } from "@/features/analytics/types"

const MODEL_RATES: Record<string, number> = {
  "orbit-large": 0.008,
  "orbit-small": 0.002,
}
const DEFAULT_RATE = 0.004

export function isAnalyticsQuery(value: { environment: string; range: string }): value is AnalyticsQuery {
  return (
    (value.environment === "all" || value.environment === "production" || value.environment === "staging" || value.environment === "sandbox") &&
    (value.range === "24h" || value.range === "7d" || value.range === "30d")
  )
}

export function tokensFor(durationMs: number | null, model: string) {
  if (durationMs === null || durationMs <= 0) return 0
  const factor = model === "orbit-large" ? 4 : model === "orbit-small" ? 1 : 2
  return Math.max(1, Math.round(durationMs / 25)) * factor
}

export function costFor(tokens: number, model: string) {
  return (tokens / 1000) * (MODEL_RATES[model] ?? DEFAULT_RATE)
}

export function modelOf(agent: AgentRecord | undefined) {
  const model = agent?.configuration?.model
  return typeof model === "string" ? model : "unspecified"
}

export function deriveAnalytics(
  input: { agents: AgentRecord[]; executions: ExecutionRecord[]; asOf: string },
  query: AnalyticsQuery,
): AnalyticsSnapshot {
  const asOfMs = Date.parse(input.asOf)
  const { count, sizeMs } = rangeWindow(query.range)
  const windowStart = asOfMs - count * sizeMs
  const agents = input.agents.filter((agent) => query.environment === "all" || agent.environment === query.environment)
  const names = new Map(agents.map((agent) => [agent.id, agent]))
  const executions = input.executions.filter((execution) => {
    const started = Date.parse(execution.startedAt)
    return started >= windowStart && started <= asOfMs && names.has(execution.agentId) && (query.environment === "all" || execution.environment === query.environment)
  })
  const throughput: ThroughputPoint[] = Array.from({ length: count }, (_, index) => ({
    label: bucketLabel(windowStart + index * sizeMs, query.range),
    executions: 0,
    succeeded: 0,
    failed: 0,
  }))
  const outcomes = { succeeded: 0, failed: 0, cancelled: 0 }
  const durations: number[] = []
  let tokens = 0
  let cost = 0
  const byAgent = new Map<string, { runs: number; finished: number; succeeded: number; durations: number[]; tokens: number; cost: number }>()

  for (const agent of agents) {
    byAgent.set(agent.id, { runs: 0, finished: 0, succeeded: 0, durations: [], tokens: 0, cost: 0 })
  }

  for (const execution of executions) {
    const index = Math.min(count - 1, Math.max(0, Math.floor((Date.parse(execution.startedAt) - windowStart) / sizeMs)))
    throughput[index].executions += 1
    const agent = names.get(execution.agentId)
    const bucket = byAgent.get(execution.agentId)
    if (bucket) bucket.runs += 1
    const finished = isSuccessfulExecution(execution.status) || execution.status === "failed"
    if (isSuccessfulExecution(execution.status)) {
      outcomes.succeeded += 1
      throughput[index].succeeded += 1
      if (bucket) bucket.succeeded += 1
    } else if (execution.status === "failed") {
      outcomes.failed += 1
      throughput[index].failed += 1
    } else if (execution.status === "cancelled") {
      outcomes.cancelled += 1
    }
    if (finished) {
      if (bucket) bucket.finished += 1
      if (execution.durationMs !== null) {
        durations.push(execution.durationMs)
        if (bucket) bucket.durations.push(execution.durationMs)
        const model = modelOf(agent)
        const used = tokensFor(execution.durationMs, model)
        const spent = costFor(used, model)
        tokens += used
        cost += spent
        if (bucket) {
          bucket.tokens += used
          bucket.cost += spent
        }
      }
    }
  }

  const leaderboard: LeaderboardRow[] = agents
    .map((agent) => {
      const bucket = byAgent.get(agent.id)
      return {
        agentId: agent.id,
        agentName: agent.name,
        environment: agent.environment,
        runs: bucket?.runs ?? 0,
        successRate: bucket && bucket.finished > 0 ? bucket.succeeded / bucket.finished : null,
        p95DurationMs: percentile(bucket?.durations ?? [], 0.95),
        tokens: bucket?.tokens ?? 0,
        cost: bucket?.cost ?? 0,
      }
    })
    .sort((a, b) => b.runs - a.runs || a.agentName.localeCompare(b.agentName))

  const finishedCount = outcomes.succeeded + outcomes.failed
  const rate = finishedCount === 0 ? null : outcomes.succeeded / finishedCount
  const errorAgents = agents.filter((agent) => agent.status === "error").length
  const health = errorAgents > 0 || (rate !== null && rate < 0.8) ? "critical" : rate !== null && rate < 0.95 ? "degraded" : "healthy"

  return {
    simulated: true,
    asOf: input.asOf,
    environment: query.environment,
    range: query.range,
    throughput,
    outcomes: [
      { outcome: "succeeded", count: outcomes.succeeded },
      { outcome: "failed", count: outcomes.failed },
      { outcome: "cancelled", count: outcomes.cancelled },
    ],
    latency: {
      p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95),
      p99: percentile(durations, 0.99),
    },
    heatmap: heatmap(executions, windowStart, asOfMs),
    tokens,
    cost,
    leaderboard,
    health,
  }
}

function heatmap(executions: ExecutionRecord[], windowStart: number, asOfMs: number) {
  const days: string[] = []
  const cursor = new Date(windowStart)
  cursor.setUTCHours(0, 0, 0, 0)
  const end = new Date(asOfMs)
  while (cursor.getTime() <= end.getTime() && days.length < 31) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  const hours = Array.from({ length: 24 }, (_, hour) => hour)
  const counts = new Map<string, number>()
  for (const execution of executions) {
    const started = Date.parse(execution.startedAt)
    if (started < windowStart || started > asOfMs) continue
    const date = new Date(started)
    const key = `${date.toISOString().slice(0, 10)}:${date.getUTCHours()}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const cells: HeatCell[] = days.flatMap((day) => hours.map((hour) => ({ day, hour, count: counts.get(`${day}:${hour}`) ?? 0 })))
  return { days, hours, cells, max: cells.reduce((highest, cell) => Math.max(highest, cell.count), 0) }
}

function rangeWindow(range: DashboardRange) {
  if (range === "24h") return { count: 24, sizeMs: 3_600_000 }
  if (range === "7d") return { count: 7, sizeMs: 86_400_000 }
  return { count: 30, sizeMs: 86_400_000 }
}

function bucketLabel(startMs: number, range: DashboardRange) {
  const date = new Date(startMs)
  if (range === "24h") {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(date)
  }
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date)
}
