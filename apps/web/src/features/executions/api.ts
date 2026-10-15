import { callContract } from "@/features/api/real-adapter"
import type { CostBreakdown, ExecutionError, ExecutionAttempt, GuardrailDecision, ModelInvocation, RetrievalInvocation, StructuredLog, ToolInvocation, ExecutionTrace } from "@/features/executions/observatory-types"
import type { ExecutionListParams, ExecutionListResponse, ExecutionResponse } from "@/features/executions/types"
import { localWorkspace } from "@/lib/workspace"

export function listExecutions(params: ExecutionListParams, workspaceId: string = localWorkspace.id) {
  return callContract<ExecutionListResponse>("executions.list", {
    query: {
      q: params.q,
      agent: params.agent,
      environment: params.environment,
      status: params.status,
      range: params.range,
      sort: params.sort,
      page: params.page,
      workspaceId,
    },
  })
}

export function getExecution(id: string, workspaceId: string = localWorkspace.id) {
  return callContract<ExecutionResponse>("executions.get", { params: { id }, query: { workspaceId } })
}

export function tickExecution(id: string) {
  return callContract<ExecutionResponse>("executions.tick", { params: { id } })
}

export function cancelExecution(id: string) {
  return callContract<ExecutionResponse>("executions.cancel", { params: { id } })
}

export function retryExecution(id: string) {
  return callContract<ExecutionResponse>("executions.retry", { params: { id } })
}

export function getExecutionLogs(id: string, query: { severity: string; q: string }, workspaceId = localWorkspace.id) {
  return callContract<{ simulated: true; executionId: string; logs: StructuredLog[] }>("executions.logs", {
    params: { id },
    query: { ...query, workspaceId },
  })
}

export function getExecutionTrace(id: string, workspaceId = localWorkspace.id) {
  return callContract<{ simulated: true; trace: ExecutionTrace; attempts: ExecutionAttempt[] }>("executions.traces", {
    params: { id },
    query: { workspaceId },
  })
}

export function getExecutionModels(id: string, workspaceId = localWorkspace.id) {
  return callContract<{ simulated: true; executionId: string; models: ModelInvocation[]; guardrails: GuardrailDecision[] }>("executions.models", {
    params: { id },
    query: { workspaceId },
  })
}

export function getExecutionTools(id: string, workspaceId = localWorkspace.id) {
  return callContract<{ simulated: true; executionId: string; tools: ToolInvocation[] }>("executions.tools", {
    params: { id },
    query: { workspaceId },
  })
}

export function getExecutionRetrievals(id: string, workspaceId = localWorkspace.id) {
  return callContract<{ simulated: true; executionId: string; retrievals: RetrievalInvocation[]; costs: CostBreakdown; errors: ExecutionError[] }>(
    "executions.retrievals",
    { params: { id }, query: { workspaceId } },
  )
}
