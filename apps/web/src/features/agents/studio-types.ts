import type { RetryPolicy } from "@/features/dashboard/types"
import type { RetrievalStrategy } from "@/features/rag/types"

export type AgentModelProvider = "agentflow-simulated" | "northstar-simulated"
export type AgentToolCallingMode = "auto" | "required" | "none"
export type AgentMemoryMode = "stateless" | "conversation" | "short_term" | "long_term"
export type AgentToolCategory =
  | "http_api"
  | "knowledge_search"
  | "document_retrieval"
  | "calculator"
  | "structured_extraction"
  | "notification"
  | "human_approval"
export type AgentToolPermission = "read" | "side_effect"

export type AgentModelSettings = {
  provider: AgentModelProvider
  model: string
  systemPrompt: string
  temperature: number
  maxOutputTokens: number
  toolCalling: AgentToolCallingMode
  structuredOutput: boolean
  outputSchema: Record<string, unknown> | null
}

export type AgentExecutionPolicy = {
  retryPolicy: RetryPolicy
  timeoutMs: number
  budgetUsd: number
  maxSteps: number
  maxToolCalls: number
  maxDurationMs: number
  maxTokenBudget: number
}

export type AgentKnowledgeBinding = {
  knowledgeBaseId: string
  strategy: RetrievalStrategy
  topK: number
  scoreThreshold: number
  rerank: boolean
  contextTokenBudget: number
  requireCitations: boolean
}

export type AgentToolDefinition = {
  id: string
  category: AgentToolCategory
  name: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  timeoutMs: number
  retryPolicy: RetryPolicy
  permission: AgentToolPermission
  requiresApproval: boolean
  enabled: boolean
}

export type AgentMemorySettings = {
  mode: AgentMemoryMode
  retentionDays: number
}

export type AgentGuardrailPolicy = {
  validateInput: boolean
  validateOutput: boolean
  maskSensitiveData: boolean
  enforceToolPermissions: boolean
  requireHumanApproval: boolean
  allowedToolIds: string[]
}

export type AgentConfiguration = {
  model: AgentModelSettings
  execution: AgentExecutionPolicy
  knowledge: AgentKnowledgeBinding[]
  tools: AgentToolDefinition[]
  memory: AgentMemorySettings
  guardrails: AgentGuardrailPolicy
}

/** Published snapshot. The object is not edited in place. */
export type AgentVersionSnapshot = {
  version: string
  publishedAt: string
  note: string
  configuration: AgentConfiguration
  immutable: true
}

export type AgentStudioRecord = {
  simulated: true
  workspaceId: string
  agentId: string
  draft: AgentConfiguration
  publishedVersion: string | null
  versions: AgentVersionSnapshot[]
  warnings: string[]
}

export type AgentPublishRequest = {
  workspaceId: string
  version: string
  note: string
}

export type AgentRollbackRequest = {
  workspaceId: string
  version: string
}

export type AgentTestRequest = {
  workspaceId: string
  /** `draft` or a published version. */
  version: string
  input: string
}

export type AgentExecutionStep = {
  id: string
  index: number
  kind: "validate" | "retrieve" | "tool" | "respond" | "limit" | "error"
  title: string
  detail: string
  durationMs: number
  tokens: number
  toolId?: string
  chunkIds?: string[]
}

export type AgentTestResponse = {
  simulated: true
  requestId: string
  workspaceId: string
  agentId: string
  version: string
  status: "completed" | "failed" | "limited"
  steps: AgentExecutionStep[]
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  latencyMs: number
  estimatedCostUsd: number
  error: string | null
  notice: string
}
