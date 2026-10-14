import { Suspense } from "react"
import type { Metadata } from "next"
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"
import { SessionLoading } from "@/features/auth/components/session-loading"

export const metadata: Metadata = {
  title: "Choose a new password",
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<SessionLoading message="Loading password reset" />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
