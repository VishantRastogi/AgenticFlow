import type { Metadata } from "next"
import { StatusScreen } from "@/components/shared/status-screen"

export const metadata: Metadata = {
  title: "Page not found",
}

export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      title="This page is not in Mission Control"
      description="The address does not match a view in this workspace. Overview is the nearest place to continue."
    />
  )
}
