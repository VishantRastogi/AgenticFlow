"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { isApiError } from "@/features/auth/api/errors"
import { AuthField, FormBanner, PasswordField } from "@/features/auth/components/auth-fields"
import { useLogin, useMockHint, useSession } from "@/features/auth/hooks"
import { safeNextPath } from "@/features/auth/paths"
import { loginSchema, type LoginFormValues } from "@/features/auth/schemas"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = safeNextPath(searchParams.get("next"))
  const session = useSession()
  const expired =
    searchParams.get("reason") === "expired" ||
    (isApiError(session.error) && session.error.code === "session_expired")
  const hint = useMockHint()
  const login = useLogin()
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  useEffect(() => {
    if (session.data) {
      router.replace(nextPath)
    }
  }, [nextPath, router, session.data])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values)
      router.replace(nextPath)
    } catch (error) {
      form.setError("root", {
        message: isApiError(error) ? error.message : "Sign in failed.",
      })
    }
  })

  return (
    <form className="grid gap-5" onSubmit={onSubmit} noValidate aria-labelledby="login-title">
      <div className="grid gap-2">
        <h1 id="login-title" className="text-2xl font-semibold tracking-tight">
          Sign in
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">Use your Mission Control account to open the console.</p>
      </div>
      {expired ? <FormBanner tone="success">Your session expired. Sign in again. This mock session is not secure.</FormBanner> : null}
      {form.formState.errors.root?.message ? <FormBanner tone="error">{form.formState.errors.root.message}</FormBanner> : null}
      {login.isSuccess ? <FormBanner tone="success">Signed in. Opening Mission Control.</FormBanner> : null}
      <AuthField
        id="login-email"
        label="Email"
        type="email"
        autoComplete="email"
        registration={form.register("email")}
        error={form.formState.errors.email?.message}
      />
      <PasswordField
        id="login-password"
        label="Password"
        autoComplete="current-password"
        registration={form.register("password")}
        error={form.formState.errors.password?.message}
      />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm text-primary underline-offset-4 hover:underline">
          Forgot password
        </Link>
      </div>
      <Button type="submit" className="h-10" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-sm text-muted-foreground">
        No account yet?{" "}
        <Link href="/register" className="text-primary underline underline-offset-4">
          Create one
        </Link>
      </p>
      {hint.data ? (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-xs leading-5 text-muted-foreground">
          {hint.data.notice} Initial mock account: {hint.data.name}, {hint.data.email}, {hint.data.password}.
        </p>
      ) : null}
    </form>
  )
}
