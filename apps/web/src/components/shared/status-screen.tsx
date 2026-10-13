import Link from "next/link"
import { BrandMark } from "@/components/shell/brand-mark"
import { Button } from "@/components/ui/button"

export function StatusScreen({
  code,
  title,
  description,
  digest,
  actions,
}: {
  code: string
  title: string
  description: string
  digest?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <BrandMark className="size-10" />
      <p className="mt-6 font-mono text-xs tracking-[0.18em] text-highlight uppercase">{code}</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {digest ? <p className="mt-3 font-mono text-xs text-muted-foreground">Reference {digest}</p> : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {actions ?? (
          <Button asChild>
            <Link href="/overview">Back to overview</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
