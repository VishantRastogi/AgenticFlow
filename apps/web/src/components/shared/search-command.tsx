"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { moduleSections, modules } from "@/lib/modules"
import { useUiStore } from "@/stores/ui-store"

export function SearchCommand() {
  const router = useRouter()
  const { setTheme } = useTheme()
  const open = useUiStore((state) => state.commandOpen)
  const setOpen = useUiStore((state) => state.setCommandOpen)
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen(!useUiStore.getState().commandOpen)
        return
      }

      if (!typing && event.key === "[" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [setOpen, toggleSidebar])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Search views, theme, and sidebar commands."
    >
      <Command>
        <CommandInput placeholder="Search views and commands" />
        <CommandList>
          <CommandEmpty>No matching commands.</CommandEmpty>
          {moduleSections.map((section) => (
            <CommandGroup key={section.id} heading={section.title}>
              {section.keys.map((key) => {
                const item = modules[key]
                const Icon = item.icon
                return (
                  <CommandItem
                    key={item.href}
                    value={`${item.title} ${item.keywords}`}
                    onSelect={() => go(item.href)}
                  >
                    <Icon aria-hidden="true" />
                    {item.title}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Appearance">
            <CommandItem value="theme light" onSelect={() => { setTheme("light"); setOpen(false) }}>
              Light theme
            </CommandItem>
            <CommandItem value="theme dark" onSelect={() => { setTheme("dark"); setOpen(false) }}>
              Dark theme
            </CommandItem>
            <CommandItem value="theme system" onSelect={() => { setTheme("system"); setOpen(false) }}>
              System theme
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Sidebar">
            <CommandItem
              value={collapsed ? "expand sidebar" : "collapse sidebar"}
              onSelect={() => {
                toggleSidebar()
                setOpen(false)
              }}
            >
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
