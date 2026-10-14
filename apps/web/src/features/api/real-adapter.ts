import { ApiError } from "@/features/auth/api/errors"
import { getApiMode } from "@/features/auth/api/mode"
import { createFetchTransport } from "@/features/auth/api/transport"
import { readAuthToken } from "@/features/auth/session-token"
import { apiOperations, type ApiOperationId } from "@/features/api/contract"

export type ContractRequest = {
  params?: Record<string, string>
  query?: Record<string, string | number>
  body?: unknown
}

function mockBaseUrl() {
  if (typeof window !== "undefined" && window.location.origin && window.location.origin !== "null") {
    return window.location.origin
  }

  return "http://localhost:3000"
}

function realBaseUrl(unavailable: string) {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")

  if (!base) {
    throw new ApiError(
      `Real API mode is enabled, but NEXT_PUBLIC_API_URL is not set. ${unavailable}`,
      "api_unavailable",
      0,
    )
  }

  return base
}

export function resolveContractPath(path: string, params: Record<string, string> = {}) {
  return path.replace(/:([A-Za-z]+)/g, (_, key: string) => {
    const value = params[key]
    if (!value) {
      throw new ApiError(`The ${key} parameter is required for ${path}.`, "validation_error", 0)
    }
    return encodeURIComponent(value)
  })
}

export async function callContract<T>(id: ApiOperationId, request: ContractRequest = {}): Promise<T> {
  const operation = apiOperations[id]
  const mode = getApiMode()

  if (operation.scope === "unimplemented" || operation.transport !== "rest") {
    throw new ApiError(operation.unavailable, "api_unavailable", 0)
  }

  if (mode === "real" && operation.scope === "mock-only") {
    throw new ApiError(operation.unavailable, "api_unavailable", 0)
  }

  if (mode === "mock" && process.env.NODE_ENV === "production") {
    throw new ApiError(
      "Mock operations are available in development only. The real API was not called.",
      "api_unavailable",
      0,
    )
  }

  const path = resolveContractPath(operation.path, request.params)
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(request.query ?? {})) {
    search.set(key, String(value))
  }
  const query = search.size > 0 ? `?${search.toString()}` : ""
  const unavailable =
    mode === "real"
      ? `The real API has no implementation for ${id} (${operation.method} ${operation.path}). Mock mode was not used.`
      : operation.unavailable

  return createFetchTransport(mode === "real" ? realBaseUrl(unavailable) : mockBaseUrl(), {
    networkMessage: operation.network,
    unavailableMessage: unavailable,
  }).request<T>({
    path: `${path}${query}`,
    method: operation.method,
    body: request.body,
    token: operation.auth === "bearer" ? readAuthToken() : null,
  })
}
