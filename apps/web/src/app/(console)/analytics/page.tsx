import type { Metadata } from "next"
import { AnalyticsScreen } from "@/features/analytics/analytics-screen"

export const metadata: Metadata = { title: "Analytics" }

export default function AnalyticsPage() {
  return <AnalyticsScreen />
}
