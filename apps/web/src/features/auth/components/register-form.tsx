"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { isApiError } from "@/features/auth/api/errors"
import { AuthField, FormBanner, PasswordField } from "@/features/auth/components/auth-fields"
import { useRegister, useSession } from "@/features/auth/hooks"
import { registerSchema, type RegisterFormValues } from "@/features/auth/schemas"

export function RegisterForm() {
  const router = useRouter()
  const session = useSession()
  const registerAccount = useRegister()
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  })

  useEffect(() => {
    if (session.data) {
      router.replace("/overview")
    }
  }, [router, session.data])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await registerAccount.mutateAsync({
        name: values.name,
        email: values.email,
        password: values.password,
      })
      router.replace("/overview")
    } catch (error) {
      form.setError("root", {
        message: isApiError(error) ? error.message : "Registration failed.",
      })
    }
  })

  return (
    <form className="grid gap-5" onSubmit={onSubmit} noValidate aria-labelledby="register-title">
      <div className="grid gap-2">
        <h1 id="register-title" className="text-2xl font-semibold tracking-tight">
          Create account
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          The account is saved in the development mock store. It is not a secure identity.
        </p>
      </div>
      {form.formState.errors.root?.message ? <FormBanner tone="error">{form.formState.errors.root.message}</FormBanner> : null}
      {registerAccount.isSuccess ? <FormBanner tone="success">Account created. Opening Mission Control.</FormBanner> : null}
      <AuthField
        id="register-name"
        label="Name"
        autoComplete="name"
        registration={form.register("name")}
        error={form.formState.errors.name?.message}
      />
      <AuthField
        id="register-email"
        label="Email"
        type="email"
        autoComplete="email"
        registration={form.register("email")}
        error={form.formState.errors.email?.message}
      />
      <PasswordField
        id="register-password"
        label="Password"
        autoComplete="new-password"
        registration={form.register("password")}
        error={form.formState.errors.password?.message}
      />
      <PasswordField
        id="register-confirm"
        label="Confirm password"
        autoComplete="new-password"
        registration={form.register("confirmPassword")}
        error={form.formState.errors.confirmPassword?.message}
      />
      <Button type="submit" className="h-10" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
