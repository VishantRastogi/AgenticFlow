import type { Transition } from "framer-motion"

export const motionEase = [0.22, 1, 0.36, 1] as const

export function motionTransition(reduced: boolean, duration = 0.22): Transition {
  if (reduced) {
    return { duration: 0 }
  }

  return { duration, ease: motionEase }
}
