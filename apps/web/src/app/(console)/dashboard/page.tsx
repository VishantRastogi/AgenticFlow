import type { Metadata } from "next"
import { DashboardScreen } from "@/features/dashboard/components/dashboard-screen"

export const metadata: Metadata = { title: "Command Center" }

export default function DashboardPage() {
  return <DashboardScreen />
}
