"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useReducedMotion } from "framer-motion"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ErrorState } from "@/components/shared/error-state"
import { ListSkeleton } from "@/components/shared/skeletons"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { isApiError } from "@/features/auth/api/errors"
import { ExecutionLogViewer } from "@/features/executions/components/execution-log-viewer"
import { ExecutionObservatory } from "@/features/executions/components/execution-observatory"
import { ExecutionProgress, ExecutionTimeline } from "@/features/executions/components/execution-timeline"
import { useCancelExecution, useExecution, useRetryExecution } from "@/features/executions/hooks"
import type { ObservatoryStatus } from "@/features/executions/types"
import { isTerminalStatus } from "@/features/executions/types"
import { formatDuration, formatTimestamp } from "@/features/dashboard/format"

const statusTone = {
  queued: "warning",
  running: "info",
  waiting_for_approval: "warning",
  completed: "success",
  failed: "danger",
  cancelled: "neutral",
} as const

const statusLabel: Record<ObservatoryStatus, string> = {
  queued: "Queued",
  running: "Running",
  waiting_for_approval: "Waiting for approval",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
}

export function ExecutionDetailScreen({ executionId }: { executionId: string }) {
  const router = useRouter()
  const execution = useExecution(executionId)
  const cancel = useCancelExecution(executionId)
  const retry = useRetryExecution(executionId)
  const [confirm, setConfirm] = useState<"cancel" | "retry" | null>(null)
  const [notice, setNotice] = useState("")
  const reduced = useReducedMotion() === true || process.env.VITEST === "true"
  const detail = execution.data?.execution
  const errorMessage = isApiError(execution.error) ? execution.error.message : "The execution service could not be reached."

  async function onCancel() {
    try {
      await cancel.mutateAsync()
      setNotice("Run cancelled.")
    } catch (error) {
      setNotice(isApiError(error) ? error.message : "The run could not be cancelled.")
    }
  }

  async function onRetry() {
    try {
      const result = await retry.mutateAsync()
      setNotice(`Queued ${result.execution.id}.`)
      router.push(`/executions/${result.execution.id}`)
    } catch (error) {
      setNotice(isApiError(error) ? error.message : "The run could not be retried.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-border/80 pb-5">
        <Link href="/executions" className="text-xs font-medium tracking-wide text-highlight uppercase">
          Executions
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{detail?.id ?? executionId}</h1>
          {detail ? <StatusBadge tone={statusTone[detail.status]}>{statusLabel[detail.status]}</StatusBadge> : null}
          <StatusBadge tone="neutral">Simulated</StatusBadge>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Mock execution service. The timeline advances on a polling feed until the run reaches a terminal state.
        </p>
      </header>

      {execution.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">Loading execution</span>
          <ListSkeleton rows={6} />
        </div>
      ) : null}
      {execution.isError ? <ErrorState title="Execution unavailable" description={errorMessage} onRetry={() => void execution.refetch()} /> : null}
      {detail ? (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {notice || execution.liveError || detail.permissions.cancel.reason}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!detail.permissions.cancel.allowed || cancel.isPending} onClick={() => setConfirm("cancel")}>
              Cancel
            </Button>
            <Button type="button" disabled={!detail.permissions.retry.allowed || retry.isPending} onClick={() => setConfirm("retry")}>
              Retry
            </Button>
          </div>
          <ExecutionProgress value={detail.progress} moving={!reduced && !isTerminalStatus(detail.status)} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <h2 className="text-base font-medium">Timeline</h2>
              <div className="mt-4">
                <ExecutionTimeline steps={detail.steps} moving={!reduced && !isTerminalStatus(detail.status)} />
              </div>
            </section>
            <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <h2 className="text-base font-medium">Run</h2>
              <dl className="mt-3 grid gap-2 text-sm">
                <Item term="Agent" value={detail.agentName} href={`/agents/${detail.agentId}`} />
                <Item term="Environment" value={detail.environment} />
                <Item term="Started" value={formatTimestamp(detail.startedAt)} />
                <Item term="Finished" value={detail.finishedAt ? formatTimestamp(detail.finishedAt) : "—"} />
                <Item term="Duration" value={formatDuration(detail.durationMs)} />
                <Item term="Attempt" value={`${detail.retry.attempt} of ${detail.retry.maxAttempts}`} />
                <Item term="Retry policy" value={detail.retry.policy} />
                <Item term="Previous run" value={detail.retry.retryOf ?? "—"} href={detail.retry.retryOf ? `/executions/${detail.retry.retryOf}` : undefined} />
                <Item term="Version" value={detail.versionLabel ?? "Unknown"} />
                <Item term="Trace" value={detail.traceId ?? "Not recorded"} />
                <Item term="Workspace" value={detail.workspaceId ?? "local"} />
                <Item
                  term="Workflow"
                  value={detail.workflowId ?? "No workflow is attached."}
                  href={detail.workflowId ? `/workflows/${detail.workflowId}/edit` : undefined}
                />
              </dl>
            </section>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Payload title="Input" value={detail.input} />
            <Payload
              title="Output"
              value={
                detail.output ?? {
                  note: isTerminalStatus(detail.status) ? "This run produced no output." : "No output until the run completes.",
                }
              }
            />
          </div>
          {detail.error ? (
            <section className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive ring-1 ring-destructive/30">
              <h2 className="font-medium">Error</h2>
              <p className="mt-2">{detail.error.message}</p>
              <p className="mt-1 text-xs">Step: {detail.error.step}</p>
            </section>
          ) : null}
          <ExecutionLogViewer executionId={detail.id} logs={detail.logs} />
          <ExecutionObservatory executionId={detail.id} />
        </>
      ) : null}

      <ConfirmDialog
        open={confirm === "cancel"}
        onOpenChange={(open) => setConfirm(open ? "cancel" : null)}
        title="Cancel this run?"
        description="Queued and running work stops. Completed steps stay in the log."
        confirmLabel="Stop run"
        destructive
        onConfirm={() => void onCancel()}
      />
      <ConfirmDialog
        open={confirm === "retry"}
        onOpenChange={(open) => setConfirm(open ? "retry" : null)}
        title="Retry this run?"
        description={detail?.permissions.retry.reason ?? "A new queued execution is recorded. This run stays in history."}
        confirmLabel="Retry run"
        onConfirm={() => void onRetry()}
      />
    </div>
  )
}

function Item({ term, value, href }: { term: string; value: string; href?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="text-right">
        {href ? (
          <Link href={href} className="hover:text-highlight">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

function Payload({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="text-base font-medium">{title}</h2>
      <pre className="mt-3 overflow-x-auto font-mono text-xs leading-5 text-muted-foreground">{JSON.stringify(value, null, 2)}</pre>
    </section>
  )
}
