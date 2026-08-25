export type WeatherIcon =
  | "sun"
  | "cloud-sun"
  | "cloud"
  | "cloud-fog"
  | "cloud-rain"
  | "cloud-snow"
  | "cloud-lightning"

export interface WeatherSnapshot {
  temperatureC: number
  windKph: number
  label: string
  icon: WeatherIcon
  locationName: string
  fetchedAt: string // ISO timestamp
}

// WMO weather codes, as returned by Open-Meteo's `current.weather_code`.
function describeWeatherCode(code: number): { label: string; icon: WeatherIcon } {
  if (code === 0) return { label: "Clear", icon: "sun" }
  if (code === 1 || code === 2) return { label: "Partly cloudy", icon: "cloud-sun" }
  if (code === 3) return { label: "Overcast", icon: "cloud" }
  if (code === 45 || code === 48) return { label: "Fog", icon: "cloud-fog" }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { label: "Rain", icon: "cloud-rain" }
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "Snow", icon: "cloud-snow" }
  if (code === 95 || code === 96 || code === 99) return { label: "Thunderstorms", icon: "cloud-lightning" }
  return { label: "Unknown", icon: "cloud" }
}

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

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    )
    if (!res.ok) return "Current location"
    const place = await res.json()
    return place.city || place.locality || place.principalSubdivision || "Current location"
  } catch {
    return "Current location"
  }
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherSnapshot> {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=celsius&wind_speed_unit=kmh`

  const [weatherRes, locationName] = await Promise.all([fetch(weatherUrl), reverseGeocode(lat, lon)])

  if (!weatherRes.ok) throw new Error("Weather service unavailable.")
  const data = await weatherRes.json()
  const current = data.current
  const { label, icon } = describeWeatherCode(current.weather_code)

  return {
    temperatureC: current.temperature_2m,
    windKph: current.wind_speed_10m,
    label,
    icon,
    locationName,
    fetchedAt: new Date().toISOString(),
  }
}
