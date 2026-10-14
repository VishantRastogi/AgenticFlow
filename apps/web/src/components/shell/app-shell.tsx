"use client"

import { useLayoutEffect } from "react"
import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/shell/app-sidebar"
import { TopBar } from "@/components/shell/top-bar"
import { SearchCommand } from "@/components/shared/search-command"
import { useUiStore } from "@/stores/ui-store"

function isWorkflowCanvas(pathname: string) {
  return pathname === "/workflows/new" || /^\/workflows\/[^/]+\/edit$/.test(pathname)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const canvas = isWorkflowCanvas(pathname)
  useLayoutEffect(() => {
    void useUiStore.persist.rehydrate()
  }, [])

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="absolute top-3 left-3 z-50 -translate-y-[150%] rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:translate-y-0"
      >
        Skip to content
      </a>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main-content" tabIndex={-1} className={canvas ? "flex min-h-0 flex-1 flex-col overflow-hidden outline-none" : "min-h-0 flex-1 overflow-y-auto outline-none"}>
          {canvas ? <div className="min-h-0 flex-1">{children}</div> : <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-8">{children}</div>}
        </main>
      </div>
      <SearchCommand />
    </div>
  )
}
