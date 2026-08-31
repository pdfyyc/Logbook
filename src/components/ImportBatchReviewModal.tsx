import type { Flight, ImportBatch } from "../types";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
interface Props {
  batches: ImportBatch[];
  flights: Flight[];
  onClose: () => void;
  onFindFlight: (flight: Flight) => void;
}
export function ImportBatchReviewModal({
  batches,
  flights,
  onClose,
  onFindFlight,
}: Props) {
  return (
    <Modal
      title="Previous import batches"
      onClose={onClose}
      wide
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <p className="text-xs text-[var(--text-muted)]">
        Batch history is review-only. Correct individual flights so later
        amendments and aircraft relationships remain intact.
      </p>
      <div className="mt-4 space-y-3">
        {batches.length === 0 ? (
          <p className="text-sm">No completed imports.</p>
        ) : (
          batches
            .slice()
            .reverse()
            .map((batch) => (
              <details
                key={batch.id}
                className="rounded-lg border border-[var(--border)] p-3"
              >
                <summary className="cursor-pointer">
                  <strong>{batch.sourceFilename}</strong> ·{" "}
                  {new Date(batch.importedAt).toLocaleString()}
                  <p className="text-xs text-[var(--text-muted)]">
                    {batch.acceptedRows} accepted · {batch.rejectedRows}{" "}
                    rejected · {batch.skippedRows} skipped ·{" "}
                    {batch.warningCount} warnings
                  </p>
                </summary>
                <div className="mt-3 border-t border-[var(--border)] pt-3 text-xs">
                  <p>
                    Format: {batch.detectedFormat} · Source rows:{" "}
                    {batch.rowCount} · Duplicates: {batch.duplicateRows}
                  </p>
                  <p>
                    Reconciliation mismatch confirmed:{" "}
                    {batch.reconciliation.confirmedMismatch ? "Yes" : "No"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {batch.flightIds.map((id) => {
                      const flight = flights.find((item) => item.id === id);
                      return (
                        flight && (
                          <Button
                            key={id}
                            variant="secondary"
                            onClick={() => onFindFlight(flight)}
                          >
                            {flight.date} {flight.from} → {flight.to}
                          </Button>
                        )
                      );
                    })}
                  </div>
                </div>
              </details>
            ))
        )}
      </div>
    </Modal>
  );
}
