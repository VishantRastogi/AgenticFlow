import { http, HttpResponse } from "msw"
import type { ApiErrorBody } from "@/features/auth/types"
import { firstIssue, integrationSchema, memberRoleSchema, memberSchema, organizationSchema, preferencesSchema } from "@/features/settings/schema"
import { auditActor, recordAudit } from "@/mocks/audit-store"
import { addMember, readSettings, removeMember, saveIntegration, updateMemberRole, updateOrganization, updatePreferences } from "@/mocks/settings-store"

function error(status: number, body: ApiErrorBody) {
  return HttpResponse.json(body, { status })
}

export const settingsHandlers = [
  http.get("*/api/settings", () => HttpResponse.json(readSettings())),

  http.patch("*/api/settings/organization", async ({ request }) => {
    const parsed = organizationSchema.safeParse(await request.json())
    if (!parsed.success) return error(400, { code: "validation_error", message: firstIssue(parsed.error) })
    const settings = updateOrganization(parsed.data)
    recordAudit({
      actor: auditActor(request),
      action: "settings.organization_updated",
      resourceType: "organization",
      resourceId: parsed.data.slug,
      outcome: "succeeded",
      detail: `Organization name is now ${parsed.data.name}.`,
      fields: { name: parsed.data.name, slug: parsed.data.slug },
    })
    return HttpResponse.json(settings)
  }),

  http.patch("*/api/settings/preferences", async ({ request }) => {
    const parsed = preferencesSchema.safeParse(await request.json())
    if (!parsed.success) return error(400, { code: "validation_error", message: firstIssue(parsed.error) })
    const settings = updatePreferences(parsed.data)
    recordAudit({
      actor: auditActor(request),
      action: "settings.preferences_updated",
      resourceType: "settings",
      resourceId: "preferences",
      outcome: "succeeded",
      detail: `Density is now ${parsed.data.density}.`,
      fields: { density: parsed.data.density },
    })
    return HttpResponse.json(settings)
  }),

  http.post("*/api/settings/members", async ({ request }) => {
    const parsed = memberSchema.safeParse(await request.json())
    if (!parsed.success) return error(400, { code: "validation_error", message: firstIssue(parsed.error) })
    const result = addMember(parsed.data)
    if ("error" in result) return error(409, { code: "validation_error", message: result.message })
    recordAudit({
      actor: auditActor(request),
      action: "member.added",
      resourceType: "member",
      resourceId: result.member.id,
      outcome: "succeeded",
      detail: `${result.member.name} joined as ${result.member.role}.`,
      fields: { email: result.member.email, role: result.member.role },
    })
    return HttpResponse.json(result.settings, { status: 201 })
  }),

  http.patch("*/api/settings/members/:id", async ({ params, request }) => {
    const parsed = memberRoleSchema.safeParse(await request.json())
    if (!parsed.success) return error(400, { code: "validation_error", message: firstIssue(parsed.error) })
    const result = updateMemberRole(String(params.id), parsed.data.role)
    if ("error" in result) return error(result.error === "missing" ? 404 : 409, { code: result.error === "missing" ? "unknown" : "validation_error", message: result.message })
    recordAudit({
      actor: auditActor(request),
      action: "member.role_changed",
      resourceType: "member",
      resourceId: String(params.id),
      outcome: "succeeded",
      detail: `Role is now ${parsed.data.role}.`,
      fields: { role: parsed.data.role },
    })
    return HttpResponse.json(result.settings)
  }),

  http.delete("*/api/settings/members/:id", ({ params, request }) => {
    const result = removeMember(String(params.id))
    if ("error" in result) return error(result.error === "missing" ? 404 : 409, { code: result.error === "missing" ? "unknown" : "validation_error", message: result.message })
    recordAudit({
      actor: auditActor(request),
      action: "member.removed",
      resourceType: "member",
      resourceId: String(params.id),
      outcome: "succeeded",
      detail: "Member removed from the mock workspace.",
    })
    return HttpResponse.json(result.settings)
  }),

  http.post("*/api/settings/integrations", async ({ request }) => {
    const parsed = integrationSchema.safeParse(await request.json())
    if (!parsed.success) return error(400, { code: "validation_error", message: firstIssue(parsed.error) })
    const result = saveIntegration(parsed.data)
    recordAudit({
      actor: auditActor(request),
      action: "integration.saved",
      resourceType: "integration",
      resourceId: result.integration.id,
      outcome: "succeeded",
      detail: result.integration.note,
      fields: { name: result.integration.name, secret: parsed.data.secret },
    })
    return HttpResponse.json(result.settings, { status: 201 })
  }),
]
