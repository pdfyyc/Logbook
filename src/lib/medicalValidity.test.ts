import { describe, expect, it } from "vitest"
import { medicalValidityMonths } from "./calc"

describe("CAR 404.04 commercial medical validity", () => {
  it("is 12 months for hire or reward from age 40 through 59", () => expect(medicalValidityMonths("cpl-atpl", 41)).toBe(12))
  it("is 6 months from age 40 for single-pilot passenger operations", () => expect(medicalValidityMonths("cpl-atpl-single-pilot-pax", 41)).toBe(6))
  it("is 6 months for commercial privileges from age 60", () => expect(medicalValidityMonths("cpl-atpl", 60)).toBe(6))
})
