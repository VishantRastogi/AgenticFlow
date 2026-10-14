import { maskSecret } from "@/mocks/audit-store"
import type { IntegrationInput, MemberInput, OrganizationInput, PreferencesInput } from "@/features/settings/schema"

const STORAGE_KEY = "agentflow-mock-settings"

export type MemberRole = "owner" | "admin" | "operator" | "viewer"
export type SettingsMember = { id: string; name: string; email: string; role: MemberRole }
export type SettingsIntegration = {
  id: string
  name: string
  status: "saved_locally"
  secretMask: string
  note: string
}

export type SettingsSnapshot = {
  simulated: true
  organization: OrganizationInput
  preferences: PreferencesInput
  members: SettingsMember[]
  integrations: SettingsIntegration[]
}

type Overlay = {
  sequence: number
  organization?: OrganizationInput
  preferences?: PreferencesInput
  members?: SettingsMember[]
  integrations?: SettingsIntegration[]
}

const seed = (): SettingsSnapshot => ({
  simulated: true,
  organization: { name: "Local workspace", slug: "local" },
  preferences: { density: "comfortable" },
  members: [{ id: "mem_ada", name: "Ada Lovelace", email: "ada@agentflow.test", role: "owner" }],
  integrations: [],
})

function readOverlay(): Overlay {
  if (typeof localStorage === "undefined") return { sequence: 0 }
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { sequence: 0 }
  try {
    const parsed = JSON.parse(raw) as Overlay
    if (!parsed || typeof parsed !== "object") return { sequence: 0 }
    return { sequence: parsed.sequence ?? 0, organization: parsed.organization, preferences: parsed.preferences, members: parsed.members, integrations: parsed.integrations }
  } catch {
    return { sequence: 0 }
  }
}

function writeOverlay(overlay: Overlay) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay))
}

export function readSettings(): SettingsSnapshot {
  const overlay = readOverlay()
  const base = seed()
  return {
    simulated: true,
    organization: overlay.organization ?? base.organization,
    preferences: overlay.preferences ?? base.preferences,
    members: overlay.members ?? base.members,
    integrations: overlay.integrations ?? base.integrations,
  }
}

export function updateOrganization(input: OrganizationInput) {
  const overlay = readOverlay()
  overlay.organization = input
  writeOverlay(overlay)
  return readSettings()
}

export function updatePreferences(input: PreferencesInput) {
  const overlay = readOverlay()
  overlay.preferences = input
  writeOverlay(overlay)
  return readSettings()
}

export function addMember(input: MemberInput): { error: "duplicate"; message: string } | { settings: SettingsSnapshot; member: SettingsMember } {
  const current = readSettings()
  if (current.members.some((member) => member.email.toLowerCase() === input.email.toLowerCase())) {
    return { error: "duplicate" as const, message: "A member with that email is already in the workspace." }
  }
  const overlay = readOverlay()
  overlay.sequence = (overlay.sequence ?? 0) + 1
  const members = current.members.concat({ id: `mem_${overlay.sequence}`, name: input.name, email: input.email, role: input.role })
  overlay.members = members
  writeOverlay(overlay)
  return { settings: readSettings(), member: members[members.length - 1] }
}

export function updateMemberRole(id: string, role: MemberInput["role"]): { error: "missing" | "owner"; message: string } | { settings: SettingsSnapshot } {
  const current = readSettings()
  const member = current.members.find((item) => item.id === id)
  if (!member) return { error: "missing" as const, message: "This member is not in the workspace." }
  if (member.role === "owner") return { error: "owner" as const, message: "The owner role stays with the workspace owner." }
  const overlay = readOverlay()
  overlay.members = current.members.map((item) => (item.id === id ? { ...item, role } : item))
  writeOverlay(overlay)
  return { settings: readSettings() }
}

export function removeMember(id: string): { error: "missing" | "owner"; message: string } | { settings: SettingsSnapshot } {
  const current = readSettings()
  const member = current.members.find((item) => item.id === id)
  if (!member) return { error: "missing" as const, message: "This member is not in the workspace." }
  if (member.role === "owner") return { error: "owner" as const, message: "The workspace owner cannot be removed." }
  const overlay = readOverlay()
  overlay.members = current.members.filter((item) => item.id !== id)
  writeOverlay(overlay)
  return { settings: readSettings() }
}

export function saveIntegration(input: IntegrationInput) {
  const current = readSettings()
  const overlay = readOverlay()
  overlay.sequence = (overlay.sequence ?? 0) + 1
  const integration: SettingsIntegration = {
    id: `int_${overlay.sequence}`,
    name: input.name,
    status: "saved_locally",
    secretMask: maskSecret(input.secret),
    note: "Saved in this browser. No provider was contacted.",
  }
  overlay.integrations = [integration, ...current.integrations]
  writeOverlay(overlay)
  return { settings: readSettings(), integration }
}
