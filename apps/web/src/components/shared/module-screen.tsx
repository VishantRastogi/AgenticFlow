import { AnimatedPage } from "@/components/shared/animated-page"
import { ChartCard } from "@/components/shared/chart-card"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { UnavailableAction } from "@/components/shared/unavailable-action"
import { modules, type ModuleKey } from "@/lib/modules"

export function ModuleScreen({ moduleKey }: { moduleKey: Exclude<ModuleKey, "settings"> }) {
  const current = modules[moduleKey]
  const Icon = current.icon

  return (
    <AnimatedPage>
      <PageHeader
        title={current.title}
        description={current.description}
        actions={
          current.action ? (
            <UnavailableAction label={current.action.label} reason={current.action.reason} />
          ) : null
        }
      />
      {current.chart ? (
        <ChartCard title={current.chart.title} description={current.chart.description} />
      ) : null}
      {current.emptyTitle && current.emptyDescription ? (
        <EmptyState
          icon={<Icon className="size-5" aria-hidden="true" />}
          title={current.emptyTitle}
          description={current.emptyDescription}
        />
      ) : null}
    </AnimatedPage>
  )
}
