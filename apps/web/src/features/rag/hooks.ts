"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { listKnowledgeBases } from "@/features/knowledge/api"
import { KNOWLEDGE_PAGE_SIZE } from "@/features/knowledge/catalog"
import type { KnowledgeBase } from "@/features/knowledge/types"
import { getRagConfiguration, retrieve } from "@/features/rag/api"
import type { RetrievalRequest } from "@/features/rag/types"
import { localWorkspace } from "@/lib/workspace"

export const ragKeys = {
  all: ["rag"] as const,
  configuration: (workspaceId: string) => ["rag", "configuration", workspaceId] as const,
  bases: (workspaceId: string) => ["rag", "bases", workspaceId] as const,
}

async function listWorkspaceBases(workspaceId: string) {
  const first = await listKnowledgeBases({
    workspaceId,
    q: "",
    status: "all",
    model: "all",
    sort: "name",
    page: 1,
  })
  const pages = Math.max(1, Math.ceil(first.total / KNOWLEDGE_PAGE_SIZE))
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      listKnowledgeBases({
        workspaceId,
        q: "",
        status: "all",
        model: "all",
        sort: "name",
        page: index + 2,
      }),
    ),
  )
  return [first, ...rest].flatMap((page) => page.items)
}

export function useRagBases() {
  return useQuery({
    queryKey: ragKeys.bases(localWorkspace.id),
    queryFn: () => listWorkspaceBases(localWorkspace.id),
  })
}

export function useRagConfiguration() {
  return useQuery({
    queryKey: ragKeys.configuration(localWorkspace.id),
    queryFn: () => getRagConfiguration(localWorkspace.id),
  })
}

export function useRetrieve() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: RetrievalRequest) => retrieve(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ragKeys.configuration(localWorkspace.id) }),
  })
}

export type { KnowledgeBase }
