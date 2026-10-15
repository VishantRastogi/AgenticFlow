import type { AgentStatus, ExecutionRecord, ExecutionStatus, RetryPolicy } from "@/features/dashboard/types"
import { isSuccessfulExecution } from "@/features/dashboard/types"
import {
  EXECUTION_STEPS,
  cancelPermission,
  defaultCursor,
  durationFromId,
  maxAttempts,
  observatoryStatus,
  retryPermission,
} from "@/features/executions/lifecycle"
import type { ExecutionDetail, ExecutionLog, ExecutionStep, ExecutionSummary, LogSeverity, StepState } from "@/features/executions/types"

export type ExecutionProjectionInput = {
  record: ExecutionRecord
  agentName: string
  agentStatus: AgentStatus
  retryPolicy: RetryPolicy
  cursor?: number
  asOf: string
}

export function projectExecution(input: ExecutionProjectionInput): ExecutionDetail {
  const cursor = input.cursor ?? input.record.cursor ?? defaultCursor(input.record.status)
  const attempt = input.record.attempt ?? 1
  const retryOf = input.record.retryOf ?? null
  const durationMs = input.record.durationMs ?? (isSettled(input.record.status) ? durationFromId(input.record.id) : null)
  const started = Date.parse(input.record.startedAt)
  const asOf = Date.parse(input.asOf)
  const stamp = (index: number) => new Date(Math.min(asOf, started + index * 400)).toISOString()
  const steps = EXECUTION_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    status: stepState(index, cursor, input.record.status),
    at: stepState(index, cursor, input.record.status) === "pending" || stepState(index, cursor, input.record.status) === "skipped" ? null : stamp(index),
  }))
  const view = observatoryStatus(input.record.status)
  const summary: ExecutionSummary = {
    id: input.record.id,
    agentId: input.record.agentId,
    agentName: input.agentName,
    environment: input.record.environment,
    status: view,
    startedAt: input.record.startedAt,
    durationMs,
    attempt,
    retryOf,
    progress: progressFor(input.record.status, cursor),
    simulated: true,
    source: "catalog",
    versionLabel: input.record.agentVersion ?? null,
    traceId: null,
    workspaceId: "local",
    tokenCount: null,
    estimatedCostUsd: null,
    model: null,
  }

  return {
    ...summary,
    finishedAt: durationMs === null ? null : new Date(Math.min(asOf, started + durationMs)).toISOString(),
    workflowId: null,
    input: {
      agentId: input.record.agentId,
      environment: input.record.environment,
      attempt,
      source: retryOf ? "retry" : input.record.id.startsWith("exe_trig_") ? "agent-studio" : "schedule",
    },
    output: isSuccessfulExecution(input.record.status) ? { summary: `${input.agentName} finished ${input.record.id}.`, attempt } : null,
    error: input.record.status === "failed" ? { message: `${input.agentName} failed while running ${input.record.id}.`, step: "Run agent" } : null,
    retry: { attempt, maxAttempts: maxAttempts(input.retryPolicy), policy: input.retryPolicy, retryOf },
    steps,
    logs: buildLogs(input, steps, stamp, attempt, retryOf),
    permissions: {
      cancel: cancelPermission(input.record.status),
      retry: retryPermission({ status: input.record.status, attempt, policy: input.retryPolicy }),
    },
  }
}

export function filterLogs(logs: ExecutionLog[], severity: "all" | LogSeverity, q: string) {
  const needle = q.trim().toLowerCase()
  return logs.filter((log) => {
    const matchesSeverity = severity === "all" || log.severity === severity
    const matchesQuery = needle.length === 0 || log.message.toLowerCase().includes(needle)
    return matchesSeverity && matchesQuery
  })
}

export function logsAsText(logs: ExecutionLog[]) {
  return logs.map((log) => `${log.at} [${log.severity}] ${log.message}`).join("\n")
}

function isSettled(status: ExecutionStatus) {
  return isSuccessfulExecution(status) || status === "failed" || status === "cancelled"
}

function progressFor(status: ExecutionStatus, cursor: number) {
  if (isSuccessfulExecution(status)) return 1
  if (status === "queued") return 0
  return Math.min(1, cursor / EXECUTION_STEPS.length)
}

function stepState(index: number, cursor: number, status: ExecutionStatus): StepState {
  if (status === "cancelled") return index < cursor ? "completed" : "skipped"
  if (status === "failed") {
    if (index < cursor) return "completed"
    if (index === cursor) return "failed"
    return "skipped"
  }
  if (isSuccessfulExecution(status)) return "completed"
  if (status === "queued") return index === 0 ? "running" : "pending"
  if (index < cursor) return "completed"
  if (index === cursor) return "running"
  return "pending"
}

function buildLogs(
  input: ExecutionProjectionInput,
  steps: ExecutionStep[],
  stamp: (index: number) => string,
  attempt: number,
  retryOf: string | null,
): ExecutionLog[] {
  const logs: ExecutionLog[] = []
  if (attempt > 1) {
    logs.push({
      id: `${input.record.id}_retry`,
      at: stamp(0),
      severity: "warn",
      message: `Retry attempt ${attempt} for ${input.record.id}${retryOf ? `, after ${retryOf}` : ""}.`,
    })
  }
  steps.forEach((step, index) => {
    if (step.status === "pending" || step.status === "skipped") return
    logs.push({
      id: `${input.record.id}_${step.id}`,
      at: stamp(index),
      severity: severityFor(step),
      message: messageFor(step, input),
    })
  })
  return logs
}

function severityFor(step: ExecutionStep): LogSeverity {
  if (step.status === "failed") return "error"
  if (step.id === "configure") return "debug"
  return "info"
}

function messageFor(step: ExecutionStep, input: ExecutionProjectionInput) {
  if (step.status === "failed") return `${input.agentName} failed during ${step.label} for ${input.record.id}.`
  if (step.status === "running" && input.record.status === "queued") return `${input.record.id} is waiting in the queue.`
  if (step.status === "running") return `${step.label} is running for ${input.record.id}.`
  return `${step.label} finished for ${input.record.id}.`
}
