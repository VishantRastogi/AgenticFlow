import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        info: "border-highlight/25 bg-highlight/10 text-highlight",
        success:
          "border-emerald-700/20 bg-emerald-700/10 text-emerald-800 dark:text-emerald-200",
        warning: "border-amber-700/25 bg-amber-500/10 text-amber-900 dark:text-amber-100",
        danger: "border-destructive/30 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
)

export function StatusBadge({
  tone = "neutral",
  className,
  children,
}: React.ComponentProps<"span"> & VariantProps<typeof statusBadgeVariants>) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  )
}
