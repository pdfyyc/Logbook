import { useCallback, useEffect, useState } from "react"
import { getCurrentPosition, isPermissionDeniedError } from "./geo"

export type GeoState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "error" }
  | { status: "ready"; lat: number; lon: number }

/** Requests the browser's location once and shares the result — used so the
 *  weather and GFA widgets ask for permission a single time, not each. */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: "loading" })

  const load = useCallback(() => {
    getCurrentPosition()
      .then((pos) => setState({ status: "ready", lat: pos.coords.latitude, lon: pos.coords.longitude }))
      .catch((err: unknown) => {
        if (!("geolocation" in navigator)) {
          setState({ status: "unsupported" })
          return
        }
        if (isPermissionDeniedError(err)) {
          setState({ status: "denied" })
          return
        }
        setState({ status: "error" })
      })
  }, [])

  const refresh = useCallback(() => {
    setState({ status: "loading" })
    load()
  }, [load])

  useEffect(() => {
    load()
  }, [load])

  return { state, refresh }
}
