"use client"

import { MotionConfig } from "framer-motion"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryProvider } from "@/providers/query-provider"
import { ThemeProvider } from "@/providers/theme-provider"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </MotionConfig>
      </QueryProvider>
    </ThemeProvider>
  )
}
