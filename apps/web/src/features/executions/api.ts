import { callContract } from "@/features/api/real-adapter"
import type { ExecutionListParams, ExecutionListResponse, ExecutionResponse } from "@/features/executions/types"

export function listExecutions(params: ExecutionListParams) {
  return callContract<ExecutionListResponse>("executions.list", {
    query: {
      q: params.q,
      agent: params.agent,
      environment: params.environment,
      status: params.status,
      range: params.range,
      sort: params.sort,
      page: params.page,
    },
  })
}

export function getExecution(id: string) {
  return callContract<ExecutionResponse>("executions.get", { params: { id } })
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
