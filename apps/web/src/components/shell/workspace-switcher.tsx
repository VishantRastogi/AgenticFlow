"use client"

import { Check, ChevronsUpDown } from "lucide-react"
import { localWorkspace } from "@/lib/workspace"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={`Workspace: ${localWorkspace.name}`}
          className={cn(
            "h-10 w-full border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent/60",
            collapsed ? "justify-center px-0" : "justify-between px-2.5",
          )}
        >
          <span className={cn("min-w-0 text-left", collapsed && "sr-only")}>
            <span className="block truncate text-sm font-medium">{localWorkspace.name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {localWorkspace.status}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        <DropdownMenuItem aria-current="true">
          <Check aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span>{localWorkspace.name}</span>
            <span className="text-xs text-muted-foreground">{localWorkspace.status}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          Other workspaces are unavailable until workspace services are connected.
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
