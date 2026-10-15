import type { ExecutionRecord, RuntimeEnvironment } from "@/features/dashboard/types"
import { projectExecution } from "@/features/executions/project"
import type { AgentProfile } from "@/features/agents/types"
import type { ExecutionListParams, ExecutionRange, ExecutionSort, ExecutionSummary, ObservatoryStatus } from "@/features/executions/types"

export const EXECUTION_PAGE_SIZE = 8

const environments = new Set<RuntimeEnvironment>(["production", "staging", "sandbox"])
const statuses = new Set<ObservatoryStatus>(["queued", "running", "waiting_for_approval", "completed", "failed", "cancelled"])
const ranges = new Set<ExecutionRange>(["all", "24h", "7d", "30d"])
const sorts = new Set<ExecutionSort>(["newest", "oldest", "duration", "status", "agent"])
const statusRank: Record<ObservatoryStatus, number> = {
  running: 0,
  waiting_for_approval: 1,
  queued: 2,
  failed: 3,
  cancelled: 4,
  completed: 5,
}

export function isExecutionListQuery(value: {
  q: string
  agent: string
  environment: string
  status: string
  range: string
  sort: string
  page: number
}): value is ExecutionListParams {
  return (
    (value.environment === "all" || environments.has(value.environment as RuntimeEnvironment)) &&
    (value.status === "all" || statuses.has(value.status as ObservatoryStatus)) &&
    ranges.has(value.range as ExecutionRange) &&
    sorts.has(value.sort as ExecutionSort) &&
    Number.isInteger(value.page) &&
    value.page >= 1
  )
}

export function queryExecutions(
  records: ExecutionRecord[],
  agents: AgentProfile[],
  query: ExecutionListParams,
  asOf: string,
  extras: ExecutionSummary[] = [],
): { executions: ExecutionSummary[]; total: number } {
  const names = new Map(agents.map((agent) => [agent.id, agent]))
  const asOfMs = Date.parse(asOf)
  const windowMs = query.range === "24h" ? 86_400_000 : query.range === "7d" ? 7 * 86_400_000 : query.range === "30d" ? 30 * 86_400_000 : null
  const needle = query.q.trim().toLowerCase()
  const catalog = records.map((record) => {
    const agent = names.get(record.agentId)
    return projectExecution({
      record,
      agentName: agent?.name ?? record.agentId,
      agentStatus: agent?.status ?? "idle",
      retryPolicy: agent?.retryPolicy ?? "fixed",
      asOf,
    })
  })
  const seen = new Set(catalog.map((execution) => execution.id))
  const rows = [...catalog, ...extras.filter((execution) => !seen.has(execution.id))]
    .filter((execution) => {
      const started = Date.parse(execution.startedAt)
      const matchesWindow = windowMs === null || (started >= asOfMs - windowMs && started <= asOfMs)
      const matchesAgent = query.agent === "all" || execution.agentId === query.agent
      const matchesEnvironment = query.environment === "all" || execution.environment === query.environment
      const matchesStatus = query.status === "all" || execution.status === query.status
      const matchesQuery =
        needle.length === 0 ||
        execution.id.toLowerCase().includes(needle) ||
        execution.agentName.toLowerCase().includes(needle) ||
        (execution.traceId ?? "").toLowerCase().includes(needle) ||
        (execution.versionLabel ?? "").toLowerCase().includes(needle)
      return matchesWindow && matchesAgent && matchesEnvironment && matchesStatus && matchesQuery
    })
    .sort((a, b) => compareExecutions(a, b, query.sort))

  const start = (query.page - 1) * EXECUTION_PAGE_SIZE
  return { executions: rows.slice(start, start + EXECUTION_PAGE_SIZE).map(summarize), total: rows.length }
}

function summarize(execution: ExecutionSummary): ExecutionSummary {
  return {
    id: execution.id,
    agentId: execution.agentId,
    agentName: execution.agentName,
    environment: execution.environment,
    status: execution.status,
    startedAt: execution.startedAt,
    durationMs: execution.durationMs,
    attempt: execution.attempt,
    retryOf: execution.retryOf,
    progress: execution.progress,
    simulated: true,
    source: execution.source ?? "catalog",
    versionLabel: execution.versionLabel ?? null,
    traceId: execution.traceId ?? null,
    workspaceId: execution.workspaceId ?? "local",
    tokenCount: execution.tokenCount ?? null,
    estimatedCostUsd: execution.estimatedCostUsd ?? null,
    model: execution.model ?? null,
    workflowId: execution.workflowId ?? null,
  }
}

function compareExecutions(a: ExecutionSummary, b: ExecutionSummary, sort: ExecutionSort) {
  if (sort === "oldest") return Date.parse(a.startedAt) - Date.parse(b.startedAt)
  if (sort === "duration") return (a.durationMs ?? -1) - (b.durationMs ?? -1)
  if (sort === "status") return statusRank[a.status] - statusRank[b.status] || Date.parse(b.startedAt) - Date.parse(a.startedAt)
  if (sort === "agent") return a.agentName.localeCompare(b.agentName) || Date.parse(b.startedAt) - Date.parse(a.startedAt)
  return Date.parse(b.startedAt) - Date.parse(a.startedAt)
}
