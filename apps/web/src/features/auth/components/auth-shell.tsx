"use client"

import { motion } from "framer-motion"
import { BrandMark } from "@/components/shell/brand-mark"
import { OrbitalField } from "@/features/auth/components/orbital-field"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { motionTransition } from "@/lib/motion"

export function AuthShell({ children }: { children: React.ReactNode }) {
  const reduced = usePrefersReducedMotion()

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
      <section className="relative hidden overflow-hidden bg-canvas lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <OrbitalField />
        </div>
        <div className="relative z-10 flex items-center gap-3 px-10 pt-10">
          <BrandMark />
          <div>
            <p className="text-sm font-semibold tracking-tight">AgentFlow</p>
            <p className="text-xs text-muted-foreground">Mission Control</p>
          </div>
        </div>
        <div className="relative z-10 max-w-md px-10 pb-12">
          <p className="text-3xl font-semibold tracking-tight text-foreground">Sign in to the console</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Agents, workflows, and executions stay behind this session check.
          </p>
        </div>
      </section>
      <div className="flex items-center justify-center px-5 py-12 sm:px-8">
        <motion.div
          className="w-full max-w-[24rem]"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionTransition(reduced, 0.4)}
        >
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark />
            <span className="text-sm font-semibold tracking-tight">AgentFlow</span>
          </div>
          {children}
        </motion.div>
      </div>
    </div>
  )
}
