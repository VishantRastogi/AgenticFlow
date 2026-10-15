import { callContract } from "@/features/api/real-adapter"
import type { RagConfigurationResponse, RetrievalRequest, RetrievalResponse } from "@/features/rag/types"

export function getRagConfiguration(workspaceId: string) {
  return callContract<RagConfigurationResponse>("rag.configuration.get", { query: { workspaceId } })
}

export function saveRagConfiguration(input: RetrievalRequest) {
  return callContract<RagConfigurationResponse>("rag.configuration.save", {
    query: { workspaceId: input.workspaceId },
    body: input,
  })
}

export function retrieve(input: RetrievalRequest) {
  return callContract<RetrievalResponse>("rag.retrieve", {
    query: { workspaceId: input.workspaceId },
    body: input,
  })
}
