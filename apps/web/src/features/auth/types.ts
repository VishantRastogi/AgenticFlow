export type AuthUser = {
  id: string
  name: string
  email: string
}

export type AuthSession = {
  token: string
  expiresAt: string
  user: AuthUser
}

export type LoginInput = {
  email: string
  password: string
}

export type RegisterInput = {
  name: string
  email: string
  password: string
}

export type ForgotPasswordInput = {
  email: string
}

export type ResetPasswordInput = {
  token: string
  password: string
}

export type PasswordResetRequest = {
  message: string
  resetToken?: string
}

export type PasswordResetResult = {
  message: string
}

export type MockAuthHint = {
  name: string
  email: string
  password: string
  notice: string
}

export type ApiErrorCode =
  | "invalid_credentials"
  | "email_taken"
  | "session_expired"
  | "unauthenticated"
  | "forbidden"
  | "invalid_reset_token"
  | "validation_error"
  | "invalid_file_type"
  | "file_too_large"
  | "duplicate_name"
  | "not_found"
  | "invalid_job_transition"
  | "processing_failed"
  | "rate_limited"
  | "cancelled"
  | "network"
  | "api_unavailable"
  | "unknown"

export type ApiErrorBody = {
  code: ApiErrorCode
  message: string
}
