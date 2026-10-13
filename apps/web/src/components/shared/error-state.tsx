"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ErrorState({
  title,
  description,
  digest,
  onRetry,
}: {
  title: string
  description: string
  digest?: string
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-card px-6 py-10">
      <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        {digest ? (
          <p className="font-mono text-xs text-muted-foreground">Reference {digest}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}
