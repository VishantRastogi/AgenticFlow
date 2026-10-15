export type AgentStatus = "active" | "idle" | "paused" | "error"
export type AgentType = "planner" | "researcher" | "operator" | "reviewer"
export type RetryPolicy = "none" | "fixed" | "exponential"
export type ExecutionStatus = "succeeded" | "completed" | "failed" | "running" | "queued" | "cancelled"

export function isSuccessfulExecution(status: ExecutionStatus) {
  return status === "succeeded" || status === "completed"
}
export type RuntimeEnvironment = "production" | "staging" | "sandbox"
export type EnvironmentFilter = "all" | RuntimeEnvironment
export type DashboardRange = "24h" | "7d" | "30d"
export type RuntimeHealth = "healthy" | "degraded" | "critical"

export type AgentRecord = {
  id: string
  name: string
  environment: RuntimeEnvironment
  status: AgentStatus
  description?: string
  type?: AgentType
  timeoutMs?: number
  retryPolicy?: RetryPolicy
  version?: string
  configuration?: Record<string, unknown>
  updatedAt?: string
}

export type ExecutionRecord = {
  id: string
  agentId: string
  environment: RuntimeEnvironment
  status: ExecutionStatus
  startedAt: string
  durationMs: number | null
  attempt?: number
  retryOf?: string | null
  cursor?: number
  /** Set when the run is created. Older records omit it and are not rewritten. */
  agentVersion?: string
}

export type OperationsFixture = {
  asOf: string
  agents: AgentRecord[]
  executions: ExecutionRecord[]
}

export type DashboardQuery = {
  environment: EnvironmentFilter
  range: DashboardRange
}

export type VolumePoint = {
  label: string
  executions: number
}

export type StatusPoint = {
  status: AgentStatus
  count: number
}

export type TrendPoint = {
  label: string
  succeeded: number
  failed: number
}

export type LiveExecution = {
  id: string
  agentId: string
  agentName: string
  status: ExecutionStatus
  startedAt: string
  durationMs: number | null
}

export type FailureItem = {
  id: string
  agentName: string
  startedAt: string
  durationMs: number | null
}

export type AlertItem = {
  id: string
  tone: "info" | "warning" | "danger"
  title: string
  detail: string
}

export type DashboardKpis = {
  totalAgents: number
  activeAgents: number
  executionsToday: number
  successRate: number | null
  p95DurationMs: number | null
  activeRuns: number
}

export type DashboardSnapshot = {
  simulated: true
  asOf: string
  environment: EnvironmentFilter
  range: DashboardRange
  kpis: DashboardKpis
  volume: VolumePoint[]
  agentStatus: StatusPoint[]
  trends: TrendPoint[]
  liveExecutions: LiveExecution[]
  failures: FailureItem[]
  alerts: AlertItem[]
  health: {
    status: RuntimeHealth
    summary: string
  }
}

export type CreateAgentInput = {
  name: string
  environment: RuntimeEnvironment
}
