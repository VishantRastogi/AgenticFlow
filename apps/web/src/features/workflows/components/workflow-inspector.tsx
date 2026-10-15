"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { isStudioNode, StudioNodeFields } from "@/features/workflows/components/workflow-node-fields"
import { WorkflowStudioPanel } from "@/features/workflows/components/workflow-studio-panel"
import { nodeSchema } from "@/features/workflows/schemas"
import type { WorkflowGraph, WorkflowIssue, WorkflowNode, WorkflowNodeData } from "@/features/workflows/types"

const controlClass = "min-h-11 lg:min-h-8"

export function WorkflowInspector({
  node,
  description,
  issues,
  epoch,
  onDescription,
  onNodeChange,
  onSelect,
  workflowId,
  graph,
}: {
  node: WorkflowNode | null
  description: string
  issues: WorkflowIssue[]
  epoch: number
  onDescription: (value: string) => void
  onNodeChange: (id: string, data: WorkflowNodeData) => void
  onSelect: (id: string) => void
  workflowId?: string
  graph: WorkflowGraph
}) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Inspector</p>
        <h2 className="mt-1 text-base font-medium">{node ? node.data.label : "Workflow"}</h2>
      </div>
      {node ? (
        isStudioNode(node.type) ? (
          <StudioNodeFields key={`${node.id}:${epoch}`} node={node} onChange={onNodeChange} />
        ) : (
          <NodeFields key={`${node.id}:${epoch}`} node={node} onChange={onNodeChange} />
        )
      ) : (
        <label className="grid gap-1.5 text-sm font-medium">
          Description
          <Textarea className={controlClass} value={description} onChange={(event) => onDescription(event.target.value)} />
        </label>
      )}
      <section>
        <h3 className="text-sm font-medium">Validation</h3>
        {issues.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">This workflow is ready to publish.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {issues.map((issue) => (
              <li key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? issue.message}`}>
                {issue.nodeId ? (
                  <button type="button" className="min-h-11 w-full rounded-lg px-2 text-left text-sm text-destructive hover:bg-destructive/10 lg:min-h-8" onClick={() => onSelect(issue.nodeId ?? "")}>
                    {issue.message}
                  </button>
                ) : (
                  <p className="px-2 text-sm text-destructive">{issue.message}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {workflowId ? <WorkflowStudioPanel workflowId={workflowId} graph={graph} /> : null}
      <section className="text-xs leading-5 text-muted-foreground">
        <p>Drag a node onto the canvas or tap one to add it.</p>
        <p>Undo ⌘Z · Redo ⇧⌘Z · Duplicate ⌘D · Save ⌘S</p>
      </section>
    </div>
  )
}

function NodeFields({ node, onChange }: { node: WorkflowNode; onChange: (id: string, data: WorkflowNodeData) => void }) {
  const form = useForm<WorkflowNodeData>({
    resolver: zodResolver(nodeSchema(node.type)),
    defaultValues: node.data,
    mode: "onChange",
  })

  function commit() {
    const values = form.getValues()
    onChange(node.id, {
      label: values.label ?? "",
      event: values.event,
      url: values.url,
      action: values.action,
      method: values.method,
      model: values.model,
      prompt: values.prompt,
      expression: values.expression,
      durationMs: typeof values.durationMs === "number" && !Number.isNaN(values.durationMs) ? values.durationMs : node.data.durationMs,
      assignee: values.assignee,
    })
  }

  const error = form.formState.errors

  return (
    <form className="grid gap-3" onSubmit={(event) => event.preventDefault()} onChange={commit}>
      <Field label="Label" message={error.label?.message}>
        <Input className={controlClass} aria-invalid={Boolean(error.label)} {...form.register("label")} />
      </Field>
      {node.type === "trigger" ? (
        <Field label="Event" message={error.event?.message}>
          <Input className={controlClass} aria-invalid={Boolean(error.event)} {...form.register("event")} />
        </Field>
      ) : null}
      {node.type === "browser" || node.type === "api" ? (
        <Field label="URL" message={error.url?.message}>
          <Input className={controlClass} aria-invalid={Boolean(error.url)} {...form.register("url")} />
        </Field>
      ) : null}
      {node.type === "browser" ? (
        <Field label="Action" message={error.action?.message}>
          <select className={`${controlClass} w-full rounded-lg border border-input bg-background px-2.5 text-sm`} {...form.register("action")}>
            <option value="navigate">Navigate</option>
            <option value="click">Click</option>
            <option value="type">Type</option>
          </select>
        </Field>
      ) : null}
      {node.type === "api" ? (
        <Field label="Method" message={error.method?.message}>
          <select className={`${controlClass} w-full rounded-lg border border-input bg-background px-2.5 text-sm`} {...form.register("method")}>
            {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {node.type === "model" ? (
        <>
          <Field label="Model" message={error.model?.message}>
            <Input className={controlClass} aria-invalid={Boolean(error.model)} {...form.register("model")} />
          </Field>
          <Field label="Prompt" message={error.prompt?.message}>
            <Textarea className={controlClass} aria-invalid={Boolean(error.prompt)} {...form.register("prompt")} />
          </Field>
        </>
      ) : null}
      {node.type === "condition" ? (
        <Field label="Expression" message={error.expression?.message}>
          <Input className={controlClass} aria-invalid={Boolean(error.expression)} {...form.register("expression")} />
        </Field>
      ) : null}
      {node.type === "delay" ? (
        <Field label="Delay (ms)" message={error.durationMs?.message}>
          <Input className={controlClass} type="number" min={100} max={300000} aria-invalid={Boolean(error.durationMs)} {...form.register("durationMs", { valueAsNumber: true })} />
        </Field>
      ) : null}
      {node.type === "approval" ? (
        <>
          <Field label="Assignee" message={error.assignee?.message}>
            <Input className={controlClass} aria-invalid={Boolean(error.assignee)} {...form.register("assignee")} />
          </Field>
          <Field label="Prompt" message={error.prompt?.message}>
            <Textarea className={controlClass} aria-invalid={Boolean(error.prompt)} {...form.register("prompt")} />
          </Field>
        </>
      ) : null}
    </form>
  )
}

function Field({ label, message, children }: { label: string; message?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
      {message ? <span className="text-xs font-normal text-destructive">{message}</span> : null}
    </label>
  )
}
