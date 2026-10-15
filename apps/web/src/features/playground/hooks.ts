"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createPlaygroundConversation,
  deletePlaygroundConversation,
  getPlaygroundCatalog,
  getPlaygroundConversation,
  listPlaygroundConversations,
  savePlaygroundPreset,
} from "@/features/playground/api"
import type { PlaygroundConfig } from "@/features/playground/types"

export const playgroundKeys = {
  catalog: ["playground", "catalog"] as const,
  conversations: ["playground", "conversations"] as const,
  conversation: (id: string) => ["playground", "conversation", id] as const,
}

export function usePlaygroundCatalog() {
  return useQuery({ queryKey: playgroundKeys.catalog, queryFn: getPlaygroundCatalog })
}

export function usePlaygroundConversations() {
  return useQuery({ queryKey: playgroundKeys.conversations, queryFn: listPlaygroundConversations })
}

export function usePlaygroundConversation(id: string | null) {
  return useQuery({
    queryKey: playgroundKeys.conversation(id ?? "none"),
    queryFn: () => getPlaygroundConversation(id ?? ""),
    enabled: Boolean(id),
  })
}

export function useCreatePlaygroundConversation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: PlaygroundConfig & { title?: string }) => createPlaygroundConversation(input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: playgroundKeys.conversations })
    },
  })
}

export function useDeletePlaygroundConversation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePlaygroundConversation(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: playgroundKeys.conversations })
    },
  })
}

export function useSavePlaygroundPreset() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: savePlaygroundPreset,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: playgroundKeys.catalog })
    },
  })
}

export function useRefreshPlaygroundConversation() {
  const client = useQueryClient()
  return async (id: string) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: playgroundKeys.conversations }),
      client.invalidateQueries({ queryKey: playgroundKeys.conversation(id) }),
    ])
  }
}
