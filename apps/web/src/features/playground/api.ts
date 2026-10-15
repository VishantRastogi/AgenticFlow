import { callContract, openContractStream } from "@/features/api/real-adapter"
import type {
  PlaygroundConfig,
  PlaygroundConversation,
  PlaygroundPreset,
} from "@/features/playground/types"
import type { PlaygroundModel } from "@/features/playground/catalog"

export type PlaygroundCatalog = {
  simulated: true
  models: readonly PlaygroundModel[]
  presets: PlaygroundPreset[]
}

export function getPlaygroundCatalog() {
  return callContract<PlaygroundCatalog>("playground.catalog")
}

export function listPlaygroundConversations() {
  return callContract<{ simulated: true; conversations: PlaygroundConversation[] }>("playground.conversations.list")
}

export function getPlaygroundConversation(id: string) {
  return callContract<{ simulated: true; conversation: PlaygroundConversation }>("playground.conversations.get", {
    params: { id },
  })
}

export function createPlaygroundConversation(input: PlaygroundConfig & { title?: string }) {
  return callContract<{ simulated: true; conversation: PlaygroundConversation }>("playground.conversations.create", {
    body: input,
  })
}

export function deletePlaygroundConversation(id: string) {
  return callContract<void>("playground.conversations.delete", { params: { id } })
}

export function savePlaygroundPreset(input: Omit<PlaygroundPreset, "id">) {
  return callContract<{ simulated: true; preset: PlaygroundPreset }>("playground.presets.save", { body: input })
}

export function startPlaygroundGeneration(input: PlaygroundConfig & { conversationId?: string; message: string }) {
  return callContract<{ simulated: true; generationId: string; conversation: PlaygroundConversation }>(
    "playground.generate",
    { body: input },
  )
}

export function cancelPlaygroundGeneration(id: string, content: string) {
  return callContract<{ simulated: true; conversation: PlaygroundConversation }>("playground.cancel", {
    params: { id },
    body: { content },
  })
}

export function openPlaygroundStream(id: string, signal: AbortSignal) {
  return openContractStream("playground.stream", { params: { id } }, signal)
}
