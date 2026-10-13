"use client"

import { useEffect } from "react"
import { Geist, Geist_Mono } from "next/font/google"
import { StatusScreen } from "@/components/shared/status-screen"
import { Button } from "@/components/ui/button"
import { themeBootScript } from "@/lib/boot-script"
import { cn } from "@/lib/utils"
import "./globals.css"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geistSans.variable, geistMono.variable)}>
      <head>
        <title>Something went wrong · AgentFlow</title>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <StatusScreen
          code="Error"
          title="AgentFlow could not start"
          description="The application shell failed to load. Retrying rebuilds this page."
          digest={error.digest}
          actions={
            <Button type="button" onClick={() => retry()}>
              Try again
            </Button>
          }
        />
      </body>
    </html>
  )
}
