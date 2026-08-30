import { nearestByLatLon } from "./geo"

export interface GfaRegion {
  id: string
  name: string
  code: string
  /** Rough centroid used only to pick the nearest region — not a real boundary. */
  lat: number
  lon: number
}

// NAV CANADA's 7 GFA graphical areas. Centroids are coarse approximations for
// "which region is this pilot probably in" — not authoritative boundaries.
// Always confirm on NAV CANADA before using operationally.
export const GFA_REGIONS: GfaRegion[] = [
  { id: "pacific", name: "Pacific", code: "GFACN31", lat: 54.0, lon: -125.0 },
  { id: "prairies", name: "Prairies", code: "GFACN32", lat: 53.5, lon: -106.0 },
  { id: "ontario", name: "Ontario", code: "GFACN33", lat: 50.0, lon: -85.0 },
  { id: "quebec", name: "Quebec", code: "GFACN34", lat: 52.0, lon: -71.0 },
  { id: "maritimes", name: "Maritimes", code: "GFACN35", lat: 47.5, lon: -63.0 },
  { id: "yukon-nwt", name: "Yukon / NWT", code: "GFACN36", lat: 64.0, lon: -125.0 },
  { id: "arctic", name: "Arctic", code: "GFACN37", lat: 66.0, lon: -85.0 },
]

export function nearestGfaRegion(lat: number, lon: number): GfaRegion {
  return nearestByLatLon(lat, lon, GFA_REGIONS)
}
