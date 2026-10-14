"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import type { UseFormRegisterReturn } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function AuthField({
  id,
  label,
  type = "text",
  autoComplete,
  registration,
  error,
}: {
  id: string
  label: string
  type?: string
  autoComplete?: string
  registration: UseFormRegisterReturn
  error?: string
}) {
  const errorId = `${id}-error`

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-10"
        {...registration}
      />
      {error ? (
        <p id={errorId} className="text-xs leading-5 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function PasswordField({
  id,
  label,
  autoComplete,
  registration,
  error,
}: {
  id: string
  label: string
  autoComplete?: string
  registration: UseFormRegisterReturn
  error?: string
}) {
  const [visible, setVisible] = useState(false)
  const errorId = `${id}-error`

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-10 pr-10"
          {...registration}
        />
        <button
          type="button"
          className={cn(
            "absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground",
            "hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          )}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="text-xs leading-5 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function FormBanner({
  tone,
  children,
}: {
  tone: "error" | "success"
  children: React.ReactNode
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-foreground"
      }
    >
      {children}
    </p>
  )
}
