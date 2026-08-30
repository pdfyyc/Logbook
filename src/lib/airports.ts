import { nearestByLatLon } from "./geo"

export interface Airport {
  icao: string
  name: string
  lat: number
  lon: number
}

// A curated set of major Canadian airports/aerodromes for "nearest airport"
// lookups — not the full Canada Flight Supplement. Coordinates are
// approximate (airport reference points, ~1 km precision), fine for ranking
// but not for navigation. Any ICAO code can still be looked up manually even
// if it isn't in this list.
export const CANADIAN_AIRPORTS: Airport[] = [
  { icao: "CYVR", name: "Vancouver Intl", lat: 49.19, lon: -123.18 },
  { icao: "CYYJ", name: "Victoria Intl", lat: 48.65, lon: -123.43 },
  { icao: "CYCD", name: "Nanaimo", lat: 49.05, lon: -123.87 },
  { icao: "CYXX", name: "Abbotsford", lat: 49.03, lon: -122.36 },
  { icao: "CYLW", name: "Kelowna", lat: 49.96, lon: -119.38 },
  { icao: "CYKA", name: "Kamloops", lat: 50.7, lon: -120.44 },
  { icao: "CYXS", name: "Prince George", lat: 53.89, lon: -122.68 },
  { icao: "CYPR", name: "Prince Rupert", lat: 54.29, lon: -130.45 },
  { icao: "CYXC", name: "Cranbrook", lat: 49.61, lon: -115.78 },
  { icao: "CYDQ", name: "Dawson Creek", lat: 55.74, lon: -120.18 },
  { icao: "CYYC", name: "Calgary Intl", lat: 51.11, lon: -114.02 },
  { icao: "CYEG", name: "Edmonton Intl", lat: 53.31, lon: -113.58 },
  { icao: "CYQF", name: "Red Deer", lat: 52.18, lon: -113.9 },
  { icao: "CYQL", name: "Lethbridge", lat: 49.63, lon: -112.8 },
  { icao: "CYMM", name: "Fort McMurray", lat: 56.65, lon: -111.22 },
  { icao: "CYQU", name: "Grande Prairie", lat: 55.18, lon: -118.89 },
  { icao: "CYXH", name: "Medicine Hat", lat: 50.02, lon: -110.72 },
  { icao: "CYXE", name: "Saskatoon", lat: 52.17, lon: -106.7 },
  { icao: "CYQR", name: "Regina", lat: 50.43, lon: -104.67 },
  { icao: "CYWG", name: "Winnipeg / Richardson Intl", lat: 49.91, lon: -97.24 },
  { icao: "CYBR", name: "Brandon", lat: 49.91, lon: -99.95 },
  { icao: "CYYZ", name: "Toronto / Pearson Intl", lat: 43.68, lon: -79.63 },
  { icao: "CYTZ", name: "Toronto / Billy Bishop", lat: 43.63, lon: -79.4 },
  { icao: "CYHM", name: "Hamilton", lat: 43.17, lon: -79.93 },
  { icao: "CYKF", name: "Kitchener/Waterloo", lat: 43.46, lon: -80.38 },
  { icao: "CYQG", name: "Windsor", lat: 42.28, lon: -82.96 },
  { icao: "CYGK", name: "Kingston", lat: 44.23, lon: -76.6 },
  { icao: "CYOO", name: "Oshawa", lat: 43.92, lon: -78.9 },
  { icao: "CYPQ", name: "Peterborough", lat: 44.23, lon: -78.37 },
  { icao: "CYSB", name: "Sudbury", lat: 46.63, lon: -80.8 },
  { icao: "CYAM", name: "Sault Ste. Marie", lat: 46.48, lon: -84.51 },
  { icao: "CYQT", name: "Thunder Bay", lat: 48.37, lon: -89.32 },
  { icao: "CYOW", name: "Ottawa / Macdonald-Cartier", lat: 45.32, lon: -75.67 },
  { icao: "CYUL", name: "Montreal / Trudeau", lat: 45.47, lon: -73.74 },
  { icao: "CYHU", name: "Montreal / Saint-Hubert", lat: 45.52, lon: -73.42 },
  { icao: "CYQB", name: "Quebec City / Jean Lesage", lat: 46.79, lon: -71.39 },
  { icao: "CYBG", name: "Bagotville", lat: 48.33, lon: -70.997 },
  { icao: "CYGP", name: "Gaspe", lat: 48.78, lon: -64.48 },
  { icao: "CYVO", name: "Val-d'Or", lat: 48.05, lon: -77.78 },
  { icao: "CYGV", name: "Havre-Saint-Pierre", lat: 50.28, lon: -63.61 },
  { icao: "CYHZ", name: "Halifax / Stanfield Intl", lat: 44.88, lon: -63.51 },
  { icao: "CYQY", name: "Sydney, NS", lat: 46.16, lon: -60.05 },
  { icao: "CYFC", name: "Fredericton", lat: 45.87, lon: -66.53 },
  { icao: "CYSJ", name: "Saint John, NB", lat: 45.32, lon: -65.89 },
  { icao: "CYQM", name: "Moncton", lat: 46.11, lon: -64.68 },
  { icao: "CYYG", name: "Charlottetown", lat: 46.29, lon: -63.12 },
  { icao: "CYYT", name: "St. John's, NL", lat: 47.62, lon: -52.75 },
  { icao: "CYDF", name: "Deer Lake, NL", lat: 49.21, lon: -57.39 },
  { icao: "CYQX", name: "Gander", lat: 48.94, lon: -54.57 },
  { icao: "CYYR", name: "Goose Bay", lat: 53.32, lon: -60.43 },
  { icao: "CYFB", name: "Iqaluit", lat: 63.76, lon: -68.56 },
  { icao: "CYRB", name: "Resolute Bay", lat: 74.72, lon: -94.97 },
  { icao: "CYCB", name: "Cambridge Bay", lat: 69.11, lon: -105.14 },
  { icao: "CYZF", name: "Yellowknife", lat: 62.46, lon: -114.44 },
  { icao: "CYSM", name: "Fort Smith, NT", lat: 60.02, lon: -111.96 },
  { icao: "CYVQ", name: "Norman Wells", lat: 65.28, lon: -126.8 },
  { icao: "CYXY", name: "Whitehorse", lat: 60.71, lon: -135.07 },
  { icao: "CYDA", name: "Dawson City", lat: 64.04, lon: -139.13 },
]

export function nearestAirport(lat: number, lon: number, airports: Airport[] = CANADIAN_AIRPORTS): Airport {
  return nearestByLatLon(lat, lon, airports)
}
