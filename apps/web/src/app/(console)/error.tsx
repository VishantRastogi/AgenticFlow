"use client"

import { useEffect } from "react"
import { ErrorState } from "@/components/shared/error-state"

export default function ConsoleError({
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
    <ErrorState
      title="This view failed to load"
      description="The rest of Mission Control is still available. You can retry this view."
      digest={error.digest}
      onRetry={retry}
    />
  )
}
