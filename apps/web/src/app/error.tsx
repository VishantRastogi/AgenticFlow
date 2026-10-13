"use client"

import { useEffect } from "react"
import { StatusScreen } from "@/components/shared/status-screen"
import { Button } from "@/components/ui/button"

export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <StatusScreen
      code="Error"
      title="Mission Control hit a problem"
      description="This screen failed before the workspace shell could render. Retry the view, or return to overview."
      digest={error.digest}
      actions={
        <Button type="button" onClick={() => retry()}>
          Try again
        </Button>
      }
    />
  )
}
