import type { ExecutionStatus, RetryPolicy, RuntimeEnvironment } from "@/features/dashboard/types"

export type ObservatoryStatus = "queued" | "running" | "completed" | "failed" | "cancelled"
export type StepState = "pending" | "running" | "completed" | "failed" | "skipped"
export type LogSeverity = "debug" | "info" | "warn" | "error"
export type ExecutionSort = "newest" | "oldest" | "duration" | "status" | "agent"
export type ExecutionRange = "all" | "24h" | "7d" | "30d"
export type ExecutionPermission = { allowed: boolean; reason: string }

export type ExecutionStep = {
  id: string
  label: string
  status: StepState
  at: string | null
}

export type ExecutionLog = {
  id: string
  at: string
  severity: LogSeverity
  message: string
}

export type ExecutionSummary = {
  id: string
  agentId: string
  agentName: string
  environment: RuntimeEnvironment
  status: ObservatoryStatus
  startedAt: string
  durationMs: number | null
  attempt: number
  retryOf: string | null
  progress: number
  simulated: true
}

export type ExecutionDetail = ExecutionSummary & {
  finishedAt: string | null
  workflowId: null
  input: {
    agentId: string
    environment: RuntimeEnvironment
    attempt: number
    source: "schedule" | "agent-studio" | "retry"
  }
  output: { summary: string; attempt: number } | null
  error: { message: string; step: string } | null
  retry: {
    attempt: number
    maxAttempts: number
    policy: RetryPolicy
    retryOf: string | null
  }
  steps: ExecutionStep[]
  logs: ExecutionLog[]
  permissions: {
    cancel: ExecutionPermission
    retry: ExecutionPermission
  }
}

export type ExecutionListParams = {
  q: string
  agent: string
  environment: "all" | RuntimeEnvironment
  status: "all" | ObservatoryStatus
  range: ExecutionRange
  sort: ExecutionSort
  page: number
}

export type ExecutionListResponse = {
  executions: ExecutionSummary[]
  agents: { id: string; name: string }[]
  page: number
  pageSize: number
  total: number
  asOf: string
  simulated: true
}

export type ExecutionResponse = {
  execution: ExecutionDetail
  simulated: true
}

export function isTerminalStatus(status: ObservatoryStatus | ExecutionStatus) {
  return status === "completed" || status === "succeeded" || status === "failed" || status === "cancelled"
}
