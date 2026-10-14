import type { SettingsSnapshot } from "@/mocks/settings-store"
import type { IntegrationInput, MemberInput, OrganizationInput, PreferencesInput } from "@/features/settings/schema"
import { operationsRequest } from "@/features/operations/request"

export function getSettings() {
  return operationsRequest<SettingsSnapshot>("settings.get")
}

export function saveOrganization(input: OrganizationInput) {
  return operationsRequest<SettingsSnapshot>("settings.organization", { body: input })
}

export function savePreferences(input: PreferencesInput) {
  return operationsRequest<SettingsSnapshot>("settings.preferences", { body: input })
}

export function createMember(input: MemberInput) {
  return operationsRequest<SettingsSnapshot>("settings.memberCreate", { body: input })
}

export function changeMemberRole(id: string, role: MemberInput["role"]) {
  return operationsRequest<SettingsSnapshot>("settings.memberRole", { params: { id }, body: { role } })
}

export function deleteMember(id: string) {
  return operationsRequest<SettingsSnapshot>("settings.memberDelete", { params: { id } })
}

export function createIntegration(input: IntegrationInput) {
  return operationsRequest<SettingsSnapshot>("settings.integrationCreate", { body: input })
}
