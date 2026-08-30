import { CloudDrizzle, ExternalLink, MapPinned, Snowflake } from "lucide-react"
import { nearestGfaRegion } from "../lib/gfaRegions"
import { Card } from "./ui/Card"

const NAV_CANADA_URL = "https://plan.navcanada.ca"

interface Props {
  lat: number
  lon: number
}

export function GfaWidget({ lat, lon }: Props) {
  const region = nearestGfaRegion(lat, lon)

  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
        <MapPinned size={12} />
        Nearest GFA graphical area
      </div>
      <p className="mt-1 text-sm font-semibold text-[var(--text)]">
        {region.name} <span className="font-mono text-xs font-normal text-[var(--text-muted)]">({region.code})</span>
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <a
          href={NAV_CANADA_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--border)]/40"
        >
          <span className="flex items-center gap-2">
            <CloudDrizzle size={15} className="text-[var(--accent)]" />
            Clouds & weather
          </span>
          <ExternalLink size={13} className="text-[var(--text-muted)]" />
        </a>
        <a
          href={NAV_CANADA_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--border)]/40"
        >
          <span className="flex items-center gap-2">
            <Snowflake size={15} className="text-[var(--accent)]" />
            Icing, turb & fzg level
          </span>
          <ExternalLink size={13} className="text-[var(--text-muted)]" />
        </a>
      </div>

      <p className="mt-2 text-[10px] text-[var(--text-muted)]">
        Opens NAV CANADA's official GFA viewer — select {region.name} there for the current chart. Region is an
        approximate GPS match, not an authoritative boundary.
      </p>
    </Card>
  )
}
