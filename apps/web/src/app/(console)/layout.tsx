import { AppShell } from "@/components/shell/app-shell"
import { AuthGate } from "@/features/auth/components/auth-gate"

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  )
}
