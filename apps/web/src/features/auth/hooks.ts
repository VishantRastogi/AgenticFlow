"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { isApiError } from "@/features/auth/api/errors"
import {
  getMockHint,
  getSession,
  login,
  logout,
  register,
  requestPasswordReset,
  resetPassword,
} from "@/features/auth/api/client"
import { getApiMode } from "@/features/auth/api/mode"
import { clearAuthToken } from "@/features/auth/session-token"
import type { ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput } from "@/features/auth/types"

export const authKeys = {
  session: ["auth", "session"] as const,
  hint: ["auth", "mock-hint"] as const,
}

export function useSession() {
  return useQuery({
    queryKey: authKeys.session,
    queryFn: async () => {
      try {
        return await getSession()
      } catch (error) {
        if (isApiError(error) && (error.code === "unauthenticated" || error.code === "session_expired")) {
          clearAuthToken()
        }
        if (isApiError(error) && error.code === "unauthenticated") {
          return null
        }
        throw error
      }
    },
    retry: false,
    staleTime: 30_000,
  })
}

export function useMockHint() {
  return useQuery({
    queryKey: authKeys.hint,
    queryFn: getMockHint,
    enabled: getApiMode() === "mock",
    retry: false,
    staleTime: Infinity,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (session) => {
      queryClient.setQueryData(authKeys.session, session)
    },
  })
}

export function useRegister() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: RegisterInput) => register(input),
    onSuccess: (session) => {
      queryClient.setQueryData(authKeys.session, session)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(authKeys.session, null)
    },
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) => requestPasswordReset(input),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => resetPassword(input),
  })
}
