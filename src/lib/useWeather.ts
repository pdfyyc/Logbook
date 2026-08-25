import { useCallback, useEffect, useState } from "react"
import { loadWeatherCache, saveWeatherCache } from "./storage"
import { fetchWeather, getCurrentPosition, isPermissionDeniedError, type WeatherSnapshot } from "./weather"

export type WeatherState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "error" }
  | { status: "ready"; snapshot: WeatherSnapshot; refreshing: boolean }

export function useWeather() {
  const [state, setState] = useState<WeatherState>(() => {
    const cached = loadWeatherCache()
    return cached ? { status: "ready", snapshot: cached, refreshing: false } : { status: "loading" }
  })

  // Kicks off the fetch without touching state synchronously — safe to call
  // from the mount effect, since the initial state already reflects loading.
  const load = useCallback(() => {
    getCurrentPosition()
      .then((pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude))
      .then((snapshot) => {
        saveWeatherCache(snapshot)
        setState({ status: "ready", snapshot, refreshing: false })
      })
      .catch((err: unknown) => {
        if (!("geolocation" in navigator)) {
          setState({ status: "unsupported" })
          return
        }
        if (isPermissionDeniedError(err)) {
          setState({ status: "denied" })
          return
        }
        setState((prev) => (prev.status === "ready" ? { ...prev, refreshing: false } : { status: "error" }))
      })
  }, [])

  // For the retry/refresh button — sets a loading/refreshing state immediately
  // in response to the user's click, then reuses the same fetch.
  const refresh = useCallback(() => {
    setState((prev) => (prev.status === "ready" ? { ...prev, refreshing: true } : { status: "loading" }))
    load()
  }, [load])

  useEffect(() => {
    load()
  }, [load])

  return { state, refresh }
}
