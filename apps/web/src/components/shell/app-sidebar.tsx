"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"
import { BrandMark } from "@/components/shell/brand-mark"
import { NavLinks } from "@/components/shell/nav-links"
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { motionTransition } from "@/lib/motion"
import { useUiStore } from "@/stores/ui-store"
import { cn } from "@/lib/utils"

const expandedWidth = 248
const collapsedWidth = 72

export function AppSidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const hydrated = useUiStore((state) => state.hydrated)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const setCommandOpen = useUiStore((state) => state.setCommandOpen)
  const reduced = usePrefersReducedMotion()
  const collapseLabel = collapsed ? "Expand sidebar" : "Collapse sidebar"

  const collapseButton = (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={collapsed}
      aria-expanded={!collapsed}
      aria-controls="primary-navigation"
      aria-label={collapseLabel}
      onClick={toggleSidebar}
      className={cn(
        "w-full text-muted-foreground",
        collapsed ? "justify-center px-0" : "justify-start",
      )}
    >
      {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
      <span className="sidebar-copy">{collapseLabel}</span>
    </Button>
  )

  return (
    <motion.aside
      className="app-sidebar hidden h-dvh shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar md:flex md:flex-col"
      initial={false}
      animate={hydrated ? { width: collapsed ? collapsedWidth : expandedWidth } : undefined}
      transition={motionTransition(reduced)}
    >
      <div className="flex h-full flex-col gap-3 px-2.5 py-3">
        <Link
          href="/overview"
          className="relative flex items-center gap-2.5 rounded-lg px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <BrandMark />
          <span className="sidebar-copy min-w-0">
            <span className="block text-sm font-semibold tracking-tight text-sidebar-foreground">
              AgentFlow
            </span>
            <span className="block text-xs text-muted-foreground">Mission Control</span>
          </span>
        </Link>
        <WorkspaceSwitcher collapsed={collapsed} />
        <nav
          id="primary-navigation"
          aria-label="Primary"
          data-collapsed={collapsed ? "true" : "false"}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <NavLinks collapsed={collapsed} />
        </nav>
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="ghost"
            aria-label="Search"
            aria-keyshortcuts="Control+K Meta+K"
            onClick={() => setCommandOpen(true)}
            className={cn(
              "w-full text-muted-foreground",
              collapsed ? "justify-center px-0" : "justify-start",
            )}
          >
            <Search aria-hidden="true" />
            <span className="sidebar-copy">Search</span>
            <kbd className="sidebar-copy ml-auto rounded border border-sidebar-border px-1.5 py-0.5 font-mono text-[10px]">
              Ctrl K
            </kbd>
          </Button>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{collapseButton}</TooltipTrigger>
              <TooltipContent side="right">{collapseLabel}</TooltipContent>
            </Tooltip>
          ) : (
            collapseButton
          )}
        </div>
      </div>
    </motion.aside>
  )
}
