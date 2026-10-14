"use client"

import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { isApiError } from "@/features/auth/api/errors"
import { AuthField, FormBanner } from "@/features/auth/components/auth-fields"
import { useForgotPassword } from "@/features/auth/hooks"
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/features/auth/schemas"

export function ForgotPasswordForm() {
  const requestReset = useForgotPassword()
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await requestReset.mutateAsync(values)
    } catch (error) {
      form.setError("root", {
        message: isApiError(error) ? error.message : "The reset request failed.",
      })
    }
  })

  const result = requestReset.data

  return (
    <form className="grid gap-5" onSubmit={onSubmit} noValidate aria-labelledby="forgot-title">
      <div className="grid gap-2">
        <h1 id="forgot-title" className="text-2xl font-semibold tracking-tight">
          Reset password
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          No email is sent. In mock mode, a reset token is returned when the account exists.
        </p>
      </div>
      {form.formState.errors.root?.message ? <FormBanner tone="error">{form.formState.errors.root.message}</FormBanner> : null}
      {result ? (
        <FormBanner tone="success">
          {result.message}
          {result.resetToken ? (
            <>
              {" "}
              <Link
                href={`/reset-password?token=${encodeURIComponent(result.resetToken)}`}
                className="font-medium text-primary underline underline-offset-4"
              >
                Continue to reset
              </Link>
            </>
          ) : null}
        </FormBanner>
      ) : null}
      <AuthField
        id="forgot-email"
        label="Email"
        type="email"
        autoComplete="email"
        registration={form.register("email")}
        error={form.formState.errors.email?.message}
      />
      <Button type="submit" className="h-10" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Requesting reset…" : "Request reset"}
      </Button>
      <p className="text-sm text-muted-foreground">
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}
