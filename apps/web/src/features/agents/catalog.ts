import {
  isSuccessfulExecution,
  type AgentStatus,
  type AgentType,
  type ExecutionRecord,
  type ExecutionStatus,
  type RuntimeEnvironment,
} from "@/features/dashboard/types"
import type { AgentLog, AgentProfile, AgentSummary } from "@/features/agents/types"

export const AGENT_PAGE_SIZE = 6

export type AgentSort = "name" | "updated" | "success" | "status"
export type AgentListQuery = {
  q: string
  status: "all" | AgentStatus
  environment: "all" | RuntimeEnvironment
  type: "all" | AgentType
  sort: AgentSort
  page: number
}

const statuses = new Set<AgentStatus>(["active", "idle", "paused", "error"])
const environments = new Set<RuntimeEnvironment>(["production", "staging", "sandbox"])
const types = new Set<AgentType>(["planner", "researcher", "operator", "reviewer"])
const sorts = new Set<AgentSort>(["name", "updated", "success", "status"])

export function isAgentListQuery(value: {
  status: string
  environment: string
  type: string
  sort: string
  page: number
}): value is AgentListQuery {
  return (
    (value.status === "all" || statuses.has(value.status as AgentStatus)) &&
    (value.environment === "all" || environments.has(value.environment as RuntimeEnvironment)) &&
    (value.type === "all" || types.has(value.type as AgentType)) &&
    sorts.has(value.sort as AgentSort) &&
    Number.isInteger(value.page) &&
    value.page >= 1
  )
}

export function agentStats(agentId: string, executions: ExecutionRecord[]) {
  const mine = executions.filter((execution) => execution.agentId === agentId)
  const completed = mine.filter((execution) => isSuccessfulExecution(execution.status) || execution.status === "failed")
  const succeeded = completed.filter((execution) => isSuccessfulExecution(execution.status)).length
  return {
    successRate: completed.length === 0 ? null : succeeded / completed.length,
    totalExecutions: mine.length,
    failed: completed.length - succeeded,
    recentRuns: [...mine].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)).slice(0, 8),
  }
}

export function queryAgents(agents: AgentProfile[], executions: ExecutionRecord[], query: AgentListQuery) {
  const q = query.q.trim().toLowerCase()
  const rows = agents
    .map((agent) => {
      const stats = agentStats(agent.id, executions)
      return { ...agent, successRate: stats.successRate, totalExecutions: stats.totalExecutions, recentRuns: stats.recentRuns }
    })
    .filter((agent) => {
      const matchesQuery = q.length === 0 || agent.name.toLowerCase().includes(q) || agent.description.toLowerCase().includes(q)
      const matchesStatus = query.status === "all" || agent.status === query.status
      const matchesEnvironment = query.environment === "all" || agent.environment === query.environment
      const matchesType = query.type === "all" || agent.type === query.type
      return matchesQuery && matchesStatus && matchesEnvironment && matchesType
    })
    .sort((a, b) => compareAgents(a, b, query.sort))

  const start = (query.page - 1) * AGENT_PAGE_SIZE
  return {
    agents: rows.slice(start, start + AGENT_PAGE_SIZE),
    page: query.page,
    pageSize: AGENT_PAGE_SIZE,
    total: rows.length,
  }
}

function compareAgents(a: AgentSummary, b: AgentSummary, sort: AgentSort) {
  if (sort === "updated") return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  if (sort === "status") return a.status.localeCompare(b.status) || a.name.localeCompare(b.name)
  if (sort === "success") return (b.successRate ?? -1) - (a.successRate ?? -1) || a.name.localeCompare(b.name)
  return a.name.localeCompare(b.name)
}

export function logsFor(executions: ExecutionRecord[]): AgentLog[] {
  return executions
    .flatMap((execution) => [
      {
        id: `${execution.id}_start`,
        at: execution.startedAt,
        level: "info" as const,
        message: `Started ${execution.id}.`,
      },
      {
        id: `${execution.id}_end`,
        at: execution.startedAt,
        level: execution.status === "failed" ? ("error" as const) : ("info" as const),
        message: logMessage(execution.status, execution.id),
      },
    ])
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 12)
}

function logMessage(status: ExecutionStatus, id: string) {
  if (status === "running") return `${id} is still running.`
  if (status === "queued") return `${id} is queued.`
  if (status === "failed") return `${id} failed.`
  if (status === "cancelled") return `${id} was cancelled.`
  return `${id} succeeded.`
}
