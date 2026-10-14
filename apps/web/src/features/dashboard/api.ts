import { ApiError } from "@/features/auth/api/errors"
import { getApiMode } from "@/features/auth/api/mode"
import { createFetchTransport } from "@/features/auth/api/transport"
import { readAuthToken } from "@/features/auth/session-token"
import type { AgentRecord, CreateAgentInput, DashboardQuery, DashboardSnapshot } from "@/features/dashboard/types"

function operationsBaseUrl() {
  const mode = getApiMode()

  if (mode === "mock" && process.env.NODE_ENV === "production") {
    throw new ApiError(
      "Mock operations are available in development only. The real API was not called.",
      "api_unavailable",
      0,
    )
  }

  if (mode === "real") {
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")
    if (!base) {
      throw new ApiError(
        "Real API mode is enabled, but NEXT_PUBLIC_API_URL is not set. Mock mode was not used.",
        "api_unavailable",
        0,
      )
    }
    return base
  }

  if (typeof window !== "undefined" && window.location.origin && window.location.origin !== "null") {
    return window.location.origin
  }

  return "http://localhost:3000"
}

function operationsTransport() {
  return createFetchTransport(operationsBaseUrl(), {
    networkMessage: "The operations service could not be reached.",
    unavailableMessage: "The real operations API is unavailable. Mock mode was not used.",
  })
}

export async function getDashboard(query: DashboardQuery) {
  const params = new URLSearchParams({
    environment: query.environment,
    range: query.range,
  })

  return operationsTransport().request<DashboardSnapshot>({
    path: `/api/operations/dashboard?${params.toString()}`,
    method: "GET",
    token: readAuthToken(),
  })
}

export async function createAgent(input: CreateAgentInput) {
  return operationsTransport().request<{ agent: AgentRecord }>({
    path: "/api/operations/agents",
    method: "POST",
    body: input,
    token: readAuthToken(),
  })
}
