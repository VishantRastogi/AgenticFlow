import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BrandMark } from "@/components/shell/brand-mark"
import { motionTransition } from "@/lib/motion"

const { context } = vi.hoisted(() => ({
  context: vi.fn(() => ({ revert: vi.fn() })),
}))

vi.mock("gsap", () => ({
  default: {
    context,
  },
}))

describe("motion", () => {
  it("uses an instant transition when motion is reduced", () => {
    expect(motionTransition(true)).toEqual({ duration: 0 })
    expect(motionTransition(false).duration).toBe(0.22)
  })

  it("skips the brand sequence when reduced motion is requested", () => {
    context.mockClear()
    window.matchMedia = (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })

    render(<BrandMark />)

    expect(context).not.toHaveBeenCalled()
  })
})