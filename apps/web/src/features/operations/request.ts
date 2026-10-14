import { ApiError } from "@/features/auth/api/errors"
import { getApiMode } from "@/features/auth/api/mode"
import { createFetchTransport } from "@/features/auth/api/transport"
import { readAuthToken } from "@/features/auth/session-token"

export function operationsRequest<T>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  messages: { network: string; unavailable: string },
  body?: unknown,
) {
  return createFetchTransport(operationsBaseUrl(messages.unavailable), {
    networkMessage: messages.network,
    unavailableMessage: messages.unavailable,
  }).request<T>({ path, method, body, token: readAuthToken() })
}

function operationsBaseUrl(unavailable: string) {
  const mode = getApiMode()

  if (mode === "mock" && process.env.NODE_ENV === "production") {
    throw new ApiError("Mock operations are available in development only. The real API was not called.", "api_unavailable", 0)
  }

  if (mode === "real") {
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")
    if (!base) throw new ApiError(unavailable, "api_unavailable", 0)
    return base
  }

  if (typeof window !== "undefined" && window.location.origin && window.location.origin !== "null") {
    return window.location.origin
  }

  return "http://localhost:3000"
}
