"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ErrorState } from "@/components/shared/error-state"
import { ListSkeleton } from "@/components/shared/skeletons"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isApiError } from "@/features/auth/api/errors"
import { useExecutionList } from "@/features/executions/hooks"
import type { ExecutionListParams, ExecutionSummary, ObservatoryStatus } from "@/features/executions/types"
import { formatDuration, formatTimestamp } from "@/features/dashboard/format"
import { motionTransition } from "@/lib/motion"

const selectClass = "h-11 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 lg:h-8"

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

export function ExecutionsScreen() {
  const [q, setQ] = useState("")
  const [agent, setAgent] = useState("all")
  const [environment, setEnvironment] = useState<ExecutionListParams["environment"]>("all")
  const [status, setStatus] = useState<ExecutionListParams["status"]>("all")
  const [range, setRange] = useState<ExecutionListParams["range"]>("all")
  const [sort, setSort] = useState<ExecutionListParams["sort"]>("newest")
  const [page, setPage] = useState(1)
  const reduced = useReducedMotion() === true || process.env.VITEST === "true"
  const list = useExecutionList({ q, agent, environment, status, range, sort, page })
  const errorMessage = isApiError(list.error) ? list.error.message : "The execution service could not be reached."
  const total = list.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / (list.data?.pageSize ?? 8)))

  function update<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-border/80 pb-5">
        <p className="text-xs font-medium tracking-wide text-highlight uppercase">Execution observatory</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Executions</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Agent tests, workflow runs, and catalog runs for this workspace. Simulated rows stay labeled. Missing versions stay unknown.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Search
          <Input aria-label="Search executions" value={q} onChange={(event) => update(setQ)(event.target.value)} placeholder="Run or agent" />
        </label>
        <Filter label="Agent" value={agent} onChange={update(setAgent)}>
          <option value="all">all</option>
          {(list.data?.agents ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Filter>
        <Filter label="Environment" value={environment} onChange={update(setEnvironment)}>
          {["all", "production", "staging", "sandbox"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Filter>
        <Filter label="Status" value={status} onChange={update(setStatus)}>
          {["all", "queued", "running", "waiting_for_approval", "completed", "failed", "cancelled"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Filter>
        <Filter label="Date" value={range} onChange={update(setRange)}>
          <option value="all">all</option>
          <option value="24h">24h</option>
          <option value="7d">7d</option>
          <option value="30d">30d</option>
        </Filter>
        <Filter label="Sort" value={sort} onChange={update(setSort)}>
          {["newest", "oldest", "duration", "status", "agent"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Filter>
      </div>

      {list.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">Loading executions</span>
          <ListSkeleton rows={6} />
        </div>
      ) : null}
      {list.isError ? <ErrorState title="Executions unavailable" description={errorMessage} onRetry={() => void list.refetch()} /> : null}
      {list.data && list.data.executions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No executions match these filters.</p>
      ) : null}
      {list.data && list.data.executions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-separate border-spacing-y-2 text-left text-sm">
            <caption className="sr-only">Execution history</caption>
            <thead className="text-xs text-muted-foreground">
              <tr>
                {["Run", "Subject", "Version", "Status", "Started", "Ended", "Duration", "Model", "Tokens", "Cost", "Workspace", "Trace"].map((heading) => (
                  <th key={heading} scope="col" className="px-2 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.executions.map((execution, index) => (
                <ExecutionRow key={execution.id} execution={execution} index={index} reduced={reduced} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {total > (list.data?.pageSize ?? 8) ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </Button>
            <Button type="button" variant="outline" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ExecutionRow({ execution, index, reduced }: { execution: ExecutionSummary; index: number; reduced: boolean }) {
  const subject = execution.workflowId ? `/workflows/${execution.workflowId}/edit` : execution.agentId ? `/agents/${execution.agentId}` : undefined
  const ended = execution.durationMs === null ? null : new Date(Date.parse(execution.startedAt) + execution.durationMs).toISOString()
  return (
    <motion.tr
      className="bg-card"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ ...motionTransition(reduced), delay: reduced ? 0 : Math.min(index, 5) * 0.04 }}
    >
      <td className="rounded-l-lg px-2 py-3">
        <Link href={`/executions/${execution.id}`} className="font-mono text-sm font-medium hover:text-highlight">
          {execution.id}
        </Link>
      </td>
      <td className="px-2 py-3">
        {subject ? <Link href={subject} className="hover:text-highlight">{execution.agentName}</Link> : execution.agentName}
      </td>
      <Cell>{execution.versionLabel ?? "Unknown"}</Cell>
      <td className="px-2 py-3">
        <StatusBadge tone={statusTone[execution.status]}>
          {statusLabel[execution.status]}
          {execution.simulated ? <span className="sr-only">, simulated</span> : null}
        </StatusBadge>
      </td>
      <Cell>{formatTimestamp(execution.startedAt)}</Cell>
      <Cell>{ended ? formatTimestamp(ended) : "—"}</Cell>
      <Cell>{formatDuration(execution.durationMs)}</Cell>
      <Cell>{execution.model ?? "Not recorded"}</Cell>
      <Cell>{execution.tokenCount === null || execution.tokenCount === undefined ? "Not recorded" : String(execution.tokenCount)}</Cell>
      <Cell>{execution.estimatedCostUsd === null || execution.estimatedCostUsd === undefined ? "Not recorded" : `$${execution.estimatedCostUsd.toFixed(6)}`}</Cell>
      <Cell>{execution.workspaceId ?? "local"}</Cell>
      <td className="rounded-r-lg px-2 py-3 font-mono text-xs">{execution.traceId ?? "Not recorded"}</td>
    </motion.tr>
  )
}

function Cell({ children }: { children: string }) {
  return <td className="px-2 py-3 text-muted-foreground">{children}</td>
}

function Filter<T extends string>({ label, value, onChange, children }: { label: string; value: T; onChange: (value: T) => void; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <select aria-label={label} className={selectClass} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {children}
      </select>
    </label>
  )
}
