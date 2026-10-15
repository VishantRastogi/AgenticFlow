import type { Metadata } from "next"
import { PlaygroundScreen } from "@/features/playground/playground-screen"

export const metadata: Metadata = { title: "AI Playground" }

export default function PlaygroundPage() {
  return <PlaygroundScreen />
}
