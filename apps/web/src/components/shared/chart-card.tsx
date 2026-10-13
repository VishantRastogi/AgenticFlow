import { SectionCard } from "@/components/shared/section-card"

export function ChartCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <SectionCard title={title} description={description}>
      {children ?? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 px-6 text-center">
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">No series connected yet.</p>
        </div>
      )}
    </SectionCard>
  )
}
