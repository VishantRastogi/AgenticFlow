export function SessionLoading({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6" role="status" aria-live="polite">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
