"use client"

import { Search } from "lucide-react"
import { Breadcrumbs } from "@/components/shell/breadcrumbs"
import { MobileNav } from "@/components/shell/mobile-nav"
import { UserMenu } from "@/components/shell/user-menu"
import { NotificationPopover } from "@/components/shared/notification-popover"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { Button } from "@/components/ui/button"
import { useUiStore } from "@/stores/ui-store"

export function TopBar() {
  const setCommandOpen = useUiStore((state) => state.setCommandOpen)

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-3 backdrop-blur-md md:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <MobileNav />
        <Breadcrumbs />
      </div>
      <div className="hidden min-w-0 flex-1 justify-center md:flex">
      <Button
        type="button"
        variant="outline"
        aria-label="Search"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={() => setCommandOpen(true)}
        className="h-8 w-full max-w-md justify-between px-2.5 font-normal text-muted-foreground"
      >
        <span className="flex items-center gap-2">
          <Search aria-hidden="true" />
          Search
        </span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          Ctrl K
        </kbd>
      </Button>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Search"
          aria-keyshortcuts="Control+K Meta+K"
          onClick={() => setCommandOpen(true)}
        >
          <Search aria-hidden="true" />
        </Button>
        <NotificationPopover />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
