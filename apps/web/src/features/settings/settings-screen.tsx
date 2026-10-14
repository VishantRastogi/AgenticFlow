"use client"

import { useState } from "react"
import { ErrorState } from "@/components/shared/error-state"
import { SectionCard } from "@/components/shared/section-card"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isApiError } from "@/features/auth/api/errors"
import { useSession } from "@/features/auth/hooks"
import { settingsMutations, useSettings, useSettingsMutation } from "@/features/settings/hooks"
import { firstIssue, integrationSchema, memberSchema, organizationSchema } from "@/features/settings/schema"

export function SettingsScreen() {
  const settings = useSettings()
  const session = useSession()
  const organization = useSettingsMutation(settingsMutations.organization)
  const preferences = useSettingsMutation(settingsMutations.preferences)
  const member = useSettingsMutation(settingsMutations.member)
  const role = useSettingsMutation(settingsMutations.role)
  const remove = useSettingsMutation(settingsMutations.remove)
  const integration = useSettingsMutation(settingsMutations.integration)
  const [notice, setNotice] = useState("")
  const [formError, setFormError] = useState("")
  const snapshot = settings.data
  const errorMessage = isApiError(settings.error) ? settings.error.message : "The settings service could not be reached."

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-border/80 pb-5">
        <p className="text-xs font-medium tracking-wide text-highlight uppercase">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Organization, members, and saved integrations live in the mock workspace. Theme stays in this browser. No external provider is contacted.
        </p>
      </header>
      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
      {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
      <SectionCard title="Appearance" description="Dark, light, and system follow this browser. System uses the operating system preference.">
        <ThemeToggle mode="inline" />
      </SectionCard>
      {settings.isPending ? <p className="text-sm text-muted-foreground">Loading settings</p> : null}
      {settings.isError ? <ErrorState title="Settings unavailable" description={errorMessage} onRetry={() => void settings.refetch()} /> : null}
      {snapshot ? (
        <>
          <SectionCard title="Organization" description="Saved in the mock workspace.">
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                const parsed = organizationSchema.safeParse({ name: data.get("name"), slug: data.get("slug") })
                if (!parsed.success) {
                  setFormError(firstIssue(parsed.error))
                  return
                }
                setFormError("")
                void organization.mutateAsync(parsed.data).then(
                  () => setNotice("Organization saved."),
                  (error: unknown) => setFormError(isApiError(error) ? error.message : "The settings service could not be reached."),
                )
              }}
            >
              <label className="grid gap-1 text-xs text-muted-foreground">
                Name
                <Input name="name" aria-label="Organization name" defaultValue={snapshot.organization.name} />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Slug
                <Input name="slug" aria-label="Organization slug" defaultValue={snapshot.organization.slug} />
              </label>
              <Button type="submit" className="sm:col-span-2 w-fit">Save organization</Button>
            </form>
          </SectionCard>
          <SectionCard title="Preferences" description="Timestamps in Mission Control stay on the simulated UTC clock.">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                const density = new FormData(event.currentTarget).get("density")
                if (density !== "comfortable" && density !== "compact") return
                void preferences.mutateAsync({ density }).then(
                  () => setNotice(`Density saved as ${density}.`),
                  (error: unknown) => setFormError(isApiError(error) ? error.message : "The settings service could not be reached."),
                )
              }}
            >
              <label className="grid gap-1 text-xs text-muted-foreground">
                Density
                <select name="density" aria-label="Density" defaultValue={snapshot.preferences.density} className="h-11 rounded-lg border border-input bg-background px-2.5 text-sm lg:h-8">
                  <option value="comfortable">comfortable</option>
                  <option value="compact">compact</option>
                </select>
              </label>
              <Button type="submit" variant="outline">Save preferences</Button>
            </form>
          </SectionCard>
          <SectionCard title="Members" description={session.data?.user ? `Signed in as ${session.data.user.email}. Roles are stored locally.` : "Member roles are stored in the mock workspace."}>
            <ul className="mb-4 flex flex-col gap-2">
              {snapshot.members.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <span>
                    <span className="block text-sm font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.email}</span>
                  </span>
                  {item.role === "owner" ? (
                    <span className="text-xs text-muted-foreground">owner</span>
                  ) : (
                    <span className="flex gap-2">
                      <select
                        aria-label={`Role for ${item.name}`}
                        value={item.role}
                        onChange={(event) => {
                          const next = event.target.value
                          if (next !== "admin" && next !== "operator" && next !== "viewer") return
                          void role.mutateAsync({ id: item.id, role: next }).then(() => setNotice(`${item.name} is now ${next}.`))
                        }}
                        className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                      >
                        {["admin", "operator", "viewer"].map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <Button type="button" variant="outline" onClick={() => void remove.mutateAsync(item.id).then(() => setNotice(`${item.name} removed.`))}>Remove</Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <form
              className="grid gap-3 sm:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                const parsed = memberSchema.safeParse({ name: data.get("memberName"), email: data.get("memberEmail"), role: data.get("memberRole") })
                if (!parsed.success) {
                  setFormError(firstIssue(parsed.error))
                  return
                }
                setFormError("")
                void member.mutateAsync(parsed.data).then(
                  () => {
                    setNotice(`${parsed.data.name} added.`)
                    event.currentTarget.reset()
                  },
                  (error: unknown) => setFormError(isApiError(error) ? error.message : "The settings service could not be reached."),
                )
              }}
            >
              <Input name="memberName" aria-label="Member name" placeholder="Name" />
              <Input name="memberEmail" aria-label="Member email" placeholder="Email" />
              <select name="memberRole" aria-label="Member role" defaultValue="operator" className="h-11 rounded-lg border border-input bg-background px-2.5 text-sm lg:h-8">
                {["admin", "operator", "viewer"].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <Button type="submit" className="sm:col-span-3 w-fit">Add member</Button>
            </form>
          </SectionCard>
          <SectionCard title="Integrations" description="A saved secret is masked and kept in this browser. Nothing is sent to a provider.">
            {snapshot.integrations.length === 0 ? <p className="mb-3 text-sm text-muted-foreground">No integrations are saved.</p> : (
              <ul className="mb-3 flex flex-col gap-2">
                {snapshot.integrations.map((item) => (
                  <li key={item.id} className="text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{item.secretMask}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{item.note}</span>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                const parsed = integrationSchema.safeParse({ name: data.get("integrationName"), secret: data.get("integrationSecret") })
                if (!parsed.success) {
                  setFormError(firstIssue(parsed.error))
                  return
                }
                setFormError("")
                void integration.mutateAsync(parsed.data).then(
                  () => {
                    setNotice("Integration saved locally. No provider was contacted.")
                    event.currentTarget.reset()
                  },
                  (error: unknown) => setFormError(isApiError(error) ? error.message : "The settings service could not be reached."),
                )
              }}
            >
              <Input name="integrationName" aria-label="Integration name" placeholder="Name" />
              <Input name="integrationSecret" aria-label="Integration secret" placeholder="Secret" type="password" />
              <Button type="submit" variant="outline" className="sm:col-span-2 w-fit">Save locally</Button>
            </form>
          </SectionCard>
        </>
      ) : null}
    </div>
  )
}
