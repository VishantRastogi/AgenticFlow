import { callContract } from "@/features/api/real-adapter"
import { apiOperations, type ApiOperationId } from "@/features/api/contract"
import type { AuthTransport, HttpRequest } from "@/features/auth/api/transport"
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

function authRequest<T>(id: ApiOperationId, body?: unknown) {
  if (!transport) {
    return callContract<T>(id, { body })
  }

  const operation = apiOperations[id]
  const request: HttpRequest = {
    path: operation.path,
    method: operation.method,
    body,
    token: operation.auth === "bearer" ? readAuthToken() : null,
  }
  return transport.request<T>(request)
}

export async function login(input: LoginInput) {
  const session = await authRequest<AuthSession>("auth.login", input)
  writeAuthToken(session.token)
  return session
}

export async function register(input: RegisterInput) {
  const session = await authRequest<AuthSession>("auth.register", input)
  writeAuthToken(session.token)
  return session
}

export async function logout() {
  await authRequest<void>("auth.logout")
  clearAuthToken()
}

export async function getSession() {
  return authRequest<AuthSession>("auth.session")
}

export async function requestPasswordReset(input: ForgotPasswordInput) {
  return authRequest<PasswordResetRequest>("auth.forgotPassword", input)
}

export async function resetPassword(input: ResetPasswordInput) {
  return authRequest<PasswordResetResult>("auth.resetPassword", input)
}

export async function getMockHint() {
  return authRequest<MockAuthHint>("auth.mockHint")
}
