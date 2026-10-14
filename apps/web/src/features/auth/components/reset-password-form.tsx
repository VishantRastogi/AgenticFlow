"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { isApiError } from "@/features/auth/api/errors"
import { FormBanner, PasswordField } from "@/features/auth/components/auth-fields"
import { useResetPassword } from "@/features/auth/hooks"
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/features/auth/schemas"

export function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const reset = useResetPassword()
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    if (!token) {
      form.setError("root", { message: "This reset link is missing a token." })
      return
    }

    try {
      await reset.mutateAsync({ token, password: values.password })
    } catch (error) {
      form.setError("root", {
        message: isApiError(error) ? error.message : "The password reset failed.",
      })
    }
  })

  return (
    <form className="grid gap-5" onSubmit={onSubmit} noValidate aria-labelledby="reset-title">
      <div className="grid gap-2">
        <h1 id="reset-title" className="text-2xl font-semibold tracking-tight">
          Choose a new password
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          The mock store replaces the previous password. Sign in again after it updates.
        </p>
      </div>
      {!token ? <FormBanner tone="error">This reset link is missing a token.</FormBanner> : null}
      {form.formState.errors.root?.message ? <FormBanner tone="error">{form.formState.errors.root.message}</FormBanner> : null}
      {reset.data ? (
        <FormBanner tone="success">
          {reset.data.message}{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </FormBanner>
      ) : null}
      <PasswordField
        id="reset-password"
        label="New password"
        autoComplete="new-password"
        registration={form.register("password")}
        error={form.formState.errors.password?.message}
      />
      <PasswordField
        id="reset-confirm"
        label="Confirm password"
        autoComplete="new-password"
        registration={form.register("confirmPassword")}
        error={form.formState.errors.confirmPassword?.message}
      />
      <Button type="submit" className="h-10" disabled={form.formState.isSubmitting || !token} aria-busy={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Updating password…" : "Update password"}
      </Button>
    </form>
  )
}
