import { ApiError } from "@/features/auth/api/errors"

export type ApiMode = "mock" | "real"

export function getApiMode(): ApiMode {
  const value = process.env.NEXT_PUBLIC_API_MODE

  if (value === undefined || value === "" || value === "mock") {
    return "mock"
  }

  if (value === "real") {
    return "real"
  }

  throw new ApiError(
    `Unknown NEXT_PUBLIC_API_MODE "${value}". Use mock or real. Mock mode was not used.`,
    "api_unavailable",
    0,
  )
}

export function isMockRuntimeEnabled() {
  return getApiMode() === "mock" && process.env.NODE_ENV === "development" && !process.env.VITEST
}
