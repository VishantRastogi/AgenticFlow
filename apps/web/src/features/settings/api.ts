import type { SettingsSnapshot } from "@/mocks/settings-store"
import type { IntegrationInput, MemberInput, OrganizationInput, PreferencesInput } from "@/features/settings/schema"
import { operationsRequest } from "@/features/operations/request"

const messages = {
  network: "The settings service could not be reached.",
  unavailable: "The real settings API is unavailable. Mock mode was not used.",
}

export function getSettings() {
  return operationsRequest<SettingsSnapshot>("/api/settings", "GET", messages)
}

export function saveOrganization(input: OrganizationInput) {
  return operationsRequest<SettingsSnapshot>("/api/settings/organization", "PATCH", messages, input)
}

export function savePreferences(input: PreferencesInput) {
  return operationsRequest<SettingsSnapshot>("/api/settings/preferences", "PATCH", messages, input)
}

export function createMember(input: MemberInput) {
  return operationsRequest<SettingsSnapshot>("/api/settings/members", "POST", messages, input)
}

export function changeMemberRole(id: string, role: MemberInput["role"]) {
  return operationsRequest<SettingsSnapshot>(`/api/settings/members/${id}`, "PATCH", messages, { role })
}

export function deleteMember(id: string) {
  return operationsRequest<SettingsSnapshot>(`/api/settings/members/${id}`, "DELETE", messages)
}

export function createIntegration(input: IntegrationInput) {
  return operationsRequest<SettingsSnapshot>("/api/settings/integrations", "POST", messages, input)
}
