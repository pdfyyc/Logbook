export interface GfaRegion {
  id: string
  name: string
  code: string
  /** Rough centroid used only to pick the nearest region — not a real boundary. */
  centroid: { lat: number; lon: number }
}

// NAV CANADA's 7 GFA graphical areas. Centroids are coarse approximations for
// "which region is this pilot probably in" — not authoritative boundaries.
// Always confirm on NAV CANADA before using operationally.
export const GFA_REGIONS: GfaRegion[] = [
  { id: "pacific", name: "Pacific", code: "GFACN31", centroid: { lat: 54.0, lon: -125.0 } },
  { id: "prairies", name: "Prairies", code: "GFACN32", centroid: { lat: 53.5, lon: -106.0 } },
  { id: "ontario", name: "Ontario", code: "GFACN33", centroid: { lat: 50.0, lon: -85.0 } },
  { id: "quebec", name: "Quebec", code: "GFACN34", centroid: { lat: 52.0, lon: -71.0 } },
  { id: "maritimes", name: "Maritimes", code: "GFACN35", centroid: { lat: 47.5, lon: -63.0 } },
  { id: "yukon-nwt", name: "Yukon / NWT", code: "GFACN36", centroid: { lat: 64.0, lon: -125.0 } },
  { id: "arctic", name: "Arctic", code: "GFACN37", centroid: { lat: 66.0, lon: -85.0 } },
]

export function nearestGfaRegion(lat: number, lon: number): GfaRegion {
  let best = GFA_REGIONS[0]
  let bestDist = Infinity
  for (const region of GFA_REGIONS) {
    const dLat = lat - region.centroid.lat
    // Longitude degrees shrink toward the poles — scale by cos(latitude) so
    // distance roughly tracks real ground distance instead of raw degrees
    // (without this, high-latitude points like Iqaluit mismatch badly).
    const avgLatRad = ((lat + region.centroid.lat) / 2) * (Math.PI / 180)
    const dLon = (lon - region.centroid.lon) * Math.cos(avgLatRad)
    const dist = dLat * dLat + dLon * dLon
    if (dist < bestDist) {
      bestDist = dist
      best = region
    }
  }
  return best
}
