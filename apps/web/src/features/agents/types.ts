import type { AgentStatus, AgentType, ExecutionRecord, RetryPolicy, RuntimeEnvironment } from "@/features/dashboard/types"

export type AgentProfile = {
  id: string
  name: string
  description: string
  type: AgentType
  environment: RuntimeEnvironment
  status: AgentStatus
  timeoutMs: number
  retryPolicy: RetryPolicy
  version: string
  configuration: Record<string, unknown>
  updatedAt: string
}

export type AgentVersion = {
  version: string
  updatedAt: string
  note: string
}

export type AgentSummary = AgentProfile & {
  successRate: number | null
  totalExecutions: number
  recentRuns: ExecutionRecord[]
}

export type AgentListResponse = {
  agents: AgentSummary[]
  page: number
  pageSize: number
  total: number
  simulated: true
}

export type AgentLog = {
  id: string
  at: string
  level: "info" | "error"
  message: string
}

export type AgentDetail = {
  simulated: true
  agent: AgentProfile
  stats: {
    successRate: number | null
    totalExecutions: number
    failed: number
    recentRuns: ExecutionRecord[]
  }
  executions: ExecutionRecord[]
  logs: AgentLog[]
  versions: AgentVersion[]
}

export type AgentWriteInput = {
  name: string
  description: string
  type: AgentType
  environment: RuntimeEnvironment
  timeoutMs: number
  retryPolicy: RetryPolicy
  version: string
  configuration: Record<string, unknown>
  status?: AgentStatus
}

export type AgentListParams = {
  q: string
  status: "all" | AgentStatus
  environment: "all" | RuntimeEnvironment
  type: "all" | AgentType
  sort: "name" | "updated" | "success" | "status"
  page: number
}
