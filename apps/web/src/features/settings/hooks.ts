"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createIntegration, createMember, deleteMember, getSettings, saveOrganization, savePreferences, changeMemberRole } from "@/features/settings/api"

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: getSettings })
}

export function useSettingsMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["settings"] }),
        client.invalidateQueries({ queryKey: ["audit-logs"] }),
      ]),
  })
}

export const settingsMutations = {
  organization: saveOrganization,
  preferences: savePreferences,
  member: createMember,
  role: ({ id, role }: { id: string; role: Parameters<typeof changeMemberRole>[1] }) => changeMemberRole(id, role),
  remove: deleteMember,
  integration: createIntegration,
}
