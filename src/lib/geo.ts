export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported in this browser."))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 5 * 60 * 1000,
    })
  })
}

export function isPermissionDeniedError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 1
}

/** Finds the closest of `points` to (lat, lon), scaling longitude by
 *  cos(latitude) so distance roughly tracks real ground distance instead of
 *  raw degrees — without this, high-latitude points mismatch badly. */
export function nearestByLatLon<T extends { lat: number; lon: number }>(lat: number, lon: number, points: T[]): T {
  let best = points[0]
  let bestDist = Infinity
  for (const point of points) {
    const dLat = lat - point.lat
    const avgLatRad = ((lat + point.lat) / 2) * (Math.PI / 180)
    const dLon = (lon - point.lon) * Math.cos(avgLatRad)
    const dist = dLat * dLat + dLon * dLon
    if (dist < bestDist) {
      bestDist = dist
      best = point
    }
  }
  return best
}
