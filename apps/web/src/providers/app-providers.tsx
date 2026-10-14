"use client"

import { Suspense } from "react"
import { MotionConfig } from "framer-motion"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MockRuntime } from "@/features/auth/components/mock-runtime"
import { SessionLoading } from "@/features/auth/components/session-loading"
import { QueryProvider } from "@/providers/query-provider"
import { ThemeProvider } from "@/providers/theme-provider"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={300}>
            <Suspense fallback={<SessionLoading message="Starting the mock auth service" />}>
              <MockRuntime>{children}</MockRuntime>
            </Suspense>
          </TooltipProvider>
        </MotionConfig>
      </QueryProvider>
    </ThemeProvider>
  )
}
