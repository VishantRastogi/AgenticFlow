"use client"

import { usePathname } from "next/navigation"
import { moduleList } from "@/lib/modules"

export function Breadcrumbs() {
  const pathname = usePathname()
  const current = moduleList()
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0]

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="shrink-0 text-muted-foreground">AgentFlow</li>
        <li aria-hidden="true" className="shrink-0 text-muted-foreground">
          /
        </li>
        <li className="truncate font-medium text-foreground" aria-current="page">
          {current?.title ?? "Mission Control"}
        </li>
      </ol>
    </nav>
  )
}
