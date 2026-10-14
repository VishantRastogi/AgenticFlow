"use client"

import { useSyncExternalStore } from "react"
import { SessionLoading } from "@/features/auth/components/session-loading"
import { getApiMode, isMockRuntimeEnabled } from "@/features/auth/api/mode"

type RuntimeStatus = "pending" | "ready" | "error"

let status: RuntimeStatus = "pending"
const listeners = new Set<() => void>()
let started = false

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  if (!started && isMockRuntimeEnabled()) {
    started = true
    void import("@/mocks/browser")
      .then(({ startMockWorker }) => startMockWorker())
      .then(() => {
        status = "ready"
        emit()
      })
      .catch(() => {
        status = "error"
        emit()
      })
  }

  return () => listeners.delete(listener)
}

function getSnapshot(): RuntimeStatus {
  if (!isMockRuntimeEnabled()) {
    return "ready"
  }

  return status
}

function getServerSnapshot(): RuntimeStatus {
  return getApiMode() === "mock" && process.env.NODE_ENV === "development" ? "pending" : "ready"
}

export function MockRuntime({ children }: { children: React.ReactNode }) {
  const runtime = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (runtime === "pending") {
    return <SessionLoading message="Starting the mock auth service" />
  }

  if (runtime === "error") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6">
        <p role="alert" className="max-w-sm text-sm text-destructive">
          The mock auth service failed to start.
        </p>
      </div>
    )
  }

  return children
}
