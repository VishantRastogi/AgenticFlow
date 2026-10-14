import { ApiError } from "@/features/auth/api/errors"
import { getApiMode } from "@/features/auth/api/mode"
import { createFetchTransport } from "@/features/auth/api/transport"
import { readAuthToken } from "@/features/auth/session-token"
import type { ExecutionRecord } from "@/features/dashboard/types"
import type { AgentDetail, AgentListParams, AgentListResponse, AgentProfile, AgentWriteInput } from "@/features/agents/types"

function agentsBaseUrl() {
  const mode = getApiMode()

  if (mode === "mock" && process.env.NODE_ENV === "production") {
    throw new ApiError("Mock operations are available in development only. The real API was not called.", "api_unavailable", 0)
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

function agentsTransport() {
  return createFetchTransport(agentsBaseUrl(), {
    networkMessage: "The operations service could not be reached.",
    unavailableMessage: "The real operations API is unavailable. Mock mode was not used.",
  })
}

function request<T>(path: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown) {
  return agentsTransport().request<T>({ path, method, body, token: readAuthToken() })
}

export function listAgents(params: AgentListParams) {
  const search = new URLSearchParams({
    q: params.q,
    status: params.status,
    environment: params.environment,
    type: params.type,
    sort: params.sort,
    page: String(params.page),
  })
  return request<AgentListResponse>(`/api/agents?${search.toString()}`, "GET")
}

export function getAgent(id: string) {
  return request<AgentDetail>(`/api/agents/${id}`, "GET")
}

export function createAgent(input: AgentWriteInput) {
  return request<{ agent: AgentProfile }>("/api/agents", "POST", input)
}

export function updateAgent(id: string, input: AgentWriteInput) {
  return request<{ agent: AgentProfile }>(`/api/agents/${id}`, "PATCH", input)
}

export function deleteAgent(id: string) {
  return request<void>(`/api/agents/${id}`, "DELETE")
}

export function setAgentActive(id: string, active: boolean) {
  return request<{ agent: AgentProfile }>(`/api/agents/${id}`, "PATCH", { status: active ? "active" : "paused" })
}

export function triggerAgentExecution(id: string) {
  return request<{ execution: ExecutionRecord }>(`/api/agents/${id}/executions`, "POST")
}
