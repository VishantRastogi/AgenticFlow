import { ApiError } from "@/features/auth/api/errors"
import { getApiMode } from "@/features/auth/api/mode"
import { createFetchTransport } from "@/features/auth/api/transport"
import { readAuthToken } from "@/features/auth/session-token"
import type {
  WorkflowListParams,
  WorkflowListResponse,
  WorkflowRecord,
  WorkflowRun,
  WorkflowWriteInput,
} from "@/features/workflows/types"

function workflowsBaseUrl() {
  const mode = getApiMode()

  if (mode === "mock" && process.env.NODE_ENV === "production") {
    throw new ApiError("Mock workflows are available in development only. The real API was not called.", "api_unavailable", 0)
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
  return createFetchTransport(workflowsBaseUrl(), {
    networkMessage: "The workflow service could not be reached.",
    unavailableMessage: "The real workflow API is unavailable. Mock mode was not used.",
  }).request<T>({ path, method, body, token: readAuthToken() })
}

export function listWorkflows(params: WorkflowListParams) {
  const search = new URLSearchParams({
    q: params.q,
    status: params.status,
    page: String(params.page),
  })
  return request<WorkflowListResponse>(`/api/workflows?${search.toString()}`, "GET")
}

export function getWorkflow(id: string) {
  return request<{ workflow: WorkflowRecord; simulated: true }>(`/api/workflows/${id}`, "GET")
}

export function createWorkflow(input: WorkflowWriteInput) {
  return request<{ workflow: WorkflowRecord }>("/api/workflows", "POST", input)
}

export function updateWorkflow(id: string, input: Partial<WorkflowWriteInput> & { status?: "draft" }) {
  return request<{ workflow: WorkflowRecord }>(`/api/workflows/${id}`, "PATCH", input)
}

export function deleteWorkflow(id: string) {
  return request<void>(`/api/workflows/${id}`, "DELETE")
}

export function publishWorkflow(id: string) {
  return request<{ workflow: WorkflowRecord }>(`/api/workflows/${id}/publish`, "POST")
}

export function startWorkflowRun(id: string) {
  return request<{ run: WorkflowRun }>(`/api/workflows/${id}/runs`, "POST")
}
