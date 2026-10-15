export type GuardrailSettings = {
  refuseSecrets: boolean
  citeSources: boolean
}

export type PlaygroundToolCall = {
  id: string
  name: string
  status: "succeeded"
  input: Record<string, string>
  output: string
}

export type PlaygroundCitation = {
  id: string
  document: string
  chunkId: string
  score: number
  excerpt: string
}

export type PlaygroundUsage = {
  promptTokens: number
  completionTokens: number
  estimatedCost: number
}

export type PlaygroundMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
  simulated: boolean
  status: "complete" | "stopped"
  model?: string
  usage?: PlaygroundUsage
  latencyMs?: number
  tools?: PlaygroundToolCall[]
  citations?: PlaygroundCitation[]
}

export type PlaygroundConversation = {
  id: string
  title: string
  updatedAt: string
  systemPrompt: string
  provider: string
  model: string
  temperature: number
  maxTokens: number
  retrieval: boolean
  guardrails: GuardrailSettings
  messages: PlaygroundMessage[]
}

export type PlaygroundPreset = {
  id: string
  name: string
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
  retrieval: boolean
}

export type PlaygroundConfig = {
  systemPrompt: string
  provider: string
  model: string
  temperature: number
  maxTokens: number
  retrieval: boolean
  guardrails: GuardrailSettings
}

export type SimulatedTurn = {
  content: string
  tools: PlaygroundToolCall[]
  citations: PlaygroundCitation[]
  usage: PlaygroundUsage
  latencyMs: number
}
