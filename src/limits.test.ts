import { afterEach, describe, expect, it, vi } from "vitest"
import {
  formatUsd,
  getPalette,
  percentUsed,
  resetText,
  rightAlign,
} from "./limits.js"

describe("formatUsd", () => {
  it("formats with two decimals", () => {
    expect(formatUsd(11.4176)).toBe("$11.42")
    expect(formatUsd(0)).toBe("$0.00")
    expect(formatUsd(5)).toBe("$5.00")
  })
})

describe("percentUsed", () => {
  it("computes clamped percentages", () => {
    expect(percentUsed(0, 30)).toBe(0)
    expect(percentUsed(30, 30)).toBe(100)
    expect(percentUsed(45, 30)).toBe(100)
    expect(percentUsed(15, 30)).toBe(50)
    expect(percentUsed(1, 0)).toBe(0)
  })
})

describe("rightAlign", () => {
  it("pads values to the given width", () => {
    expect(rightAlign("42%", 5)).toBe("  42%")
    expect(rightAlign("ab", 3)).toBe(" ab")
    expect(rightAlign("abc", 3)).toBe("abc")
  })
})

describe("resetText", () => {
  const NOW = Date.UTC(2026, 7, 12, 12, 0, 0)

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mockNow = () => vi.spyOn(Date, "now").mockReturnValue(NOW)

  it('returns "--" when resetsAt is null', () => {
    expect(resetText(null)).toBe("--")
  })

  it('returns "now" when resetsAt is in the past', () => {
    mockNow()
    expect(resetText(NOW - 1000)).toBe("now")
  })

  it("formats +30 minutes as 30m", () => {
    mockNow()
    expect(resetText(NOW + 30 * 60 * 1000)).toBe("30m")
  })

  it("formats +2 hours as 2h", () => {
    mockNow()
    expect(resetText(NOW + 2 * 60 * 60 * 1000)).toBe("2h")
  })

  it("formats +3 days as 3d", () => {
    mockNow()
    expect(resetText(NOW + 3 * 24 * 60 * 60 * 1000)).toBe("3d")
  })

  it("formats +30 seconds as 1m (minimum 1 minute)", () => {
    mockNow()
    expect(resetText(NOW + 30 * 1000)).toBe("1m")
  })
})

describe("getPalette", () => {
  it("maps hex-string theme values", () => {
    const palette = getPalette({
      borderSubtle: "#111111",
      text: "#ffffff",
      textMuted: "#cccccc",
      primary: "#ff0000",
      warning: "#00ff00",
    })
    expect(palette.subtle).toBe("#111111")
    expect(palette.text).toBe("#ffffff")
    expect(palette.muted).toBe("#cccccc")
    expect(palette.accent).toBe("#ff0000")
    expect(palette.warning).toBe("#00ff00")
  })

  it("returns RGBA objects as-is", () => {
    const subtle = { r: 1, g: 2, b: 3, a: 4 }
    const text = { r: 5, g: 6, b: 7, a: 8 }
    const palette = getPalette({
      borderSubtle: subtle,
      text: text,
    })
    expect(palette.subtle).toBe(subtle)
    expect(palette.text).toBe(text)
  })

  it("falls back to defaults for missing keys", () => {
    const palette = getPalette({})
    expect(palette.subtle).toBe("#2a2a2a")
    expect(palette.text).toBe("#f0f0f0")
    expect(palette.muted).toBe("#a5a5a5")
    expect(palette.accent).toBe("#5f87ff")
    expect(palette.warning).toBe("#d7a94b")
  })

  it("falls back per-key when individual values are missing", () => {
    const palette = getPalette({ primary: "#123456" })
    expect(palette.accent).toBe("#123456")
    expect(palette.warning).toBe("#d7a94b")
  })
})
