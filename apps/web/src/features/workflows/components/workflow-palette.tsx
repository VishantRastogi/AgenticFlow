"use client"

import { useRef } from "react"
import { GitBranch, Globe, Flag, Sparkles, Timer, UserCheck, Webhook, Zap, type LucideIcon } from "lucide-react"
import type { WorkflowNodeKind } from "@/features/workflows/types"

const items: { kind: WorkflowNodeKind; title: string; detail: string; icon: LucideIcon }[] = [
  { kind: "trigger", title: "Trigger", detail: "Start", icon: Zap },
  { kind: "browser", title: "Browser Action", detail: "Page", icon: Globe },
  { kind: "api", title: "API Request", detail: "HTTP", icon: Webhook },
  { kind: "model", title: "AI Model", detail: "Prompt", icon: Sparkles },
  { kind: "condition", title: "Condition", detail: "Branch", icon: GitBranch },
  { kind: "delay", title: "Delay", detail: "Wait", icon: Timer },
  { kind: "approval", title: "Human Approval", detail: "Review", icon: UserCheck },
  { kind: "output", title: "Output", detail: "Result", icon: Flag },
]

export function WorkflowPalette({ onAdd }: { onAdd: (kind: WorkflowNodeKind) => void }) {
  const dragged = useRef(false)

  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Nodes</p>
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.kind}
            type="button"
            draggable
            onDragStart={(event) => {
              dragged.current = true
              event.dataTransfer.setData("application/agentflow-node", item.kind)
              event.dataTransfer.effectAllowed = "move"
            }}
            onDragEnd={() => {
              window.setTimeout(() => {
                dragged.current = false
              }, 0)
            }}
            onClick={() => {
              if (dragged.current) return
              onAdd(item.kind)
            }}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-card px-2.5 text-left ring-1 ring-foreground/10 hover:ring-primary/50"
          >
            <Icon aria-hidden="true" className="size-4 text-primary" />
            <span>
              <span className="block text-sm font-medium">{item.title}</span>
              <span className="block text-[11px] text-muted-foreground">{item.detail}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function isNodeKind(value: string): value is WorkflowNodeKind {
  return items.some((item) => item.kind === value)
}
