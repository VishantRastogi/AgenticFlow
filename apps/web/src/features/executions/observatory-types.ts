import type { ObservatoryStatus } from "@/features/executions/types"

export type SpanStatus = "ok" | "error" | "unset"

export type TraceEvent = {
  name: string
  time: string
  attributes: Record<string, string | number | boolean | null>
}

export type TraceSpan = {
  traceId: string
  spanId: string
  parentSpanId: string | null
  serviceName: string
  operationName: string
  startTime: string
  endTime: string
  durationMs: number
  status: SpanStatus
  attributes: Record<string, string | number | boolean | null>
  events: TraceEvent[]
  simulated: boolean
}

export type ExecutionTrace = {
  executionId: string
  traceId: string | null
  spans: TraceSpan[]
  simulated: true
}

export type StructuredLog = {
  id: string
  timestamp: string
  severity: "debug" | "info" | "warn" | "error"
  serviceName: string
  traceId: string | null
  spanId: string | null
  message: string
  details: Record<string, unknown>
}

export type TokenUsage = {
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

export type ModelInvocation = {
  id: string
  executionId: string
  spanId: string
  provider: string | null
  model: string | null
  usage: TokenUsage
  timeToFirstTokenMs: number | null
  generationLatencyMs: number | null
  estimatedCostUsd: number | null
  error: string | null
  attempt: number
  simulated: boolean
}

export type ToolInvocation = {
  id: string
  executionId: string
  spanId: string
  toolId: string | null
  durationMs: number
  status: "ok" | "error"
  attempt: number
  error: string | null
  simulated: boolean
}

export type RetrievalInvocation = {
  id: string
  executionId: string
  spanId: string
  knowledgeBaseId: string | null
  durationMs: number
  embeddingDurationMs: number | null
  rerankDurationMs: number | null
  chunkIds: string[]
  simulated: boolean
}

export type GuardrailDecision = {
  id: string
  executionId: string
  spanId: string
  decision: string
  simulated: boolean
}

export type CostBreakdown = {
  modelUsd: number | null
  toolUsd: number | null
  retrievalUsd: number | null
  totalUsd: number | null
}

export type ExecutionError = {
  message: string
  step: string | null
  spanId: string | null
  at: string | null
}

export type ExecutionAttempt = {
  id: string
  attempt: number
  retryOf: string | null
  status: ObservatoryStatus
  startedAt: string
}

export type ObservatoryBundle = {
  executionId: string
  workspaceId: string
  simulated: true
  logs: StructuredLog[]
  trace: ExecutionTrace
  models: ModelInvocation[]
  tools: ToolInvocation[]
  retrievals: RetrievalInvocation[]
  guardrails: GuardrailDecision[]
  costs: CostBreakdown
  errors: ExecutionError[]
  attempts: ExecutionAttempt[]
}
