"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ErrorState } from "@/components/shared/error-state"
import { ListSkeleton } from "@/components/shared/skeletons"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { isApiError } from "@/features/auth/api/errors"
import { AgentForm } from "@/features/agents/components/agent-form"
import { AgentStudioPanel } from "@/features/agents/components/studio-panel"
import { useAgent, useDeleteAgent, useSetAgentActive, useTriggerExecution, useUpdateAgent } from "@/features/agents/hooks"
import type { AgentWriteInput } from "@/features/agents/types"
import { formatDuration, formatPercent, formatTimestamp } from "@/features/dashboard/format"
import { motionTransition } from "@/lib/motion"

const tabs = ["Overview", "Configuration", "Knowledge", "Tools", "Executions", "Traces", "Versions"] as const
type AgentTab = (typeof tabs)[number]

const statusTone = {
  active: "success",
  idle: "neutral",
  paused: "warning",
  error: "danger",
} as const

const executionTone = {
  succeeded: "success",
  completed: "success",
  failed: "danger",
  running: "info",
  queued: "warning",
  cancelled: "neutral",
} as const

export function AgentDetailScreen({ agentId }: { agentId: string }) {
  const router = useRouter()
  const agent = useAgent(agentId)
  const [tab, setTab] = useState<AgentTab>("Overview")
  const [notice, setNotice] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<"activate" | "delete" | null>(null)
  const reduced = useReducedMotion() === true
  const skipMotion = reduced || process.env.VITEST === "true"
  const update = useUpdateAgent(agentId)
  const remove = useDeleteAgent(agentId)
  const activation = useSetAgentActive(agentId)
  const trigger = useTriggerExecution(agentId)
  const errorMessage = isApiError(agent.error) ? agent.error.message : "The operations service could not be reached."

  async function save(input: AgentWriteInput) {
    setFormError(null)
    try {
      await update.mutateAsync(input)
      setNotice("Configuration saved.")
      setTab("Overview")
    } catch (error) {
      setFormError(isApiError(error) ? error.message : "The agent could not be saved.")
    }
  }

  async function run() {
    setNotice(null)
    try {
      const result = await trigger.mutateAsync()
      setNotice(`Recorded ${result.execution.id} as ${result.execution.status}.`)
      setTab("Executions")
    } catch (error) {
      setNotice(null)
      setFormError(isApiError(error) ? error.message : "The run could not be started.")
    }
  }

  if (agent.isPending) {
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading agent</span>
        <ListSkeleton rows={6} />
      </div>
    )
  }

  if (agent.isError || !agent.data) {
    return <ErrorState title="Agent unavailable" description={errorMessage} onRetry={() => void agent.refetch()} />
  }

  const current = agent.data
  const active = current.agent.status === "active"
  const paused = current.agent.status === "paused"

  return (
    <motion.div
      className="flex flex-col gap-6"
      initial={skipMotion ? false : { opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={motionTransition(reduced, 0.28)}
    >
      <header className="flex flex-col gap-4 border-b border-border/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/agents" className="text-xs font-medium tracking-wide text-highlight uppercase">
            Agent Studio
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{current.agent.name}</h1>
            <AnimatePresence mode="wait">
              <motion.span key={current.agent.status} initial={skipMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}>
                <StatusBadge tone={statusTone[current.agent.status]}>{label(current.agent.status)}</StatusBadge>
              </motion.span>
            </AnimatePresence>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{current.agent.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setConfirm("activate")}>
            {active ? "Deactivate" : "Activate"}
          </Button>
          <Button type="button" onClick={() => void run()} disabled={paused || trigger.isPending}>
            {trigger.isPending ? "Running" : "Run agent"}
          </Button>
          <Button type="button" variant="destructive" onClick={() => setConfirm("delete")}>
            Delete
          </Button>
        </div>
      </header>
      <p role="status" className="text-xs text-muted-foreground">
        Simulated agent record. Success rate and runs are derived from shared execution history.
        {paused ? " Paused agents cannot run." : ""}
      </p>
      {notice ? (
        <p role="status" className="text-sm text-foreground">
          {notice}
        </p>
      ) : null}
      {formError && tab !== "Configuration" ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <div role="tablist" aria-label="Agent sections" className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={tab === item ? "border-b-2 border-primary px-3 py-2 text-sm font-medium text-foreground" : "px-3 py-2 text-sm text-muted-foreground"}
          >
            {item}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={skipMotion ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={skipMotion ? { opacity: 1 } : { opacity: 0, x: -8 }}
          transition={motionTransition(reduced)}
        >
          {tab === "Overview" ? (
            <div className="grid gap-6">
              <Overview data={current} />
              <AgentStudioPanel agentId={current.agent.id} section="test" />
            </div>
          ) : null}
          {tab === "Configuration" ? (
            <div className="grid gap-8">
              <AgentForm
                mode="edit"
                pending={update.isPending}
                error={formError}
                defaults={{
                  name: current.agent.name,
                  description: current.agent.description,
                  type: current.agent.type,
                  environment: current.agent.environment,
                  timeoutMs: current.agent.timeoutMs,
                  retryPolicy: current.agent.retryPolicy,
                  version: current.agent.version,
                  status: current.agent.status,
                  configuration: JSON.stringify(current.agent.configuration, null, 2),
                }}
                onSubmit={save}
              />
              <AgentStudioPanel agentId={current.agent.id} section="configuration" />
            </div>
          ) : null}
          {tab === "Knowledge" ? <AgentStudioPanel agentId={current.agent.id} section="knowledge" /> : null}
          {tab === "Tools" ? <AgentStudioPanel agentId={current.agent.id} section="tools" /> : null}
          {tab === "Executions" ? <ExecutionList executions={current.executions} /> : null}
          {tab === "Traces" ? <LogList logs={current.logs} /> : null}
          {tab === "Versions" ? (
            <div className="grid gap-6">
              <VersionList versions={current.versions} />
              <AgentStudioPanel agentId={current.agent.id} section="versions" />
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
      <ConfirmDialog
        open={confirm === "activate"}
        onOpenChange={(open) => setConfirm(open ? "activate" : null)}
        title={active ? `Deactivate ${current.agent.name}` : `Activate ${current.agent.name}`}
        description={active ? "The agent pauses and will not accept new runs." : "The agent becomes active and can accept runs."}
        confirmLabel={active ? "Deactivate" : "Activate"}
        destructive={active}
        onConfirm={() => void activation.mutateAsync(!active)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => setConfirm(open ? "delete" : null)}
        title={`Delete ${current.agent.name}`}
        description="The agent leaves the catalog. This simulated delete stays in the browser."
        confirmLabel="Delete agent"
        destructive
        onConfirm={() => {
          void remove.mutateAsync().then(() => router.push("/agents"))
        }}
      />
    </motion.div>
  )
}

function Overview({ data }: { data: NonNullable<ReturnType<typeof useAgent>["data"]> }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2">
        <h2 className="text-base font-medium">Recent runs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.stats.totalExecutions} executions · {data.stats.failed} failed · success {formatPercent(data.stats.successRate)}
        </p>
        <ExecutionList executions={data.stats.recentRuns.slice(0, 5)} />
      </section>
      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-base font-medium">Profile</h2>
        <dl className="mt-3 grid gap-2 text-sm">
          <Item term="Type" value={label(data.agent.type)} />
          <Item term="Environment" value={label(data.agent.environment)} />
          <Item term="Timeout" value={formatDuration(data.agent.timeoutMs)} />
          <Item term="Retry" value={label(data.agent.retryPolicy)} />
          <Item term="Version" value={data.agent.version} />
        </dl>
      </section>
    </div>
  )
}

function ExecutionList({ executions }: { executions: { id: string; status: keyof typeof executionTone; startedAt: string; durationMs: number | null; agentVersion?: string }[] }) {
  if (executions.length === 0) return <p className="mt-3 text-sm text-muted-foreground">No executions yet.</p>
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {executions.map((execution) => (
        <li key={execution.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link href={`/executions/${execution.id}`} className="font-mono text-xs hover:text-highlight">
            {execution.id}
          </Link>
          <StatusBadge tone={executionTone[execution.status]}>{label(execution.status)}</StatusBadge>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(execution.startedAt)} · version {execution.agentVersion ?? "Not recorded"}
          </span>
          <span className="font-mono text-xs text-muted-foreground">{formatDuration(execution.durationMs)}</span>
        </li>
      ))}
    </ul>
  )
}

function LogList({ logs }: { logs: { id: string; at: string; level: "info" | "error"; message: string }[] }) {
  if (logs.length === 0) return <p className="text-sm text-muted-foreground">No logs for this agent.</p>
  return (
    <ul className="flex flex-col gap-2">
      {logs.map((log) => (
        <li key={log.id} className="rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10">
          <span className={log.level === "error" ? "text-destructive" : "text-highlight"}>{log.level}</span>
          <span className="mx-2 text-muted-foreground">{formatTimestamp(log.at)}</span>
          {log.message}
        </li>
      ))}
    </ul>
  )
}

function VersionList({ versions }: { versions: { version: string; updatedAt: string; note: string }[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {versions.map((version) => (
        <li key={`${version.version}-${version.updatedAt}`} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
          <p className="font-mono text-sm">{version.version}</p>
          <p className="text-sm text-muted-foreground">{version.note}</p>
          <p className="text-xs text-muted-foreground">{formatTimestamp(version.updatedAt)}</p>
        </li>
      ))}
    </ol>
  )
}

function Item({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function label(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
