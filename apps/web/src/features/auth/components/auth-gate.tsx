"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { isApiError } from "@/features/auth/api/errors"
import { SessionLoading } from "@/features/auth/components/session-loading"
import { useSession } from "@/features/auth/hooks"
import { safeNextPath } from "@/features/auth/paths"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const session = useSession()
  const expired = isApiError(session.error) && session.error.code === "session_expired"

  useEffect(() => {
    if (session.isPending || session.data) {
      return
    }

    const params = new URLSearchParams({ next: safeNextPath(pathname) })
    if (expired) {
      params.set("reason", "expired")
    }
    router.replace(`/login?${params.toString()}`)
  }, [expired, pathname, router, session.data, session.isPending])

  if (session.isPending) {
    return <SessionLoading message="Checking session" />
  }

  if (session.isError && !expired) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6">
        <p role="alert" className="max-w-sm text-sm text-destructive">
          {isApiError(session.error) ? session.error.message : "The session could not be checked."}
        </p>
      </div>
    )
  }

  if (!session.data) {
    return <SessionLoading message="Checking session" />
  }

  return children
}
