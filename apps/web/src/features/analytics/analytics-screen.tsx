"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ErrorState } from "@/components/shared/error-state"
import { ListSkeleton } from "@/components/shared/skeletons"
import { isApiError } from "@/features/auth/api/errors"
import { ExecutionHeatmap, OutcomeDonut, ThroughputChart } from "@/features/analytics/components/analytics-charts"
import { useAnalytics } from "@/features/analytics/hooks"
import type { AnalyticsQuery } from "@/features/analytics/types"
import { formatDuration, formatPercent } from "@/features/dashboard/format"
import { motionTransition } from "@/lib/motion"

const selectClass = "h-11 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground lg:h-8"

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value)
}

export function AnalyticsScreen() {
  const [environment, setEnvironment] = useState<AnalyticsQuery["environment"]>("all")
  const [range, setRange] = useState<AnalyticsQuery["range"]>("30d")
  const analytics = useAnalytics({ environment, range })
  const reduced = useReducedMotion() === true || process.env.VITEST === "true"
  const errorMessage = isApiError(analytics.error) ? analytics.error.message : "The analytics service could not be reached."
  const snapshot = analytics.data
  const total = snapshot?.throughput.reduce((sum, point) => sum + point.executions, 0) ?? 0

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-border/80 pb-5">
        <p className="text-xs font-medium tracking-wide text-highlight uppercase">Analytics</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Throughput, latency, tokens, and cost are derived from the same mock execution records as the command center. This is not a provider bill.
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Environment
          <select aria-label="Environment" className={selectClass} value={environment} onChange={(event) => setEnvironment(event.target.value as AnalyticsQuery["environment"])}>
            {["all", "production", "staging", "sandbox"].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Date
          <select aria-label="Date" className={selectClass} value={range} onChange={(event) => setRange(event.target.value as AnalyticsQuery["range"])}>
            {["24h", "7d", "30d"].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      {analytics.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">Loading analytics</span>
          <ListSkeleton rows={4} />
        </div>
      ) : null}
      {analytics.isError ? <ErrorState title="Analytics unavailable" description={errorMessage} onRetry={() => void analytics.refetch()} /> : null}
      {snapshot ? (
        <motion.div className="flex flex-col gap-4" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={motionTransition(reduced)}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Runs" value={String(total)} />
            <Metric label="p50" value={formatDuration(snapshot.latency.p50)} />
            <Metric label="p95" value={formatDuration(snapshot.latency.p95)} />
            <Metric label="p99" value={formatDuration(snapshot.latency.p99)} />
            <Metric label="Tokens" value={snapshot.tokens.toLocaleString("en-US")} />
            <Metric label="Estimated cost" value={money(snapshot.cost)} />
          </div>
          {total === 0 ? <p className="text-sm text-muted-foreground">No executions in this window.</p> : null}
          <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="text-base font-medium">Throughput</h2>
            <p className="mt-1 text-sm text-muted-foreground">Runs started in each bucket of the selected window.</p>
            <ThroughputChart data={snapshot.throughput} />
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <h2 className="text-base font-medium">Outcomes</h2>
              <ul className="mt-2 flex gap-3 text-xs text-muted-foreground">
                {snapshot.outcomes.map((item) => (
                  <li key={item.outcome}>{item.outcome} {item.count}</li>
                ))}
              </ul>
              <OutcomeDonut data={snapshot.outcomes} />
            </section>
            <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <h2 className="text-base font-medium">Hourly heatmap</h2>
              <p className="mt-1 mb-3 text-sm text-muted-foreground">UTC day by hour. Darker cells have more runs.</p>
              <ExecutionHeatmap heatmap={snapshot.heatmap} />
            </section>
          </div>
          <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="text-base font-medium">Agent comparison</h2>
            {snapshot.leaderboard.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No agents match this environment.</p> : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 font-medium">Agent</th>
                      <th className="py-2 font-medium">Runs</th>
                      <th className="py-2 font-medium">Success</th>
                      <th className="py-2 font-medium">p95</th>
                      <th className="py-2 font-medium">Tokens</th>
                      <th className="py-2 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.leaderboard.map((row) => (
                      <tr key={row.agentId} className="border-t border-border/70">
                        <td className="py-2">
                          <Link href={`/agents/${row.agentId}`} className="font-medium hover:text-highlight">{row.agentName}</Link>
                          <span className="ml-2 text-xs text-muted-foreground">{row.environment}</span>
                        </td>
                        <td className="py-2 font-mono">{row.runs}</td>
                        <td className="py-2">{formatPercent(row.successRate)}</td>
                        <td className="py-2">{formatDuration(row.p95DurationMs)}</td>
                        <td className="py-2 font-mono">{row.tokens.toLocaleString("en-US")}</td>
                        <td className="py-2 font-mono">{money(row.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </motion.div>
      ) : null}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg text-foreground">{value}</p>
    </div>
  )
}
