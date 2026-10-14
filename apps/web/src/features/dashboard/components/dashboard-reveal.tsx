"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"

export function DashboardReveal() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const line = ref.current
    if (!line) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const context = gsap.context(() => {
      gsap.fromTo(
        line,
        { scaleX: 0, opacity: 0.35 },
        { scaleX: 1, opacity: 1, duration: 0.7, ease: "power2.out", transformOrigin: "left center" },
      )
    }, line)

    return () => context.revert()
  }, [])

  return <div ref={ref} aria-hidden="true" className="mt-4 h-px w-24 origin-left bg-highlight" />
}
