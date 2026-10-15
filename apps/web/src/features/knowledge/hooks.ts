"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { isApiError } from "@/features/auth/api/errors"
import {
  cancelIngestionJob,
  createKnowledgeBase,
  deleteDocument,
  deleteKnowledgeBase,
  getDocument,
  getKnowledgeBase,
  listDocuments,
  listKnowledgeBases,
  reindexKnowledgeBase,
  retryDocument,
  updateKnowledgeBase,
  uploadDocument,
} from "@/features/knowledge/api"
import type {
  DocumentListParams,
  DocumentUploadRequest,
  KnowledgeBaseCreateRequest,
  KnowledgeBaseUpdateRequest,
  KnowledgeListParams,
} from "@/features/knowledge/types"
import { localWorkspace } from "@/lib/workspace"

export const knowledgeKeys = {
  all: ["knowledge"] as const,
  list: (params: KnowledgeListParams) => ["knowledge", "list", params] as const,
  detail: (id: string) => ["knowledge", "detail", id] as const,
  documents: (id: string, params: DocumentListParams) => ["knowledge", "documents", id, params] as const,
  document: (baseId: string, documentId: string) => ["knowledge", "document", baseId, documentId] as const,
}

function refreshKnowledge(client: ReturnType<typeof useQueryClient>) {
  return client.invalidateQueries({ queryKey: knowledgeKeys.all })
}

export function useKnowledgeList(params: Omit<KnowledgeListParams, "workspaceId">) {
  const full = { ...params, workspaceId: localWorkspace.id }
  return useQuery({
    queryKey: knowledgeKeys.list(full),
    queryFn: () => listKnowledgeBases(full),
    placeholderData: keepPreviousData,
  })
}

export function useKnowledgeBase(id: string) {
  return useQuery({
    queryKey: knowledgeKeys.detail(id),
    queryFn: () => getKnowledgeBase(localWorkspace.id, id),
  })
}

export function useDocuments(id: string, params: Omit<DocumentListParams, "workspaceId">) {
  const full = { ...params, workspaceId: localWorkspace.id }
  return useQuery({
    queryKey: knowledgeKeys.documents(id, full),
    queryFn: () => listDocuments(id, full),
    placeholderData: keepPreviousData,
  })
}

export function useDocument(knowledgeBaseId: string, documentId: string) {
  return useQuery({
    queryKey: knowledgeKeys.document(knowledgeBaseId, documentId),
    queryFn: () => getDocument(localWorkspace.id, knowledgeBaseId, documentId),
  })
}

export function useCreateKnowledgeBase() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: KnowledgeBaseCreateRequest) => createKnowledgeBase(input),
    onSuccess: () => refreshKnowledge(client),
  })
}

export function useUpdateKnowledgeBase(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: KnowledgeBaseUpdateRequest) => updateKnowledgeBase(localWorkspace.id, id, input),
    onSuccess: () => refreshKnowledge(client),
  })
}

export function useDeleteKnowledgeBase() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteKnowledgeBase(localWorkspace.id, id),
    onSuccess: () => refreshKnowledge(client),
  })
}

export function useUploadDocument(knowledgeBaseId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: DocumentUploadRequest) => uploadDocument(knowledgeBaseId, input),
    onSuccess: () => refreshKnowledge(client),
  })
}

export function useDeleteDocument(knowledgeBaseId: string, documentId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => deleteDocument(localWorkspace.id, knowledgeBaseId, documentId),
    onSuccess: () => refreshKnowledge(client),
  })
}

export function useRetryDocument(knowledgeBaseId: string, documentId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => retryDocument(localWorkspace.id, knowledgeBaseId, documentId),
    onSuccess: () => refreshKnowledge(client),
  })
}

export function useReindexKnowledgeBase(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => reindexKnowledgeBase(localWorkspace.id, id),
    onSuccess: () => refreshKnowledge(client),
  })
}

export function useCancelIngestion(knowledgeBaseId: string, jobId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => cancelIngestionJob(localWorkspace.id, knowledgeBaseId, jobId),
    onSuccess: () => refreshKnowledge(client),
  })
}

export function useIngestionWatcher(knowledgeBaseId: string, activeJobIds: string[]) {
  const client = useQueryClient()
  const [pollError, setPollError] = useState<string | null>(null)
  const idsRef = useRef(activeJobIds)
  const key = [...activeJobIds].sort().join("|")
  const enabled = key.length > 0 && process.env.VITEST !== "true"

  useEffect(() => {
    idsRef.current = activeJobIds
  }, [activeJobIds])

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      if (stopped || !knowledgeBaseId || idsRef.current.length === 0) return
      try {
        await client.invalidateQueries({ queryKey: knowledgeKeys.all })
      } catch (error) {
        if (!stopped) {
          setPollError(isApiError(error) ? error.message : "The knowledge service could not be reached.")
        }
        return
      }
      if (!stopped && idsRef.current.length > 0) {
        timer = setTimeout(() => {
          void poll()
        }, 700)
      }
    }
    timer = setTimeout(() => {
      void poll()
    }, 700)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [client, enabled, key, knowledgeBaseId])

  return pollError
}
