"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { cn } from "@/lib/utils"

export function BrandMark({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = ref.current
    if (!svg) {
      return
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      return
    }

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: "power2.out" } })
      timeline
        .from("[data-node]", { opacity: 0, duration: 0.28, stagger: 0.08 })
        .from("[data-link]", { opacity: 0, strokeDashoffset: 28, duration: 0.35, stagger: 0.06 }, 0.08)
    }, svg)

    return () => context.revert()
  }, [])

  return (
    <svg
      ref={ref}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
    >
      <path
        data-link=""
        d="M16 9.5 L10.5 21"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="28"
        className="text-highlight"
      />
      <path
        data-link=""
        d="M16 9.5 L21.5 21"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="28"
        className="text-primary"
      />
      <path
        data-link=""
        d="M10.5 21 H21.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="28"
        className="text-muted-foreground"
      />
      <circle data-node="" cx="16" cy="9.5" r="2.1" className="fill-primary" />
      <circle data-node="" cx="10.5" cy="21" r="2.1" className="fill-highlight" />
      <circle data-node="" cx="21.5" cy="21" r="2.1" className="fill-primary" />
    </svg>
  )
}
