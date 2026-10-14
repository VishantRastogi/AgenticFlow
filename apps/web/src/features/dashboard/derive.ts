import {
  isSuccessfulExecution,
  type AgentRecord,
  type AgentStatus,
  type AlertItem,
  type DashboardQuery,
  type DashboardRange,
  type DashboardSnapshot,
  type EnvironmentFilter,
  type ExecutionRecord,
  type RuntimeHealth,
  type TrendPoint,
  type VolumePoint,
} from "@/features/dashboard/types"

const RANGES = new Set<DashboardRange>(["24h", "7d", "30d"])
const ENVIRONMENTS = new Set<EnvironmentFilter>(["all", "production", "staging", "sandbox"])
const AGENT_STATUSES: AgentStatus[] = ["active", "idle", "paused", "error"]

export function isDashboardQuery(value: { environment: string; range: string }): value is DashboardQuery {
  return ENVIRONMENTS.has(value.environment as EnvironmentFilter) && RANGES.has(value.range as DashboardRange)
}

export function percentile(values: number[], p: number) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))
  return sorted[index]
}

function rangeWindow(range: DashboardRange) {
  if (range === "24h") return { count: 24, sizeMs: 3_600_000 }
  if (range === "7d") return { count: 7, sizeMs: 86_400_000 }
  return { count: 30, sizeMs: 86_400_000 }
}

function bucketLabel(startMs: number, range: DashboardRange) {
  const date = new Date(startMs)
  if (range === "24h") {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC",
    }).format(date)
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date)
}

export function deriveDashboard(
  input: { agents: AgentRecord[]; executions: ExecutionRecord[]; asOf: string },
  query: DashboardQuery
): DashboardSnapshot {
  const asOfMs = Date.parse(input.asOf)
  const { count, sizeMs } = rangeWindow(query.range)
  const windowStart = asOfMs - count * sizeMs
  const agents = input.agents.filter((agent) => query.environment === "all" || agent.environment === query.environment)
  const agentIds = new Set(agents.map((agent) => agent.id))
  const executions = input.executions.filter((execution) => {
    const started = Date.parse(execution.startedAt)
    return (
      started >= windowStart &&
      started <= asOfMs &&
      (query.environment === "all" || execution.environment === query.environment) &&
      agentIds.has(execution.agentId)
    )
  })
  const names = new Map(agents.map((agent) => [agent.id, agent.name]))
  const today = input.asOf.slice(0, 10)
  const completed = executions.filter((execution) => isSuccessfulExecution(execution.status) || execution.status === "failed")
  const succeeded = completed.filter((execution) => isSuccessfulExecution(execution.status))
  const failed = completed.filter((execution) => execution.status === "failed")
  const durations = completed.flatMap((execution) => (execution.durationMs === null ? [] : [execution.durationMs]))
  const volume: VolumePoint[] = Array.from({ length: count }, (_, index) => ({
    label: bucketLabel(windowStart + index * sizeMs, query.range),
    executions: 0,
  }))
  const trends: TrendPoint[] = volume.map((point) => ({ label: point.label, succeeded: 0, failed: 0 }))

  for (const execution of executions) {
    const index = Math.min(count - 1, Math.max(0, Math.floor((Date.parse(execution.startedAt) - windowStart) / sizeMs)))
    volume[index].executions += 1
    if (isSuccessfulExecution(execution.status)) trends[index].succeeded += 1
    if (execution.status === "failed") trends[index].failed += 1
  }

  const agentStatus = AGENT_STATUSES.map((status) => ({
    status,
    count: agents.filter((agent) => agent.status === status).length,
  }))
  const errorAgents = agents.filter((agent) => agent.status === "error")
  const pausedAgents = agents.filter((agent) => agent.status === "paused")
  const successRate = completed.length === 0 ? null : succeeded.length / completed.length
  const activeRuns = executions.filter((execution) => execution.status === "running").length
  let health: RuntimeHealth = "healthy"
  if (errorAgents.length > 0 || (successRate !== null && successRate < 0.8)) health = "critical"
  else if ((successRate !== null && successRate < 0.95) || pausedAgents.length > 0) health = "degraded"

  const alerts: AlertItem[] = [
    ...errorAgents.map((agent) => ({
      id: `alert_${agent.id}`,
      tone: "danger" as const,
      title: `${agent.name} is in error`,
      detail: `${agent.name} needs attention in ${agent.environment}.`,
    })),
    ...(successRate !== null && successRate < 0.95
      ? [
          {
            id: "alert_success_rate",
            tone: "warning" as const,
            title: "Success rate is below 95%",
            detail: `${Math.round(successRate * 1000) / 10}% of completed executions succeeded in this window.`,
          },
        ]
      : []),
    ...(pausedAgents.length > 0
      ? [
          {
            id: "alert_paused",
            tone: "info" as const,
            title: pausedAgents.length === 1 ? "1 agent is paused" : `${pausedAgents.length} agents are paused`,
            detail: pausedAgents.map((agent) => agent.name).join(", "),
          },
        ]
      : []),
  ]

  const liveExecutions = [...executions]
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .slice(0, 8)
    .map((execution) => ({
      id: execution.id,
      agentId: execution.agentId,
      agentName: names.get(execution.agentId) ?? execution.agentId,
      status: execution.status,
      startedAt: execution.startedAt,
      durationMs: execution.durationMs,
    }))

  return {
    simulated: true,
    asOf: input.asOf,
    environment: query.environment,
    range: query.range,
    kpis: {
      totalAgents: agents.length,
      activeAgents: agents.filter((agent) => agent.status === "active").length,
      executionsToday: executions.filter((execution) => execution.startedAt.slice(0, 10) === today).length,
      successRate,
      p95DurationMs: percentile(durations, 0.95),
      activeRuns,
    },
    volume,
    agentStatus,
    trends,
    liveExecutions,
    failures: [...failed]
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
      .slice(0, 5)
      .map((execution) => ({
        id: execution.id,
        agentName: names.get(execution.agentId) ?? execution.agentId,
        startedAt: execution.startedAt,
        durationMs: execution.durationMs,
      })),
    alerts,
    health: {
      status: health,
      summary:
        health === "critical"
          ? "Runtime needs attention. Error agents or a low success rate are inside this window."
          : health === "degraded"
            ? "Runtime is degraded. Review paused agents and the success trend before the next release."
            : "Runtime is healthy for the selected environment and window.",
    },
  }
}
