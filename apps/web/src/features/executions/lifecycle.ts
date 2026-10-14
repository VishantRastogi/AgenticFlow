import type { AgentStatus, ExecutionStatus, RetryPolicy } from "@/features/dashboard/types"
import type { ExecutionPermission, ObservatoryStatus } from "@/features/executions/types"
import { isTerminalStatus } from "@/features/executions/types"

export const EXECUTION_STEPS = [
  { id: "accept", label: "Accept run" },
  { id: "configure", label: "Load configuration" },
  { id: "execute", label: "Run agent" },
  { id: "result", label: "Write result" },
] as const

export function observatoryStatus(status: ExecutionStatus): ObservatoryStatus {
  if (status === "succeeded" || status === "completed") return "completed"
  return status
}

export function defaultCursor(status: ExecutionStatus) {
  if (status === "queued") return 0
  if (status === "running") return 2
  if (status === "failed" || status === "cancelled") return 2
  return EXECUTION_STEPS.length
}

export function maxAttempts(policy: RetryPolicy) {
  if (policy === "none") return 1
  if (policy === "fixed") return 3
  return 5
}

export function durationFromId(id: string) {
  return 640 + (id.length % 9) * 180
}

export function cancelPermission(status: ExecutionStatus): ExecutionPermission {
  if (status === "queued" || status === "running") {
    return { allowed: true, reason: "Stop this run before it finishes." }
  }
  return { allowed: false, reason: "Only queued or running executions can be cancelled." }
}

export function retryPermission(input: { status: ExecutionStatus; attempt: number; policy: RetryPolicy }): ExecutionPermission {
  const view = observatoryStatus(input.status)
  if (view !== "failed" && view !== "cancelled") {
    return { allowed: false, reason: "Retry is available after a failure or cancellation." }
  }
  const max = maxAttempts(input.policy)
  if (input.attempt >= max) {
    return {
      allowed: false,
      reason: input.policy === "none" ? "This agent does not retry." : `Retry limit of ${max} has been reached.`,
    }
  }
  return { allowed: true, reason: `Attempt ${input.attempt + 1} of ${max}.` }
}

export function advanceExecution(
  input: { status: ExecutionStatus; cursor: number },
  agentStatus: AgentStatus,
): { status: ExecutionStatus; cursor: number } {
  if (isTerminalStatus(input.status)) return input
  const nextCursor = input.cursor + 1
  if (agentStatus === "error" && nextCursor >= 2) return { status: "failed", cursor: 2 }
  if (nextCursor >= EXECUTION_STEPS.length) return { status: "completed", cursor: EXECUTION_STEPS.length }
  return { status: "running", cursor: nextCursor }
}
