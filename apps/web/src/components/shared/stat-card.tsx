import type { LucideIcon } from "lucide-react"
import { AnimatedCounter } from "@/components/shared/animated-counter"
import { Card, CardContent } from "@/components/ui/card"

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: number | string
  hint?: string
  icon?: LucideIcon
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
          </p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? <Icon className="size-4 text-primary" aria-hidden="true" /> : null}
      </CardContent>
    </Card>
  )
}
