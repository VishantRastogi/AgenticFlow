export type PlaygroundModel = {
  id: string
  provider: string
  label: string
  ratePer1k: number
}

export const playgroundModels: readonly PlaygroundModel[] = [
  { id: "orbit-small", provider: "AgentFlow Simulated", label: "Orbit Small", ratePer1k: 0.002 },
  { id: "orbit-large", provider: "AgentFlow Simulated", label: "Orbit Large", ratePer1k: 0.008 },
  { id: "orbit-code", provider: "AgentFlow Simulated", label: "Orbit Code", ratePer1k: 0.004 },
]

export function modelById(id: string) {
  return playgroundModels.find((model) => model.id === id) ?? playgroundModels[0]
}

export function estimatedCost(tokens: number, modelId: string) {
  const rate = modelById(modelId).ratePer1k
  return Math.round((tokens / 1000) * rate * 1_000_000) / 1_000_000
}

export function providers() {
  return [...new Set(playgroundModels.map((model) => model.provider))]
}
