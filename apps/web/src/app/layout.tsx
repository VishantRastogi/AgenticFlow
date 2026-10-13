import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { AppProviders } from "@/providers/app-providers"
import { sidebarBootScript } from "@/lib/boot-script"
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

export const metadata: Metadata = {
  title: {
    default: "AgentFlow",
    template: "%s · AgentFlow",
  },
  description: "Mission control for AI agent orchestration.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", geistSans.variable, geistMono.variable)}
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <script dangerouslySetInnerHTML={{ __html: sidebarBootScript }} />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
