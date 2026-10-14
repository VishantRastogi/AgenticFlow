"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useReducedMotion } from "framer-motion"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ErrorState } from "@/components/shared/error-state"
import { ListSkeleton } from "@/components/shared/skeletons"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { isApiError } from "@/features/auth/api/errors"
import type { PipelineFrame } from "@/features/deployments/model"
import { PIPELINE_STEPS } from "@/features/deployments/model"
import { useDeploy, useDeployment, useRollback } from "@/features/deployments/hooks"
import { formatTimestamp } from "@/features/dashboard/format"

const healthTone = { healthy: "success", degraded: "warning", critical: "danger" } as const
const releaseTone = { active: "success", superseded: "neutral", failed: "danger" } as const

export function DeploymentDetailScreen({ environmentId }: { environmentId: string }) {
  const deployment = useDeployment(environmentId)
  const deploy = useDeploy(environmentId)
  const rollback = useRollback(environmentId)
  const reduced = useReducedMotion() === true || process.env.VITEST === "true"
  const [frames, setFrames] = useState<PipelineFrame[] | null>(null)
  const [visible, setVisible] = useState(0)
  const [notice, setNotice] = useState("")
  const [confirm, setConfirm] = useState(false)
  const playback = useRef<{ kill: () => void } | null>(null)
  const errorMessage = isApiError(deployment.error) ? deployment.error.message : "The deployment service could not be reached."
  const snapshot = deployment.data
  const previous = snapshot?.releases.find((release) => release.status === "superseded")

  useEffect(() => () => playback.current?.kill(), [])

  async function runPipeline() {
    setNotice("")
    playback.current?.kill()
    try {
      const result = await deploy.mutateAsync()
      setFrames(result.frames)
      if (reduced || process.env.VITEST === "true") {
        setVisible(result.frames.length)
        setNotice(result.release.note)
        return
      }
      const gsap = (await import("gsap")).default
      setVisible(0)
      const timeline = gsap.timeline({ onComplete: () => setNotice(result.release.note) })
      result.frames.forEach((_, index) => {
        timeline.call(() => setVisible(index + 1), [], index * 0.45)
      })
      playback.current = timeline
    } catch (error) {
      setNotice(isApiError(error) ? error.message : "The deployment service could not be reached.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-border/80 pb-5">
        <Link href="/deployments" className="text-xs font-medium tracking-wide text-highlight uppercase">Deployments</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight capitalize">{environmentId}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          The pipeline is a simulated Build, Validate, Deploy, Health Check, and Active sequence. A critical environment fails the health check and leaves the active release in place.
        </p>
      </header>
      {deployment.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">Loading deployment</span>
          <ListSkeleton rows={4} />
        </div>
      ) : null}
      {deployment.isError ? <ErrorState title="Deployment unavailable" description={errorMessage} onRetry={() => void deployment.refetch()} /> : null}
      {snapshot ? (
        <>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div>
              <p className="text-sm text-muted-foreground">Active {snapshot.active.version}</p>
              <p className="mt-1 text-sm">{snapshot.health.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={healthTone[snapshot.health.status]}>{snapshot.health.status}</StatusBadge>
              <Button type="button" onClick={() => void runPipeline()} disabled={deploy.isPending}>Run simulated deploy</Button>
              <Button type="button" variant="outline" disabled={!previous || rollback.isPending} onClick={() => setConfirm(true)}>Roll back</Button>
            </div>
          </section>
          {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
          <ol className="grid gap-2 sm:grid-cols-5" aria-label="Simulated pipeline">
            {PIPELINE_STEPS.map((step, index) => {
              const frame = frames && index < visible ? frames[index] : null
              return (
                <li key={step} className="rounded-lg bg-card px-3 py-3 text-sm ring-1 ring-foreground/10" data-state={frame?.state ?? "pending"}>
                  <p className="text-xs text-muted-foreground">0{index + 1}</p>
                  <p className="mt-1 font-medium">{step}</p>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">{frame?.state ?? "waiting"}</p>
                </li>
              )
            })}
          </ol>
          <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="text-base font-medium">Release history</h2>
            <ul className="mt-3 flex flex-col gap-3">
              {snapshot.releases.map((release) => (
                <li key={release.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3 first:border-t-0 first:pt-0">
                  <div>
                    <p className="font-mono text-sm">{release.version}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{release.note}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatTimestamp(release.createdAt)}</p>
                  </div>
                  <StatusBadge tone={releaseTone[release.status]}>{release.status}</StatusBadge>
                </li>
              ))}
            </ul>
          </section>
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title="Roll back this environment?"
            description={previous ? `Restore ${previous.version}. The current active release stays in the history.` : "There is no previous release to restore."}
            confirmLabel="Roll back"
            destructive
            onConfirm={() => {
              void rollback.mutateAsync().then(
                (result) => setNotice(result.release.note),
                (error: unknown) => setNotice(isApiError(error) ? error.message : "The deployment service could not be reached."),
              )
            }}
          />
        </>
      ) : null}
    </div>
  )
}
