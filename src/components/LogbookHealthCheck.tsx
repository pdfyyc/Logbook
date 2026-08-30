import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react"
import type { Aircraft, Flight } from "../types"
import { checkLogbookHealth } from "../lib/healthCheck"
import { Card } from "./ui/Card"
import { Badge } from "./ui/Badge"

interface Props {
  flights: Flight[]
  aircraftById: Map<string, Aircraft>
  onReviewFlight: (flight: Flight, suggestion: string) => void
}

export function LogbookHealthCheck({ flights, aircraftById, onReviewFlight }: Props) {
  const issues = checkLogbookHealth(flights, aircraftById)
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        {issues.length === 0 ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertTriangle size={16} className="text-amber-500" />}
        <h3 className="text-sm font-semibold text-[var(--text)]">Logbook health check</h3>
        <Badge tone={issues.length === 0 ? "success" : "warning"}>{issues.length === 0 ? "No issues found" : `${issues.length} to review`}</Badge>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Checks data consistency and possible duplicates. Review flags before relying on an entry for an application or recency decision.
      </p>
      {issues.length > 0 && (
        <ul className="mt-3 space-y-2">
          {issues.map((issue) => (
            <li key={issue.id} className="flex gap-2 rounded-lg border border-[var(--border)] p-2.5">
              <CircleAlert size={15} className={issue.level === "error" ? "mt-0.5 shrink-0 text-red-500" : "mt-0.5 shrink-0 text-amber-500"} />
              <div>
                <p className="text-xs font-medium text-[var(--text)]">{issue.title}</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{issue.detail}</p>
                <p className="mt-1 text-xs text-[var(--text)]"><strong>Suggested review:</strong> {issue.suggestion}</p>
                <div className="mt-2 flex flex-wrap gap-2">{issue.flightIds.map((id, index) => { const flight = flights.find((item) => item.id === id); return flight && <button key={id} type="button" onClick={() => onReviewFlight(flight, issue.suggestion)} className="text-xs font-medium text-[var(--accent)] hover:underline">Review flight{issue.flightIds.length > 1 ? ` ${index + 1}` : ""}</button> })}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
