"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { deployRelease, getDeployment, listDeployments, rollbackRelease } from "@/features/deployments/api"

export const deploymentKeys = {
  all: ["deployments"] as const,
  detail: (id: string) => ["deployments", id] as const,
}

function refresh(client: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    client.invalidateQueries({ queryKey: deploymentKeys.all }),
    client.invalidateQueries({ queryKey: ["audit-logs"] }),
  ])
}

export function useDeployments() {
  return useQuery({ queryKey: deploymentKeys.all, queryFn: listDeployments })
}

export function useDeployment(id: string) {
  return useQuery({ queryKey: deploymentKeys.detail(id), queryFn: () => getDeployment(id), enabled: id.length > 0 })
}

export function useDeploy(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => deployRelease(id),
    onSuccess: () => refresh(client),
  })
}

export function useRollback(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => rollbackRelease(id),
    onSuccess: () => refresh(client),
  })
}
