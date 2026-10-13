import { AnimatedPage } from "@/components/shared/animated-page"
import { PageHeader } from "@/components/shared/page-header"
import { SectionCard } from "@/components/shared/section-card"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { UnavailableAction } from "@/components/shared/unavailable-action"
import { modules } from "@/lib/modules"
import { localWorkspace } from "@/lib/workspace"

export function SettingsScreen() {
  const settings = modules.settings

  return (
    <AnimatedPage>
      <PageHeader title={settings.title} description={settings.description} />
      <div className="grid gap-4">
        <SectionCard
          title="Appearance"
          description="Theme is stored in this browser. System follows the operating system preference."
        >
          <ThemeToggle mode="inline" />
        </SectionCard>
        <SectionCard
          title="Workspace"
          description="This shell is using the local workspace. Additional workspaces are unavailable until workspace services are connected."
        >
          <p className="text-sm font-medium text-foreground">{localWorkspace.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{localWorkspace.status}</p>
        </SectionCard>
        <SectionCard
          title="Account"
          description="Sign-in is not connected. Account actions stay disabled."
        >
          <UnavailableAction
            label="Manage account"
            reason="Account management is unavailable until authentication is connected."
          />
        </SectionCard>
      </div>
    </AnimatedPage>
  )
}
