"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { Activity, Bot, Plus, RefreshCw, Timer, TriangleAlert } from "lucide-react"
import { z } from "zod"
import { ErrorState } from "@/components/shared/error-state"
import { SectionCard } from "@/components/shared/section-card"
import { StatCardSkeleton, ListSkeleton } from "@/components/shared/skeletons"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { isApiError } from "@/features/auth/api/errors"
import { AgentStatusChart, ExecutionTrendChart, ExecutionVolumeChart } from "@/features/dashboard/components/dashboard-charts"
import { DashboardReveal } from "@/features/dashboard/components/dashboard-reveal"
import { formatDuration, formatTimestamp } from "@/features/dashboard/format"
import { useCreateAgent, useDashboard } from "@/features/dashboard/hooks"
import type {
  DashboardRange,
  DashboardSnapshot,
  EnvironmentFilter,
  ExecutionStatus,
  RuntimeEnvironment,
  RuntimeHealth,
} from "@/features/dashboard/types"
import { motionTransition } from "@/lib/motion"

const ranges: { id: DashboardRange; label: string }[] = [
  { id: "24h", label: "24 hours" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
]

const environments: { id: EnvironmentFilter; label: string }[] = [
  { id: "all", label: "All environments" },
  { id: "production", label: "Production" },
  { id: "staging", label: "Staging" },
  { id: "sandbox", label: "Sandbox" },
]

const executionTone: Record<ExecutionStatus, "success" | "danger" | "info" | "warning" | "neutral"> = {
  succeeded: "success",
  completed: "success",
  failed: "danger",
  running: "info",
  queued: "warning",
  cancelled: "neutral",
}

const healthTone: Record<RuntimeHealth, "success" | "warning" | "danger"> = {
  healthy: "success",
  degraded: "warning",
  critical: "danger",
}

const agentSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters."),
  environment: z.enum(["production", "staging", "sandbox"]),
})

function statusLabel(status: ExecutionStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function DashboardScreen() {
  const [environment, setEnvironment] = useState<EnvironmentFilter>("all")
  const [range, setRange] = useState<DashboardRange>("24h")
  const dashboard = useDashboard({ environment, range })
  const reduced = useReducedMotion() === true
  const errorMessage = isApiError(dashboard.error) ? dashboard.error.message : "The operations service could not be reached."

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-border/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-highlight uppercase">Mission Control</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Command Center</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Agent inventory, execution volume, and runtime health for the selected environment.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Environment
            <select
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as EnvironmentFilter)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {environments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div role="radiogroup" aria-label="Date range" className="flex h-8 overflow-hidden rounded-lg border border-input">
            {ranges.map((item) => {
              const selected = range === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setRange(item.id)}
                  className={
                    selected
                      ? "bg-primary px-2.5 text-xs font-medium text-primary-foreground"
                      : "px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  }
                >
                  {item.label}
                </button>
              )
            })}
          </div>
          <Button type="button" variant="outline" onClick={() => void dashboard.refetch()} disabled={dashboard.isFetching}>
            <RefreshCw aria-hidden="true" />
            {dashboard.isFetching ? "Refreshing" : "Refresh"}
          </Button>
          <NewAgentDialog />
        </div>
      </header>
      <DashboardReveal />
      {dashboard.isPending ? <DashboardSkeleton /> : null}
      {dashboard.isError && !dashboard.data ? (
        <ErrorState title="Command center unavailable" description={errorMessage} onRetry={() => void dashboard.refetch()} />
      ) : null}
      {dashboard.data ? (
        <DashboardBody
          data={dashboard.data}
          reduced={reduced}
          staleError={dashboard.isError ? errorMessage : null}
          onRetry={() => void dashboard.refetch()}
        />
      ) : null}
    </div>
  )
}

function DashboardBody({
  data,
  reduced,
  staleError,
  onRetry,
}: {
  data: DashboardSnapshot
  reduced: boolean
  staleError: string | null
  onRetry: () => void
}) {
  const { kpis } = data
  const hasExecutions = data.volume.some((point) => point.executions > 0)
  const hasOutcomes = data.trends.some((point) => point.succeeded > 0 || point.failed > 0)

  return (
    <div className="flex flex-col gap-6">
      <p role="status" className="text-xs leading-5 text-muted-foreground">
        Simulated live activity. Figures are derived from mock operation records as of {formatTimestamp(data.asOf)}.
      </p>
      {staleError ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{staleError}</p>
          <Button type="button" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
      <div key={`${data.environment}-${data.range}`} className="flex flex-col gap-6">
          <Reveal reduced={reduced} delay={0.04} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" label="Command center metrics">
            <StatCard label="Total Agents" value={kpis.totalAgents} hint="Selected environment" icon={Bot} />
            <StatCard label="Active Agents" value={kpis.activeAgents} hint="Status is active" icon={Activity} />
            <StatCard label="Executions Today" value={kpis.executionsToday} hint="Simulated UTC day" icon={Timer} />
            <StatCard
              label="Success Rate"
              value={kpis.successRate === null ? "—" : kpis.successRate * 100}
              digits={1}
              suffix={kpis.successRate === null ? "" : "%"}
              hint="Completed runs"
            />
            <StatCard
              label="p95 Duration"
              value={kpis.p95DurationMs === null ? "—" : kpis.p95DurationMs / 1000}
              digits={1}
              suffix={kpis.p95DurationMs === null ? "" : " s"}
              hint="Completed runs"
            />
            <StatCard label="Active Runs" value={kpis.activeRuns} hint="Status is running" icon={TriangleAlert} />
          </Reveal>

          <Reveal reduced={reduced} delay={0.1} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <SectionCard title="Execution volume" description="Runs started in each bucket of the selected window.">
                {hasExecutions ? <ExecutionVolumeChart data={data.volume} /> : <p className="text-sm text-muted-foreground">No executions in this window.</p>}
              </SectionCard>
            </div>
            <SectionCard title="Agent status" description="Distribution of agent states in this environment.">
              {data.agentStatus.some((point) => point.count > 0) ? (
                <AgentStatusChart data={data.agentStatus} />
              ) : (
                <p className="text-sm text-muted-foreground">No agents in this environment.</p>
              )}
            </SectionCard>
          </Reveal>

          <Reveal reduced={reduced} delay={0.16}>
            <SectionCard title="Success and failure" description="Completed executions only. Running and queued runs stay out of this trend.">
              {hasOutcomes ? <ExecutionTrendChart data={data.trends} /> : <p className="text-sm text-muted-foreground">No completed executions in this window.</p>}
            </SectionCard>
          </Reveal>

          <Reveal reduced={reduced} delay={0.22} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <SectionCard title="Live executions" description="Latest runs in this window, including in-progress work.">
                {data.liveExecutions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No executions in this window.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[36rem] text-left text-sm">
                      <caption className="sr-only">Live executions</caption>
                      <thead className="text-xs text-muted-foreground">
                        <tr>
                          <th className="pb-2 font-medium">Status</th>
                          <th className="pb-2 font-medium">Agent</th>
                          <th className="pb-2 font-medium">Start</th>
                          <th className="pb-2 font-medium">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.liveExecutions.map((execution) => (
                          <tr key={execution.id} className="border-t border-border/80">
                            <td className="py-2.5 pr-3">
                              <StatusBadge tone={executionTone[execution.status]}>
                                {statusLabel(execution.status)}
                                {execution.status === "running" ? <span className="sr-only">, simulated live</span> : null}
                              </StatusBadge>
                            </td>
                            <td className="py-2.5 pr-3">
                              <Link href={`/executions/${execution.id}`} className="font-medium hover:text-highlight">
                                {execution.agentName}
                              </Link>
                            </td>
                            <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{formatTimestamp(execution.startedAt)}</td>
                            <td className="py-2.5 font-mono text-xs text-muted-foreground">{formatDuration(execution.durationMs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </div>
            <div className="flex flex-col gap-4">
              <SectionCard title="Recent failures" description="Latest failed runs in this window.">
                {data.failures.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No failures in this window.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {data.failures.map((failure) => (
                      <li key={failure.id} className="flex items-start justify-between gap-3 text-sm">
                        <div>
                          <p className="font-medium text-foreground">{failure.agentName}</p>
                          <p className="font-mono text-xs text-muted-foreground">{formatTimestamp(failure.startedAt)}</p>
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">{formatDuration(failure.durationMs)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
              <SectionCard title="Operational alerts" description="Derived from agent state and the success rate.">
                {data.alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No operational alerts.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {data.alerts.map((alert) => (
                      <li key={alert.id} className="space-y-1">
                        <StatusBadge tone={alert.tone}>{alert.title}</StatusBadge>
                        <p className="text-sm text-muted-foreground">{alert.detail}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          </Reveal>

          <Reveal reduced={reduced} delay={0.28}>
            <SectionCard title="Runtime health" description={data.health.summary} action={<StatusBadge tone={healthTone[data.health.status]}>{data.health.status}</StatusBadge>}>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild variant="outline">
                  <Link href="/executions">Review executions</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/agents">Open agents</Link>
                </Button>
                <Button type="button" variant="outline" onClick={onRetry}>
                  Refresh metrics
                </Button>
              </div>
            </SectionCard>
          </Reveal>
      </div>
    </div>
  )
}

function Reveal({
  reduced,
  delay,
  className,
  label,
  children,
}: {
  reduced: boolean
  delay: number
  className?: string
  label?: string
  children: React.ReactNode
}) {
  const Comp = label ? motion.section : motion.div
  return (
    <Comp
      className={className}
      aria-label={label}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...motionTransition(reduced), delay: reduced ? 0 : delay }}
    >
      {children}
    </Comp>
  )
}

function NewAgentDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [environment, setEnvironment] = useState<RuntimeEnvironment>("production")
  const [formError, setFormError] = useState<string | null>(null)
  const create = useCreateAgent()

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = agentSchema.safeParse({ name, environment })
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the agent details.")
      return
    }

    setFormError(null)
    try {
      await create.mutateAsync(parsed.data)
      setName("")
      setOpen(false)
    } catch (error) {
      setFormError(isApiError(error) ? error.message : "The agent could not be created.")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setFormError(null)
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">
          <Plus aria-hidden="true" />
          New agent
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New agent</DialogTitle>
          <DialogDescription>Adds a simulated agent to the mock operations store. It starts idle and has no executions yet.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(event) => void onSubmit(event)}>
          <label className="flex flex-col gap-1 text-sm" htmlFor="agent-name">
            Agent name
            <Input id="agent-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Agent environment
            <select
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as RuntimeEnvironment)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="sandbox">Sandbox</option>
            </select>
          </label>
          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating" : "Create agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading command center</span>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
      <ListSkeleton rows={6} />
    </div>
  )
}
