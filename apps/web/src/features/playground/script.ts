import { estimatedCost } from "@/features/playground/catalog"
import type { PlaygroundConfig, SimulatedTurn } from "@/features/playground/types"

function tokensFor(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return Math.max(1, Math.round(trimmed.length / 4))
}

function clip(text: string, maxTokens: number) {
  const maxChars = Math.max(16, maxTokens * 4)
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars).trimEnd()}…`
}

export function buildSimulatedTurn(message: string, config: PlaygroundConfig): SimulatedTurn {
  const asksForSecrets = /(api[_ -]?key|secret|password|credential)/i.test(message)
  const wantsTool = /\b(search|tool)\b/i.test(message)
  const temperatureNote =
    config.temperature >= 1
      ? " A higher temperature setting selected the longer mock variant."
      : config.temperature < 0.4
        ? " A low temperature setting kept the mock variant short."
        : ""
  const quoted = message.trim().slice(0, 180)
  const refusal =
    config.guardrails.refuseSecrets && asksForSecrets
      ? "The simulated guardrail refused to repeat credential-shaped text."
      : `Your message was: “${quoted}”.`
  const retrieval = config.retrieval ? " Retrieved one grounded excerpt from the workspace handbook." : ""
  const promptNote = config.systemPrompt.trim()
    ? " The system prompt was stored as configuration and was not sent to a live model."
    : ""
  const content = clip(
    `Simulated response from ${config.model}. This text was produced by the mock LLM gateway, not a live provider.${promptNote}${retrieval}${temperatureNote} ${refusal}`,
    config.maxTokens,
  )
  const tools = wantsTool || config.retrieval
    ? [
        {
          id: "tool_workspace_lookup",
          name: "workspace.lookup",
          status: "succeeded" as const,
          input: { query: quoted.slice(0, 80) || "workspace" },
          output: "Simulated tool result. No external system was called.",
        },
      ]
    : []
  const citations =
    config.retrieval
      ? [
          {
            id: "cite_handbook_1",
            document: "Workspace handbook",
            chunkId: "chunk_handbook_1",
            score: 0.86,
            excerpt: "Simulated excerpt. Mission Control records stay in the workspace store.",
          },
        ]
      : []
  const promptTokens = tokensFor(`${config.systemPrompt}\n${message}`)
  const completionTokens = tokensFor(content)

  return {
    content,
    tools,
    citations,
    latencyMs: 180 + (message.length % 17) * 12,
    usage: {
      promptTokens,
      completionTokens,
      estimatedCost: estimatedCost(promptTokens + completionTokens, config.model),
    },
  }
}

export function streamChunks(text: string) {
  return text.split(/(\s+)/).filter((part) => part.length > 0)
}
