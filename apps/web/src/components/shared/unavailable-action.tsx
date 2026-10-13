import { Button } from "@/components/ui/button"

function reasonId(label: string) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return `${slug || "action"}-unavailable`
}

export function UnavailableAction({ label, reason }: { label: string; reason: string }) {
  const id = reasonId(label)

  return (
    <div className="flex max-w-xs flex-col items-start gap-1.5 sm:items-end">
      <Button type="button" variant="outline" disabled aria-describedby={id}>
        {label}
      </Button>
      <p id={id} className="text-xs leading-5 text-muted-foreground sm:text-right">
        {reason}
      </p>
    </div>
  )
}
