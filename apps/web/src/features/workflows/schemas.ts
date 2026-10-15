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
  llm: z.object({
    label,
    provider: z.string().trim().min(2, "Choose a provider."),
    model: z.string().trim().min(2, "Choose a model."),
    promptTemplate: z.string().trim().min(8, "Write a prompt template of at least 8 characters.").max(2000, "Use 2000 characters or fewer."),
    temperature: z.number({ error: "Enter a temperature." }).min(0, "Temperature must be at least 0.").max(2, "Temperature must be 2 or less."),
    maxOutputTokens: z.number({ error: "Enter a token limit." }).int().min(1, "Allow at least 1 output token.").max(4096, "Use 4096 output tokens or fewer."),
    timeoutMs: z.number({ error: "Enter a timeout." }).int().min(1000, "Timeout must be at least 1 second.").max(300000, "Timeout must be 5 minutes or less."),
    budgetUsd: z.number({ error: "Enter a budget." }).min(0, "Budget cannot be negative.").max(100, "Budget must be 100 USD or less."),
  }),
  rag: z.object({
    label,
    knowledgeBaseId: z.string().trim().min(1, "Choose a knowledge base."),
    strategy: z.enum(["vector", "keyword", "hybrid"], { error: "Choose a retrieval strategy." }),
    topK: z.number({ error: "Enter a top K." }).int().min(1, "Top K must be at least 1.").max(20, "Top K must be 20 or less."),
    scoreThreshold: z.number({ error: "Enter a score threshold." }).min(0, "Threshold must be at least 0.").max(1, "Threshold must be 1 or less."),
    contextTokenBudget: z.number({ error: "Enter a context budget." }).int().min(64, "Context budget must be at least 64.").max(8192, "Context budget must be 8192 or less."),
  }),
  ingestion: z.object({
    label,
    knowledgeBaseId: z.string().trim().min(1, "Choose a knowledge base."),
    documentRef: z.string().trim().min(1, "Name the document input.").max(160, "Use 160 characters or fewer."),
    processingPolicy: z.enum(["parse", "parse_and_index"], { error: "Choose a processing policy." }),
  }),
  embedding: z.object({
    label,
    embeddingModel: z.enum(["orbit-embed-small", "orbit-embed-large"], { error: "Choose an embedding model." }),
    textInput: z.string().trim().min(2, "Name the text input.").max(500, "Use 500 characters or fewer."),
    batchSize: z.number({ error: "Enter a batch size." }).int().min(1, "Batch size must be at least 1.").max(32, "Batch size must be 32 or less."),
  }),
  tool: z.object({
    label,
    toolId: z.string().trim().min(1, "Choose a tool."),
    inputMapping: z.string().trim().min(2, "Enter an input mapping.").max(500, "Use 500 characters or fewer."),
    timeoutMs: z.number({ error: "Enter a timeout." }).int().min(100, "Timeout must be at least 100 ms.").max(60000, "Timeout must be 60 seconds or less."),
    retryPolicy: z.enum(["none", "fixed", "exponential"], { error: "Choose a retry policy." }),
    retries: z.number({ error: "Enter a retry count." }).int().min(0, "Retries cannot be negative.").max(5, "Use 5 retries or fewer."),
  }),
  agent_execution: z.object({
    label,
    agentId: z.string().trim().min(1, "Choose an agent."),
    agentVersion: z.string().trim().min(1, "Choose a published agent version."),
    inputMapping: z.string().trim().min(2, "Enter an input mapping.").max(500, "Use 500 characters or fewer."),
    executionLimit: z.number({ error: "Enter an execution limit." }).int().min(1, "Allow at least 1 step.").max(20, "Use 20 steps or fewer."),
  }),
  human_approval: z.object({
    label,
    approverRole: z.string().trim().min(2, "Name the approver role.").max(48, "Use 48 characters or fewer."),
    approvalMessage: z.string().trim().min(8, "Write an approval message.").max(280, "Use 280 characters or fewer."),
    timeoutMs: z.number({ error: "Enter a timeout." }).int().min(1000, "Timeout must be at least 1 second.").max(300000, "Timeout must be 5 minutes or less."),
  }),
  structured_output: z.object({
    label,
    outputSchema: z.string().trim().min(2, "Enter a JSON schema.").refine((value) => {
      try {
        const parsed = JSON.parse(value) as unknown
        return Boolean(parsed) && typeof parsed === "object" && !Array.isArray(parsed)
      } catch {
        return false
      }
    }, "Enter a JSON object schema."),
    failurePolicy: z.enum(["fail", "branch"], { error: "Choose a failure policy." }),
  }),
}

export function nodeSchema(kind: WorkflowNodeKind) {
  return schemas[kind] as z.ZodType<WorkflowNodeData, WorkflowNodeData>
}

export const workflowMetaSchema = z.object({
  name: z.string().trim().min(2, "Enter a workflow name.").max(64, "Use 64 characters or fewer."),
  description: z.string().trim().max(280, "Use 280 characters or fewer."),
})
