"use client"

import { createContext, useContext } from "react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { GitBranch, Globe, Flag, Sparkles, Timer, UserCheck, Webhook, Zap } from "lucide-react"
import type { NodeRunStatus, WorkflowNodeData, WorkflowNodeKind } from "@/features/workflows/types"

export type FlowNode = Node<WorkflowNodeData, WorkflowNodeKind>

export const WorkflowRunContext = createContext<{
  status: Record<string, NodeRunStatus>
  reduced: boolean
}>({ status: {}, reduced: false })

const icons = {
  trigger: Zap,
  browser: Globe,
  api: Webhook,
  model: Sparkles,
  condition: GitBranch,
  delay: Timer,
  approval: UserCheck,
  output: Flag,
} as const

export function WorkflowNodeView({ id, data, type, selected }: NodeProps<FlowNode>) {
  const run = useContext(WorkflowRunContext)
  const kind = (type ?? "output") as WorkflowNodeKind
  const status = run.status[id] ?? "idle"
  const Icon = icons[kind]
  const tone =
    status === "failed"
      ? "bg-destructive"
      : status === "succeeded"
        ? "bg-emerald-500"
        : status === "running"
          ? "bg-highlight"
          : "bg-border"

  return (
    <div
      aria-label={`${data.label}, ${status}`}
      className={[
        "w-[200px] rounded-xl bg-card px-3 py-2.5 text-card-foreground shadow-sm ring-1",
        selected ? "ring-primary" : "ring-foreground/10",
        status === "running" && !run.reduced ? "motion-safe:animate-pulse" : "",
      ].join(" ")}
    >
      <span className={`absolute top-2 bottom-2 left-0 w-1 rounded-full ${tone}`} aria-hidden="true" />
      {kind !== "trigger" ? <Handle type="target" position={Position.Left} /> : null}
      <div className="flex items-center gap-2 pl-1">
        <Icon aria-hidden="true" className="size-4 text-primary" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{data.label}</p>
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{kind === "api" ? "API request" : kind === "model" ? "AI model" : kind}</p>
        </div>
      </div>
      {kind === "condition" ? (
        <>
          <span className="absolute top-[30%] right-4 text-[10px] text-highlight">True</span>
          <span className="absolute top-[62%] right-4 text-[10px] text-muted-foreground">False</span>
          <Handle id="true" type="source" position={Position.Right} style={{ top: "38%" }} />
          <Handle id="false" type="source" position={Position.Right} style={{ top: "70%" }} />
        </>
      ) : null}
      {kind !== "condition" && kind !== "output" ? <Handle type="source" position={Position.Right} /> : null}
    </div>
  )
}
