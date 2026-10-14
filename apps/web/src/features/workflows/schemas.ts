import { z } from "zod"
import type { WorkflowNodeData, WorkflowNodeKind } from "@/features/workflows/types"

const label = z.string().trim().min(2, "Enter at least 2 characters.").max(48, "Use 48 characters or fewer.")

function httpUrl(message: string) {
  return z.string().trim().refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === "http:" || url.protocol === "https:"
    } catch {
      return false
    }
  }, message)
}

const schemas: Record<WorkflowNodeKind, z.ZodType> = {
  trigger: z.object({
    label,
    event: z.string().trim().min(2, "Name the event that starts this workflow.").max(64, "Use 64 characters or fewer."),
  }),
  browser: z.object({
    label,
    url: httpUrl("Enter an http or https URL."),
    action: z.enum(["navigate", "click", "type"], { error: "Choose a browser action." }),
  }),
  api: z.object({
    label,
    url: httpUrl("Enter an http or https URL."),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"], { error: "Choose an HTTP method." }),
  }),
  model: z.object({
    label,
    model: z.string().trim().min(2, "Name the model.").max(48, "Use 48 characters or fewer."),
    prompt: z.string().trim().min(8, "Write a prompt of at least 8 characters.").max(500, "Use 500 characters or fewer."),
  }),
  condition: z.object({
    label,
    expression: z.string().trim().min(2, "Enter a condition.").max(160, "Use 160 characters or fewer."),
  }),
  delay: z.object({
    label,
    durationMs: z.number({ error: "Enter a delay in milliseconds." }).int().min(100, "Delay must be at least 100 ms.").max(300000, "Delay must be 5 minutes or less."),
  }),
  approval: z.object({
    label,
    assignee: z.string().trim().min(2, "Name the approver.").max(48, "Use 48 characters or fewer."),
    prompt: z.string().trim().min(8, "Tell the approver what to review.").max(280, "Use 280 characters or fewer."),
  }),
  output: z.object({
    label,
  }),
}

export function nodeSchema(kind: WorkflowNodeKind) {
  return schemas[kind] as z.ZodType<WorkflowNodeData, WorkflowNodeData>
}

export const workflowMetaSchema = z.object({
  name: z.string().trim().min(2, "Enter a workflow name.").max(64, "Use 64 characters or fewer."),
  description: z.string().trim().max(280, "Use 280 characters or fewer."),
})
