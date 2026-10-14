"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { LayoutGrid, Plus, Table } from "lucide-react"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ErrorState } from "@/components/shared/error-state"
import { StatCardSkeleton } from "@/components/shared/skeletons"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isApiError } from "@/features/auth/api/errors"
import { useAgentList, useSetAgentActive } from "@/features/agents/hooks"
import type { AgentListParams, AgentSummary } from "@/features/agents/types"
import { formatPercent } from "@/features/dashboard/format"
import { motionTransition } from "@/lib/motion"

const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const statusTone = {
  active: "success",
  idle: "neutral",
  paused: "warning",
  error: "danger",
} as const

export function AgentsScreen() {
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<AgentListParams["status"]>("all")
  const [environment, setEnvironment] = useState<AgentListParams["environment"]>("all")
  const [type, setType] = useState<AgentListParams["type"]>("all")
  const [sort, setSort] = useState<AgentListParams["sort"]>("name")
  const [page, setPage] = useState(1)
  const [view, setView] = useState<"grid" | "table">("grid")
  const reduced = useReducedMotion() === true
  const skipMotion = reduced || process.env.VITEST === "true"
  const agents = useAgentList({ q, status, environment, type, sort, page })
  const errorMessage = isApiError(agents.error) ? agents.error.message : "The operations service could not be reached."
  const total = agents.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / (agents.data?.pageSize ?? 6)))
  const filtered = q.trim().length > 0 || status !== "all" || environment !== "all" || type !== "all"

  function update<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-border/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-highlight uppercase">Agent Studio</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Search, tune, and run agents. Changes stay in this browser and feed the command center.
          </p>
        </div>
        <Button asChild>
          <Link href="/agents/new">
            <Plus aria-hidden="true" />
            New agent
          </Link>
        </Button>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <label className="grid gap-1 text-xs text-muted-foreground lg:min-w-56">
          Search
          <Input value={q} onChange={(event) => update(setQ)(event.target.value)} placeholder="Name or description" aria-label="Search agents" />
        </label>
        <Filter label="Status" value={status} onChange={update(setStatus)} options={["all", "active", "idle", "paused", "error"]} />
        <Filter label="Environment" value={environment} onChange={update(setEnvironment)} options={["all", "production", "staging", "sandbox"]} />
        <Filter label="Type" value={type} onChange={update(setType)} options={["all", "planner", "researcher", "operator", "reviewer"]} />
        <Filter label="Sort" value={sort} onChange={update(setSort)} options={["name", "updated", "success", "status"]} />
        <div role="radiogroup" aria-label="View" className="flex h-8 overflow-hidden rounded-lg border border-input">
          <ViewButton selected={view === "grid"} onClick={() => setView("grid")} label="Grid">
            <LayoutGrid aria-hidden="true" />
            Grid
          </ViewButton>
          <ViewButton selected={view === "table"} onClick={() => setView("table")} label="Table">
            <Table aria-hidden="true" />
            Table
          </ViewButton>
        </div>
      </div>

      {agents.isPending ? <AgentSkeleton /> : null}
      {agents.isError && !agents.data ? <ErrorState title="Agents unavailable" description={errorMessage} onRetry={() => void agents.refetch()} /> : null}
      {agents.data && agents.data.agents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-10 text-sm text-muted-foreground">
          {filtered ? "No agents match these filters." : "No agents yet. Create one to start a run."}
        </p>
      ) : null}
      {agents.data && agents.data.agents.length > 0 ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={skipMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={skipMotion ? undefined : { opacity: 0 }}
            transition={motionTransition(reduced)}
          >
            {view === "grid" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {agents.data.agents.map((agent, index) => (
                  <AgentCard key={agent.id} agent={agent} index={index} skipMotion={skipMotion} reduced={reduced} />
                ))}
              </div>
            ) : (
              <AgentTable agents={agents.data.agents} />
            )}
          </motion.div>
        </AnimatePresence>
      ) : null}
      {agents.data && total > agents.data.pageSize ? (
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

function AgentCard({
  agent,
  index,
  skipMotion,
  reduced,
}: {
  agent: AgentSummary
  index: number
  skipMotion: boolean
  reduced: boolean
}) {
  return (
    <motion.article
      className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      initial={skipMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...motionTransition(reduced), delay: skipMotion ? 0 : index * 0.04 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/agents/${agent.id}`} className="text-base font-medium text-foreground hover:text-primary">
            {agent.name}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground capitalize">
            {agent.type} · {agent.environment}
          </p>
        </div>
        <StatusBadge tone={statusTone[agent.status]}>{label(agent.status)}</StatusBadge>
      </div>
      <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{agent.description}</p>
      <div className="mt-auto flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Success {formatPercent(agent.successRate)}</span>
        <span className="font-mono">{agent.version}</span>
      </div>
      <ActivationControl agent={agent} />
    </motion.article>
  )
}

function AgentTable({ agents }: { agents: AgentSummary[] }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">Agents</caption>
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Agent</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Environment</th>
            <th className="px-4 py-3 font-medium">Success</th>
            <th className="px-4 py-3 font-medium">Version</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.id} className="border-t border-border/80">
              <td className="px-4 py-3">
                <Link href={`/agents/${agent.id}`} className="font-medium hover:text-primary">
                  {agent.name}
                </Link>
                <p className="text-xs text-muted-foreground capitalize">{agent.type}</p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge tone={statusTone[agent.status]}>{label(agent.status)}</StatusBadge>
              </td>
              <td className="px-4 py-3 capitalize">{agent.environment}</td>
              <td className="px-4 py-3 font-mono text-xs">{formatPercent(agent.successRate)}</td>
              <td className="px-4 py-3 font-mono text-xs">{agent.version}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActivationControl({ agent }: { agent: AgentSummary }) {
  const [open, setOpen] = useState(false)
  const active = agent.status === "active"
  const mutation = useSetAgentActive(agent.id)

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} disabled={mutation.isPending}>
        {active ? "Deactivate" : "Activate"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={active ? `Deactivate ${agent.name}` : `Activate ${agent.name}`}
        description={
          active
            ? `${agent.name} will pause and stop accepting new runs.`
            : `${agent.name} will become active and can accept runs.`
        }
        confirmLabel={active ? "Deactivate" : "Activate"}
        destructive={active}
        onConfirm={() => void mutation.mutateAsync(!active)}
      />
    </>
  )
}

function Filter<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: T[]
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <select className={selectClass} value={value} aria-label={label} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labelFor(option)}
          </option>
        ))}
      </select>
    </label>
  )
}

function ViewButton({
  selected,
  onClick,
  label,
  children,
}: {
  selected: boolean
  onClick: () => void
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onClick}
      className={selected ? "inline-flex items-center gap-1.5 bg-primary px-2.5 text-xs font-medium text-primary-foreground" : "inline-flex items-center gap-1.5 px-2.5 text-xs text-muted-foreground"}
    >
      {children}
    </button>
  )
}

function AgentSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      <span className="sr-only">Loading agents</span>
      {Array.from({ length: 6 }, (_, index) => (
        <StatCardSkeleton key={index} />
      ))}
    </div>
  )
}

function label(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function labelFor(value: string) {
  if (value === "all") return "All"
  if (value === "success") return "Success rate"
  if (value === "updated") return "Recently updated"
  return label(value)
}
