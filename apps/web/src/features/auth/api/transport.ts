import { ApiError } from "@/features/auth/api/errors"
import { getApiMode } from "@/features/auth/api/mode"
import type { ApiErrorBody, ApiErrorCode } from "@/features/auth/types"

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE"

export type HttpRequest = {
  path: string
  method: HttpMethod
  body?: unknown
  token?: string | null
  signal?: AbortSignal
}

export interface AuthTransport {
  request<T>(request: HttpRequest): Promise<T>
}

const errorCodes = new Set<ApiErrorCode>([
  "invalid_credentials",
  "email_taken",
  "session_expired",
  "unauthenticated",
  "invalid_reset_token",
  "forbidden",
  "validation_error",
  "invalid_file_type",
  "file_too_large",
  "duplicate_name",
  "not_found",
  "invalid_job_transition",
  "processing_failed",
  "rate_limited",
  "cancelled",
  "network",
  "api_unavailable",
  "unknown",
])

function mockBaseUrl() {
  if (typeof window !== "undefined" && window.location.origin && window.location.origin !== "null") {
    return window.location.origin
  }

  return "http://localhost:3000"
}

function realBaseUrl() {
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

export function createAuthTransport(): AuthTransport {
  const mode = getApiMode()

  if (mode === "mock" && process.env.NODE_ENV === "production") {
    throw new ApiError(
      "Mock authentication is available in development only. The real API was not called.",
      "api_unavailable",
      0,
    )
  }

  return createFetchTransport(mode === "real" ? realBaseUrl() : mockBaseUrl())
}

export function createFetchTransport(
  baseUrl: string,
  options?: { networkMessage?: string; unavailableMessage?: string },
): AuthTransport {
  const networkMessage = options?.networkMessage ?? "The auth service could not be reached."
  const unavailableMessage =
    options?.unavailableMessage ?? "The real auth API is unavailable. Mock mode was not used."

  return {
    async request<T>(request: HttpRequest): Promise<T> {
      const mode = getApiMode()
      let response: Response

      if (request.signal?.aborted) {
        throw new ApiError("The request was cancelled.", "cancelled", 0)
      }

      try {
        response = await fetch(`${baseUrl}${request.path}`, {
          method: request.method,
          cache: "no-store",
          signal: request.signal,
          headers: {
            accept: "application/json",
            ...(request.body === undefined ? {} : { "content-type": "application/json" }),
            ...(request.token ? { authorization: `Bearer ${request.token}` } : {}),
          },
          body: request.body === undefined ? undefined : JSON.stringify(request.body),
        })
      } catch (error) {
        if (request.signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          throw new ApiError("The request was cancelled.", "cancelled", 0)
        }
        throw new ApiError(
          mode === "real" ? unavailableMessage : networkMessage,
          mode === "real" ? "api_unavailable" : "network",
          0,
        )
      }

      if (response.status === 204) {
        return undefined as T
      }

      const payload = await readPayload(response)

      if (!response.ok) {
        if (mode === "real" && (response.status === 404 || response.status >= 500 || !isErrorBody(payload))) {
          throw new ApiError(unavailableMessage, "api_unavailable", response.status)
        }

        if (isErrorBody(payload)) {
          throw new ApiError(payload.message, payload.code, response.status)
        }

        throw new ApiError(networkMessage, "unknown", response.status)
      }

      return payload as T
    },
  }
}

async function readPayload(response: Response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== "object") {
    return false
  }

  const body = value as { code?: unknown; message?: unknown }
  return typeof body.message === "string" && typeof body.code === "string" && errorCodes.has(body.code as ApiErrorCode)
}
