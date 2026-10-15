"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { moduleSections, modules } from "@/lib/modules"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function NavLinks({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-4">
      {moduleSections.map((section) => (
        <div key={section.id} className="flex flex-col gap-0.5">
          <p className="sidebar-copy px-2.5 pb-1 text-xs font-medium text-muted-foreground">{section.title}</p>
          <ul className="flex flex-col gap-0.5">
            {section.keys.map((key) => {
              const item = modules[key]
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              const Icon = item.icon
              const link = (
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={cn(
                    "relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                  )}
                >
                  {active ? (
                    <span
                      className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-highlight"
                      aria-hidden="true"
                    />
                  ) : null}
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="sidebar-copy truncate">{item.title}</span>
                </Link>
              )

              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
