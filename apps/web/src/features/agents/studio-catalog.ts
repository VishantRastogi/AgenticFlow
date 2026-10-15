import type {
  AgentConfiguration,
  AgentModelProvider,
  AgentToolCallingMode,
  AgentToolCategory,
  AgentToolDefinition,
  AgentToolPermission,
} from "@/features/agents/studio-types"

export type AgentModelCapability = {
  id: string
  provider: AgentModelProvider
  label: string
  providerLabel: string
  maxTemperature: number
  maxOutputTokens: number
  toolCalling: readonly AgentToolCallingMode[]
  structuredOutput: boolean
  ratePer1k: number
}

export const agentModels: readonly AgentModelCapability[] = [
  {
    id: "orbit-small",
    provider: "agentflow-simulated",
    providerLabel: "AgentFlow Simulated",
    label: "Orbit Small",
    maxTemperature: 1,
    maxOutputTokens: 1024,
    toolCalling: ["auto", "none"],
    structuredOutput: false,
    ratePer1k: 0.002,
  },
  {
    id: "orbit-large",
    provider: "agentflow-simulated",
    providerLabel: "AgentFlow Simulated",
    label: "Orbit Large",
    maxTemperature: 2,
    maxOutputTokens: 4096,
    toolCalling: ["auto", "required", "none"],
    structuredOutput: true,
    ratePer1k: 0.008,
  },
  {
    id: "orbit-code",
    provider: "agentflow-simulated",
    providerLabel: "AgentFlow Simulated",
    label: "Orbit Code",
    maxTemperature: 1,
    maxOutputTokens: 2048,
    toolCalling: ["none"],
    structuredOutput: false,
    ratePer1k: 0.004,
  },
  {
    id: "northstar-chat",
    provider: "northstar-simulated",
    providerLabel: "Northstar Simulated",
    label: "Northstar Chat",
    maxTemperature: 0.7,
    maxOutputTokens: 512,
    toolCalling: ["none"],
    structuredOutput: false,
    ratePer1k: 0.003,
  },
]

export function agentModel(id: string) {
  return agentModels.find((model) => model.id === id) ?? null
}

export function modelsForProvider(provider: AgentModelProvider) {
  return agentModels.filter((model) => model.provider === provider)
}

const schema = (title: string) => ({ type: "object", title, properties: {} })

function tool(
  category: AgentToolCategory,
  name: string,
  description: string,
  permission: AgentToolPermission,
  enabled: boolean,
): AgentToolDefinition {
  return {
    id: category,
    category,
    name,
    description,
    inputSchema: schema(`${name} input`),
    outputSchema: schema(`${name} output`),
    timeoutMs: 5000,
    retryPolicy: "none",
    permission,
    requiresApproval: permission === "side_effect",
    enabled,
  }
}

export const toolCatalog: readonly AgentToolDefinition[] = [
  tool("calculator", "Calculator", "Read-only arithmetic over the supplied JSON input.", "read", true),
  tool("knowledge_search", "Knowledge search", "Read-only search over attached knowledge bases.", "read", false),
  tool("document_retrieval", "Document retrieval", "Read-only fetch of a ready document chunk.", "read", false),
  tool("structured_extraction", "Structured extraction", "Read-only mapping of text into the output schema.", "read", false),
  tool("http_api", "HTTP API", "External HTTP call. The browser does not store credentials or send the request.", "side_effect", false),
  tool("notification", "Notification", "External notification. Delivery stays in the runtime.", "side_effect", false),
  tool("human_approval", "Human approval", "Pauses for a person. The studio does not grant approval.", "side_effect", false),
]

export function defaultAgentConfiguration(): AgentConfiguration {
  return {
    model: {
      provider: "agentflow-simulated",
      model: "orbit-small",
      systemPrompt: "You are a simulated AgentFlow agent. Do not claim live model output.",
      temperature: 0.2,
      maxOutputTokens: 400,
      toolCalling: "auto",
      structuredOutput: false,
      outputSchema: null,
    },
    execution: {
      retryPolicy: "fixed",
      timeoutMs: 30000,
      budgetUsd: 1,
      maxSteps: 8,
      maxToolCalls: 3,
      maxDurationMs: 30000,
      maxTokenBudget: 4000,
    },
    knowledge: [],
    tools: toolCatalog.map((item) => structuredClone(item)),
    memory: { mode: "stateless", retentionDays: 0 },
    guardrails: {
      validateInput: true,
      validateOutput: true,
      maskSensitiveData: true,
      enforceToolPermissions: true,
      requireHumanApproval: true,
      allowedToolIds: ["calculator"],
    },
  }
}
