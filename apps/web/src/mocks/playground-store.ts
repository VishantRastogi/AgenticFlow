import { playgroundModels } from "@/features/playground/catalog"
import { buildSimulatedTurn, streamChunks } from "@/features/playground/script"
import type {
  PlaygroundConfig,
  PlaygroundConversation,
  PlaygroundMessage,
  PlaygroundPreset,
  SimulatedTurn,
} from "@/features/playground/types"
import { SIMULATED_NOW } from "@/mocks/fixtures/operations"

const STORAGE_KEY = "agentflow-mock-playground"

type Generation = {
  id: string
  conversationId: string
  turn: SimulatedTurn
  status: "running" | "complete" | "stopped"
}

type Database = {
  sequence: number
  conversations: PlaygroundConversation[]
  presets: PlaygroundPreset[]
}

const generations = new Map<string, Generation>()

const seedPresets = (): PlaygroundPreset[] => [
  {
    id: "preset_support",
    name: "Support reply",
    systemPrompt: "Answer as a workspace operator. Stay concise.",
    model: "orbit-small",
    temperature: 0.2,
    maxTokens: 400,
    retrieval: false,
  },
  {
    id: "preset_retrieval",
    name: "Retrieval answer",
    systemPrompt: "Use the attached handbook excerpt when retrieval is enabled.",
    model: "orbit-large",
    temperature: 0.4,
    maxTokens: 600,
    retrieval: true,
  },
]

function emptyDatabase(): Database {
  return { sequence: 1, conversations: [], presets: seedPresets() }
}

function readDatabase(): Database {
  if (typeof localStorage === "undefined") return emptyDatabase()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const seeded = emptyDatabase()
    writeDatabase(seeded)
    return seeded
  }
  try {
    const parsed = JSON.parse(raw) as Database
    if (!Array.isArray(parsed.conversations) || !Array.isArray(parsed.presets) || typeof parsed.sequence !== "number") {
      const seeded = emptyDatabase()
      writeDatabase(seeded)
      return seeded
    }
    return parsed
  } catch {
    const seeded = emptyDatabase()
    writeDatabase(seeded)
    return seeded
  }
}

function writeDatabase(database: Database) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database))
}

function stamp(sequence: number) {
  return new Date(Date.parse(SIMULATED_NOW) - (200 - sequence) * 1000).toISOString()
}

function nextId(database: Database, prefix: string) {
  const id = `${prefix}_${database.sequence}`
  database.sequence += 1
  return id
}

export function playgroundCatalog() {
  return {
    simulated: true as const,
    models: playgroundModels,
    presets: readDatabase().presets,
  }
}

export function listPlaygroundConversations() {
  const conversations = readDatabase().conversations
  return {
    simulated: true as const,
    conversations: [...conversations].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  }
}

export function getPlaygroundConversation(id: string) {
  return readDatabase().conversations.find((conversation) => conversation.id === id) ?? null
}

export function createPlaygroundConversation(input: PlaygroundConfig & { title?: string }) {
  const database = readDatabase()
  const id = nextId(database, "cnv")
  const conversation: PlaygroundConversation = {
    id,
    title: input.title?.trim() || "New conversation",
    updatedAt: stamp(database.sequence),
    systemPrompt: input.systemPrompt,
    provider: input.provider,
    model: input.model,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    retrieval: input.retrieval,
    guardrails: input.guardrails,
    messages: [],
  }
  database.conversations.push(conversation)
  writeDatabase(database)
  return conversation
}

export function deletePlaygroundConversation(id: string) {
  const database = readDatabase()
  const next = database.conversations.filter((conversation) => conversation.id !== id)
  if (next.length === database.conversations.length) return false
  database.conversations = next
  writeDatabase(database)
  return true
}

export function savePlaygroundPreset(input: Omit<PlaygroundPreset, "id">) {
  const database = readDatabase()
  const preset: PlaygroundPreset = { ...input, id: nextId(database, "preset") }
  database.presets.push(preset)
  writeDatabase(database)
  return preset
}

export function startPlaygroundGeneration(input: PlaygroundConfig & { conversationId?: string; message: string }) {
  const message = input.message.trim()
  if (!message) return { error: "validation" as const }
  if (/\brate limit\b/i.test(message)) return { error: "rate_limited" as const }
  if (/\bfail this run\b/i.test(message)) return { error: "provider" as const }

  const conversationId =
    input.conversationId ??
    createPlaygroundConversation({ ...input, title: message.slice(0, 48) }).id
  const database = readDatabase()
  const conversation = database.conversations.find((item) => item.id === conversationId)
  if (!conversation) return { error: "missing" as const }

  const userMessage: PlaygroundMessage = {
    id: nextId(database, "msg"),
    role: "user",
    content: message,
    createdAt: stamp(database.sequence),
    simulated: false,
    status: "complete",
  }
  conversation.messages.push(userMessage)
  conversation.title = conversation.messages.length === 1 ? message.slice(0, 48) : conversation.title
  conversation.systemPrompt = input.systemPrompt
  conversation.provider = input.provider
  conversation.model = input.model
  conversation.temperature = input.temperature
  conversation.maxTokens = input.maxTokens
  conversation.retrieval = input.retrieval
  conversation.guardrails = input.guardrails
  conversation.updatedAt = stamp(database.sequence)
  const generationId = nextId(database, "gen")
  generations.set(generationId, {
    id: generationId,
    conversationId: conversation.id,
    status: "running",
    turn: buildSimulatedTurn(message, input),
  })
  writeDatabase(database)
  return { generationId, conversation }
}

export function generationChunks(id: string) {
  const generation = generations.get(id)
  if (!generation || generation.status !== "running") return null
  return {
    generation,
    chunks: streamChunks(generation.turn.content),
  }
}

export function completePlaygroundGeneration(id: string) {
  const generation = generations.get(id)
  if (!generation || generation.status !== "running") return null
  const database = readDatabase()
  const conversation = database.conversations.find((item) => item.id === generation.conversationId)
  if (!conversation) return null
  const message: PlaygroundMessage = {
    id: nextId(database, "msg"),
    role: "assistant",
    content: generation.turn.content,
    createdAt: stamp(database.sequence),
    simulated: true,
    status: "complete",
    model: conversation.model,
    usage: generation.turn.usage,
    latencyMs: generation.turn.latencyMs,
    tools: generation.turn.tools,
    citations: generation.turn.citations,
  }
  conversation.messages.push(message)
  conversation.updatedAt = message.createdAt
  generation.status = "complete"
  writeDatabase(database)
  return { conversation, message }
}

export function cancelPlaygroundGeneration(id: string, partial: string) {
  const generation = generations.get(id)
  if (!generation) return null
  if (generation.status === "complete") {
    const conversation = getPlaygroundConversation(generation.conversationId)
    return conversation ? { conversation, alreadyComplete: true as const } : null
  }
  const database = readDatabase()
  const conversation = database.conversations.find((item) => item.id === generation.conversationId)
  if (!conversation) return null
  const content = partial.trim() || "Generation stopped before the mock gateway emitted text."
  const message: PlaygroundMessage = {
    id: nextId(database, "msg"),
    role: "assistant",
    content,
    createdAt: stamp(database.sequence),
    simulated: true,
    status: "stopped",
    model: conversation.model,
  }
  conversation.messages.push(message)
  conversation.updatedAt = message.createdAt
  generation.status = "stopped"
  writeDatabase(database)
  return { conversation, alreadyComplete: false as const }
}
