import { ApiError } from "@/features/auth/api/errors"
import { getApiMode } from "@/features/auth/api/mode"
import { createFetchTransport } from "@/features/auth/api/transport"
import { readAuthToken } from "@/features/auth/session-token"
import type { ExecutionListParams, ExecutionListResponse, ExecutionResponse } from "@/features/executions/types"

function executionsBaseUrl() {
  const mode = getApiMode()

  if (mode === "mock" && process.env.NODE_ENV === "production") {
    throw new ApiError("Mock executions are available in development only. The real API was not called.", "api_unavailable", 0)
  }

  if (mode === "real") {
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")
    if (!base) {
      throw new ApiError("Real API mode is enabled, but NEXT_PUBLIC_API_URL is not set. Mock mode was not used.", "api_unavailable", 0)
    }
    return base
  }

  if (typeof window !== "undefined" && window.location.origin && window.location.origin !== "null") {
    return window.location.origin
  }

  return "http://localhost:3000"
}

function request<T>(path: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown) {
  return createFetchTransport(executionsBaseUrl(), {
    networkMessage: "The execution service could not be reached.",
    unavailableMessage: "The real execution API is unavailable. Mock mode was not used.",
  }).request<T>({ path, method, body, token: readAuthToken() })
}

export function listExecutions(params: ExecutionListParams) {
  const search = new URLSearchParams({
    q: params.q,
    agent: params.agent,
    environment: params.environment,
    status: params.status,
    range: params.range,
    sort: params.sort,
    page: String(params.page),
  })
  return request<ExecutionListResponse>(`/api/executions?${search.toString()}`, "GET")
}

export function getExecution(id: string) {
  return request<ExecutionResponse>(`/api/executions/${id}`, "GET")
}

export function tickExecution(id: string) {
  return request<ExecutionResponse>(`/api/executions/${id}/tick`, "POST")
}

export function cancelExecution(id: string) {
  return request<ExecutionResponse>(`/api/executions/${id}/cancel`, "POST")
}

export function retryExecution(id: string) {
  return request<ExecutionResponse>(`/api/executions/${id}/retry`, "POST")
}
