import type { LucideIcon } from "lucide-react"
import { AnimatedCounter } from "@/components/shared/animated-counter"
import { Card, CardContent } from "@/components/ui/card"

function displayValue(value: number | string, digits = 0, suffix = "") {
  if (typeof value !== "number") return value
  const formatted = digits === 0 ? Math.round(value).toLocaleString("en-US") : value.toFixed(digits)
  return `${formatted}${suffix}`
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  digits = 0,
  suffix = "",
}: {
  label: string
  value: number | string
  hint?: string
  icon?: LucideIcon
  digits?: number
  suffix?: string
}) {
  return (
    <Card role="group" aria-label={`${label} ${displayValue(value, digits, suffix)}`}>
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {typeof value === "number" ? <AnimatedCounter value={value} digits={digits} suffix={suffix} /> : value}
          </p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? <Icon className="size-4 text-primary" aria-hidden="true" /> : null}
      </CardContent>
    </Card>
  )
}
