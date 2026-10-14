"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ErrorState } from "@/components/shared/error-state"
import { ListSkeleton } from "@/components/shared/skeletons"
import { StatusBadge } from "@/components/shared/status-badge"
import { isApiError } from "@/features/auth/api/errors"
import { useDeployments } from "@/features/deployments/hooks"
import { formatDuration, formatPercent, formatTimestamp } from "@/features/dashboard/format"
import { motionTransition } from "@/lib/motion"

const healthTone = { healthy: "success", degraded: "warning", critical: "danger" } as const

export function DeploymentsScreen() {
  const deployments = useDeployments()
  const reduced = useReducedMotion() === true || process.env.VITEST === "true"
  const errorMessage = isApiError(deployments.error) ? deployments.error.message : "The deployment service could not be reached."

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-border/80 pb-5">
        <p className="text-xs font-medium tracking-wide text-highlight uppercase">Releases</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Deployments</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Development, staging, and production cards are derived from the agents and runs in each environment. Deploys and rollbacks stay in the mock workspace.
        </p>
      </header>
      {deployments.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">Loading deployments</span>
          <ListSkeleton rows={3} />
        </div>
      ) : null}
      {deployments.isError ? <ErrorState title="Deployments unavailable" description={errorMessage} onRetry={() => void deployments.refetch()} /> : null}
      {deployments.data && deployments.data.environments.length === 0 ? <p className="text-sm text-muted-foreground">No deployment targets are available.</p> : null}
      {deployments.data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {deployments.data.environments.map((environment, index) => (
            <motion.article
              key={environment.environment}
              className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...motionTransition(reduced), delay: reduced ? 0 : index * 0.05 }}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-medium capitalize">{environment.environment}</h2>
                <StatusBadge tone={healthTone[environment.health.status]}>{environment.health.status}</StatusBadge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{environment.health.summary}</p>
              <dl className="mt-4 grid gap-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Active version</dt><dd className="font-mono">{environment.active.version}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Success</dt><dd>{formatPercent(environment.health.successRate)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">p95</dt><dd>{formatDuration(environment.health.p95DurationMs)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Updated</dt><dd>{formatTimestamp(environment.active.createdAt)}</dd></div>
              </dl>
              <Link href={`/deployments/${environment.environment}`} className="mt-4 inline-flex text-sm font-medium text-highlight hover:underline">
                Open release history
              </Link>
            </motion.article>
          ))}
        </div>
      ) : null}
    </div>
  )
}
