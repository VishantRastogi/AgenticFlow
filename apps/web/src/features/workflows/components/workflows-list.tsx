"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { Plus } from "lucide-react"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ErrorState } from "@/components/shared/error-state"
import { StatCardSkeleton } from "@/components/shared/skeletons"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isApiError } from "@/features/auth/api/errors"
import { useDeleteWorkflow, useWorkflowList } from "@/features/workflows/hooks"
import type { WorkflowListParams, WorkflowSummary } from "@/features/workflows/types"
import { formatTimestamp } from "@/features/dashboard/format"
import { motionTransition } from "@/lib/motion"

const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function WorkflowsScreen() {
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<WorkflowListParams["status"]>("all")
  const [page, setPage] = useState(1)
  const reduced = useReducedMotion() === true
  const skipMotion = reduced || process.env.VITEST === "true"
  const workflows = useWorkflowList({ q, status, page })
  const total = workflows.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / (workflows.data?.pageSize ?? 6)))
  const message = isApiError(workflows.error) ? workflows.error.message : "The workflow service could not be reached."

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-border/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-highlight uppercase">Workflow canvas</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Draft, publish, and test how work moves across the canvas. Changes stay in this browser.
          </p>
        </div>
        <Button asChild>
          <Link href="/workflows/new">
            <Plus aria-hidden="true" />
            New workflow
          </Link>
        </Button>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="grid gap-1 text-xs text-muted-foreground sm:min-w-56">
          Search
          <Input value={q} aria-label="Search workflows" placeholder="Name or description" onChange={(event) => { setQ(event.target.value); setPage(1) }} />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Status
          <select className={selectClass} aria-label="Status" value={status} onChange={(event) => { setStatus(event.target.value as WorkflowListParams["status"]); setPage(1) }}>
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
      </div>
      {workflows.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
          <span className="sr-only">Loading workflows</span>
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : null}
      {workflows.isError && !workflows.data ? <ErrorState title="Workflows unavailable" description={message} onRetry={() => void workflows.refetch()} /> : null}
      {workflows.data && workflows.data.workflows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-10 text-sm text-muted-foreground">No workflows match these filters.</p>
      ) : null}
      {workflows.data && workflows.data.workflows.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {workflows.data.workflows.map((workflow, index) => (
            <motion.div
              key={workflow.id}
              initial={skipMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...motionTransition(reduced), delay: skipMotion ? 0 : index * 0.04 }}
            >
              <WorkflowCard workflow={workflow} />
            </motion.div>
          ))}
        </div>
      ) : null}
      {workflows.data && total > workflows.data.pageSize ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Previous
          </Button>
          <p className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </p>
          <Button type="button" variant="outline" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>
            Next
          </Button>
        </nav>
      ) : null}
    </div>
  )
}

function WorkflowCard({ workflow }: { workflow: WorkflowSummary }) {
  const [open, setOpen] = useState(false)
  const remove = useDeleteWorkflow(workflow.id)

  return (
    <article className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/workflows/${workflow.id}/edit`} className="text-base font-medium hover:text-primary">
            {workflow.name}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{workflow.description}</p>
        </div>
        <StatusBadge tone={workflow.status === "published" ? "success" : "neutral"}>{workflow.status === "published" ? "Published" : "Draft"}</StatusBadge>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>v{workflow.version}</span>
        <span>{formatTimestamp(workflow.updatedAt)}</span>
      </div>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${workflow.name}`}
        description="The workflow leaves this browser catalog."
        confirmLabel="Delete workflow"
        destructive
        onConfirm={() => void remove.mutateAsync()}
      />
    </article>
  )
}
