"use client"

import { useEffect } from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion"
import { motionEase } from "@/lib/motion"

export function AnimatedCounter({ value }: { value: number }) {
  const reduced = useReducedMotion() === true
  const motionValue = useMotionValue(0)
  const text = useTransform(motionValue, (latest) => Math.round(latest).toLocaleString("en-US"))

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
