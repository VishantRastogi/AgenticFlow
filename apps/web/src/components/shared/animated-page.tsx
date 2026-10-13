"use client"

import { motion } from "framer-motion"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { motionTransition } from "@/lib/motion"

export function AnimatedPage({ children }: { children: React.ReactNode }) {
  const reduced = usePrefersReducedMotion()

  return (
    <motion.div
      className="flex flex-col gap-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionTransition(reduced)}
    >
      {children}
    </motion.div>
  )
}
