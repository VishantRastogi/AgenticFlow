"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { ExecutionStep } from "@/features/executions/types"
import { motionTransition } from "@/lib/motion"

const stepClass = {
  pending: "bg-border",
  running: "bg-highlight",
  completed: "bg-emerald-500",
  failed: "bg-destructive",
  skipped: "bg-muted-foreground/40",
} as const

export function ExecutionTimeline({ steps, moving }: { steps: ExecutionStep[]; moving: boolean }) {
  const reduced = useReducedMotion() === true || process.env.VITEST === "true"

  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, index) => (
        <motion.li
          key={step.id}
          className="flex gap-3"
          initial={reduced ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...motionTransition(reduced), delay: reduced ? 0 : index * 0.05 }}
        >
          <span className="flex flex-col items-center">
            <span className={["mt-1 size-2.5 rounded-full", stepClass[step.status], step.status === "running" && moving ? "motion-safe:animate-pulse" : ""].join(" ")} />
            {index < steps.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
          </span>
          <div className="pb-2">
            <p className="text-sm font-medium">{step.label}</p>
            <p className="text-xs text-muted-foreground capitalize">{step.status}</p>
          </div>
        </motion.li>
      ))}
    </ol>
  )
}

export function ExecutionProgress({ value, moving }: { value: number; moving: boolean }) {
  const reduced = useReducedMotion() === true || process.env.VITEST === "true"
  const percent = Math.round(value * 100)

  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label="Execution progress"
    >
      <motion.div
        className="h-full bg-highlight"
        initial={false}
        animate={{ width: `${percent}%` }}
        transition={moving && !reduced ? { duration: 0.45 } : { duration: 0 }}
      />
    </div>
  )
}
