import { useEffect, useState } from "react"
import { loadWeatherCache, saveWeatherCache } from "./storage"
import { fetchWeather, type WeatherSnapshot } from "./weather"

export type WeatherFetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; snapshot: WeatherSnapshot; refreshing: boolean }

export function useWeather(lat: number, lon: number) {
  const [state, setState] = useState<WeatherFetchState>(() => {
    const cached = loadWeatherCache()
    return cached ? { status: "ready", snapshot: cached, refreshing: false } : { status: "loading" }
  })

  useEffect(() => {
    let cancelled = false
    fetchWeather(lat, lon)
      .then((snapshot) => {
        if (cancelled) return
        saveWeatherCache(snapshot)
        setState({ status: "ready", snapshot, refreshing: false })
      })
      .catch(() => {
        if (cancelled) return
        setState((prev) => (prev.status === "ready" ? { ...prev, refreshing: false } : { status: "error" }))
      })
    return () => {
      cancelled = true
    }
  }, [lat, lon])

  function retry() {
    setState((prev) => (prev.status === "ready" ? { ...prev, refreshing: true } : { status: "loading" }))
    fetchWeather(lat, lon)
      .then((snapshot) => {
        saveWeatherCache(snapshot)
        setState({ status: "ready", snapshot, refreshing: false })
      })
      .catch(() => {
        setState((prev) => (prev.status === "ready" ? { ...prev, refreshing: false } : { status: "error" }))
      })
  }

  return { state, retry }
}
