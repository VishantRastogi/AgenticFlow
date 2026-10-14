import { createAuthTransport, type AuthTransport } from "@/features/auth/api/transport"
import { clearAuthToken, readAuthToken, writeAuthToken } from "@/features/auth/session-token"
import type {
  AuthSession,
  ForgotPasswordInput,
  LoginInput,
  MockAuthHint,
  PasswordResetRequest,
  PasswordResetResult,
  RegisterInput,
  ResetPasswordInput,
} from "@/features/auth/types"

let transport: AuthTransport | null = null

export function setAuthTransport(next: AuthTransport | null) {
  transport = next
}

function getTransport() {
  return transport ?? createAuthTransport()
}

export async function login(input: LoginInput) {
  const session = await getTransport().request<AuthSession>({
    path: "/api/auth/login",
    method: "POST",
    body: input,
  })
  writeAuthToken(session.token)
  return session
}

export async function register(input: RegisterInput) {
  const session = await getTransport().request<AuthSession>({
    path: "/api/auth/register",
    method: "POST",
    body: input,
  })
  writeAuthToken(session.token)
  return session
}

export async function logout() {
  const token = readAuthToken()
  await getTransport().request<void>({
    path: "/api/auth/logout",
    method: "POST",
    token,
  })
  clearAuthToken()
}

export async function getSession() {
  const token = readAuthToken()
  return getTransport().request<AuthSession>({
    path: "/api/auth/session",
    method: "GET",
    token,
  })
}

export async function requestPasswordReset(input: ForgotPasswordInput) {
  return getTransport().request<PasswordResetRequest>({
    path: "/api/auth/forgot-password",
    method: "POST",
    body: input,
  })
}

export async function resetPassword(input: ResetPasswordInput) {
  return getTransport().request<PasswordResetResult>({
    path: "/api/auth/reset-password",
    method: "POST",
    body: input,
  })
}

export async function getMockHint() {
  return getTransport().request<MockAuthHint>({
    path: "/api/auth/mock-hint",
    method: "GET",
  })
}
