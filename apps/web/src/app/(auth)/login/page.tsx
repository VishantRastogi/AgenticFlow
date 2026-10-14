import { Suspense } from "react"
import type { Metadata } from "next"
import { LoginForm } from "@/features/auth/components/login-form"
import { SessionLoading } from "@/features/auth/components/session-loading"

export const metadata: Metadata = {
  title: "Sign in",
}

export default function LoginPage() {
  return (
    <Suspense fallback={<SessionLoading message="Loading sign in" />}>
      <LoginForm />
    </Suspense>
  )
}
