"use client"

import { useEffect } from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion"
import { motionEase } from "@/lib/motion"

export function AnimatedCounter({
  value,
  digits = 0,
  suffix = "",
}: {
  value: number
  digits?: number
  suffix?: string
}) {
  const reduced = useReducedMotion() === true
  const motionValue = useMotionValue(reduced ? value : 0)
  const digitsValue = useMotionValue(digits)
  const suffixValue = useMotionValue(suffix)
  const text = useTransform(() => {
    const latest = motionValue.get()
    const places = digitsValue.get()
    const formatted = places === 0 ? Math.round(latest).toLocaleString("en-US") : latest.toFixed(places)
    return `${formatted}${suffixValue.get()}`
  })

  useEffect(() => {
    digitsValue.set(digits)
    suffixValue.set(suffix)
  }, [digits, digitsValue, suffix, suffixValue])

  useEffect(() => {
    if (reduced) {
      motionValue.set(value)
      return
    }

    const controls = animate(motionValue, value, { duration: 0.6, ease: motionEase })
    return () => controls.stop()
  }, [motionValue, reduced, value])

  useEffect(() => {
    if (reduced) {
      motionValue.set(value)
      return
    }

    const controls = animate(motionValue, value, { duration: 0.6, ease: motionEase })
    return () => controls.stop()
  }, [motionValue, reduced, value])

  return <motion.span className="font-mono tabular-nums">{text}</motion.span>
}
