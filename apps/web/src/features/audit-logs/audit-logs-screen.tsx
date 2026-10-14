"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ErrorState } from "@/components/shared/error-state"
import { ListSkeleton } from "@/components/shared/skeletons"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isApiError } from "@/features/auth/api/errors"
import { useAuditLogs } from "@/features/audit-logs/hooks"
import type { AuditQuery } from "@/features/audit-logs/query"
import { formatTimestamp } from "@/features/dashboard/format"
import { motionTransition } from "@/lib/motion"

const selectClass = "h-11 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground lg:h-8"

export function AuditLogsScreen() {
  const [q, setQ] = useState("")
  const [actor, setActor] = useState("all")
  const [resource, setResource] = useState("all")
  const [outcome, setOutcome] = useState<AuditQuery["outcome"]>("all")
  const [range, setRange] = useState<AuditQuery["range"]>("all")
  const [selected, setSelected] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const reduced = useReducedMotion() === true || process.env.VITEST === "true"
  const logs = useAuditLogs({ q, actor, resource, outcome, range })
  const errorMessage = isApiError(logs.error) ? logs.error.message : "The audit service could not be reached."
  const events = logs.data?.events ?? []
  const current = events.find((event) => event.id === selected) ?? null

  function exportEvents() {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "audit-logs.json"
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice(`Exported ${events.length} audit ${events.length === 1 ? "event" : "events"}.`)
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border/80 pb-5">
        <div>
          <p className="text-xs font-medium tracking-wide text-highlight uppercase">Audit</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Audit Logs</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Historical rows are derived from the workspace agents. New rows are appended when the mock API changes data. Secrets are masked.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={exportEvents} disabled={events.length === 0}>Export</Button>
      </header>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Search
          <Input aria-label="Search audit logs" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Action, actor, or resource" />
        </label>
        <Filter label="Actor" value={actor} onChange={setActor} options={["all", ...(logs.data?.actors ?? [])]} />
        <Filter label="Resource" value={resource} onChange={setResource} options={["all", ...(logs.data?.resources ?? [])]} />
        <Filter label="Outcome" value={outcome} onChange={(value) => setOutcome(value as AuditQuery["outcome"])} options={["all", "succeeded", "failed"]} />
        <Filter label="Date" value={range} onChange={(value) => setRange(value as AuditQuery["range"])} options={["all", "24h", "7d", "30d"]} />
      </div>
      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
      {logs.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">Loading audit logs</span>
          <ListSkeleton rows={5} />
        </div>
      ) : null}
      {logs.isError ? <ErrorState title="Audit logs unavailable" description={errorMessage} onRetry={() => void logs.refetch()} /> : null}
      {logs.data && events.length === 0 ? <p className="text-sm text-muted-foreground">No audit events match these filters.</p> : null}
      {events.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <motion.ul className="flex flex-col gap-2" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={motionTransition(reduced)}>
            {events.map((event) => (
              <li key={event.id}>
                <button type="button" onClick={() => setSelected(event.id)} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 text-left ring-1 ring-foreground/10">
                  <span>
                    <span className="block font-mono text-sm">{event.action}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{event.actor} · {event.resourceType} · {formatTimestamp(event.at)}</span>
                  </span>
                  <StatusBadge tone={event.outcome === "succeeded" ? "success" : "danger"}>{event.outcome}</StatusBadge>
                </button>
              </li>
            ))}
          </motion.ul>
          <aside className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="text-base font-medium">Event</h2>
            {current ? (
              <dl className="mt-3 grid gap-2 text-sm">
                <Item term="Actor" value={current.actor} />
                <Item term="Resource" value={`${current.resourceType} ${current.resourceId}`} />
                <Item term="Outcome" value={current.outcome} />
                <Item term="Detail" value={current.detail} />
                {Object.entries(current.fields).map(([key, value]) => (
                  <Item key={key} term={key} value={value} />
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Select an event to see the actor, resource, and masked fields.</p>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  )
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <select aria-label={label} className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function Item({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  )
}
