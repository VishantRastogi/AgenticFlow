import type { ApiErrorCode } from "@/features/auth/types"

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number

  constructor(message: string, code: ApiErrorCode, status: number) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
