"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"

const orbits = [
  { id: "outer", radius: 168, duration: 46, direction: 1, node: "fill-primary" },
  { id: "middle", radius: 118, duration: 32, direction: -1, node: "fill-highlight" },
  { id: "inner", radius: 72, duration: 22, direction: 1, node: "fill-primary" },
] as const

export function OrbitalField() {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = ref.current
    if (!svg) {
      return
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    const context = gsap.context(() => {
      orbits.forEach((orbit) => {
        gsap.to(`[data-orbit="${orbit.id}"]`, {
          rotation: 360 * orbit.direction,
          svgOrigin: "240 240",
          duration: orbit.duration,
          repeat: -1,
          ease: "none",
        })
      })
    }, svg)

    return () => context.revert()
  }, [])

  return (
    <svg
      ref={ref}
      viewBox="0 0 480 480"
      aria-hidden="true"
      className="h-auto w-full max-w-[560px] text-primary"
    >
      <circle cx="240" cy="240" r="210" className="fill-primary/5" />
      {orbits.map((orbit) => (
        <g key={orbit.id} data-orbit={orbit.id}>
          <circle
            cx="240"
            cy="240"
            r={orbit.radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-primary/25"
          />
          <circle cx={240 + orbit.radius} cy="240" r="4.5" className={orbit.node} />
          <circle cx={240 - orbit.radius * 0.35} cy={240 - orbit.radius * 0.94} r="2.5" className="fill-highlight/80" />
        </g>
      ))}
      <circle cx="240" cy="240" r="6" className="fill-highlight" />
    </svg>
  )
}
