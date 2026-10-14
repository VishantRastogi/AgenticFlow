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
import { ExecutionProgress } from "@/features/executions/components/execution-timeline"
import { useExecutionList } from "@/features/executions/hooks"
import type { ExecutionListParams, ExecutionSummary, ObservatoryStatus } from "@/features/executions/types"
import { isTerminalStatus } from "@/features/executions/types"
import { formatDuration, formatTimestamp } from "@/features/dashboard/format"
import { motionTransition } from "@/lib/motion"

const selectClass = "h-11 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 lg:h-8"

const statusTone = {
  queued: "warning",
  running: "info",
  completed: "success",
  failed: "danger",
  cancelled: "neutral",
} as const

const statusLabel: Record<ObservatoryStatus, string> = {
  queued: "Queued",
  running: "Running",
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
          Simulated run history shared with Agent Studio and the command center. Progress on this page is a mock lifecycle, not a live cluster.
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
          {["all", "queued", "running", "completed", "failed", "cancelled"].map((item) => (
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
        <motion.ul className="flex flex-col gap-3" initial={false} animate="show">
          {list.data.executions.map((execution, index) => (
            <ExecutionRow key={execution.id} execution={execution} index={index} reduced={reduced} />
          ))}
        </motion.ul>
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
  const moving = !reduced && !isTerminalStatus(execution.status)
  return (
    <motion.li
      className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...motionTransition(reduced), delay: reduced ? 0 : Math.min(index, 5) * 0.04 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/executions/${execution.id}`} className="font-mono text-sm font-medium hover:text-highlight">
            {execution.id}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/agents/${execution.agentId}`} className="hover:text-foreground">
              {execution.agentName}
            </Link>
            {" · "}
            {execution.environment}
            {" · "}
            {formatTimestamp(execution.startedAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">{formatDuration(execution.durationMs)}</span>
          <StatusBadge tone={statusTone[execution.status]}>
            {statusLabel[execution.status]}
            {execution.status === "running" ? <span className="sr-only">, simulated</span> : null}
          </StatusBadge>
        </div>
      </div>
      <div className="mt-3">
        <ExecutionProgress value={execution.progress} moving={moving} />
      </div>
    </motion.li>
  )
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
