import { describe, expect, it } from "vitest"
import { deriveDayTime, normalizeCount, normalizeHours, validateFlightNumbers } from "./numericPolicy"

describe("numeric policy", () => {
  it("rejects negative, NaN, Infinity and excessive values", () => { for (const value of [-1, NaN, Infinity, 24.1]) expect(normalizeHours(value)).toBeNull() })
  it("rounds hours consistently and treats blank as zero", () => { expect(normalizeHours(1.26)).toBe(1.3); expect(normalizeHours("")).toBe(0) })
  it("requires whole non-negative counts", () => { expect(normalizeCount(1.5)).toBeNull(); expect(normalizeCount(-1)).toBeNull(); expect(normalizeCount(2)).toBe(2) })
  it("validates day/night and credited bounds", () => { expect(validateFlightNumbers({ totalTime: 1, dayTime: .8, night: .3, pic: 1.2 })).toEqual(expect.arrayContaining([expect.stringMatching(/Day plus night/), expect.stringMatching(/pic cannot exceed/)])) })
  it("derives day time consistently after excluding night and simulator time", () => {
    expect(deriveDayTime(10, 2, 3)).toBe(5)
    expect(validateFlightNumbers({ totalTime: 10, night: 2, simTime: 3 })).not.toContain(expect.stringMatching(/Day plus night/))
  })
})
