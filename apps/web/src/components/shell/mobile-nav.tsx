"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { BrandMark } from "@/components/shell/brand-mark"
import { NavLinks } from "@/components/shell/nav-links"
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useUiStore } from "@/stores/ui-store"

export function MobileNav() {
  const pathname = usePathname()
  const open = useUiStore((state) => state.mobileNavOpen)
  const setOpen = useUiStore((state) => state.setMobileNavOpen)

  useEffect(() => {
    setOpen(false)
  }, [pathname, setOpen])

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden="true" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[min(100vw-2rem,18rem)] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-none"
        >
          <SheetHeader className="border-b border-sidebar-border px-3 py-3">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">
              Primary navigation for AgentFlow Mission Control.
            </SheetDescription>
            <Link href="/overview" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
              <BrandMark />
              <span>
                <span className="block text-sm font-semibold tracking-tight">AgentFlow</span>
                <span className="block text-xs font-normal text-muted-foreground">Mission Control</span>
              </span>
            </Link>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-2.5 py-3">
            <WorkspaceSwitcher />
            <nav aria-label="Mobile">
              <NavLinks onNavigate={() => setOpen(false)} />
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
