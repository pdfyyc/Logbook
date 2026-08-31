import { useEffect, type ReactNode } from "react"
import { X } from "lucide-react"

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function Modal({ title, onClose, children, footer, wide }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`flex max-h-[100dvh] min-w-0 w-full flex-col rounded-t-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl sm:max-h-[90vh] sm:rounded-2xl ${wide ? "max-w-3xl" : "max-w-md"}`}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 id="modal-title" className="text-base font-semibold text-[var(--text)]">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text)] cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-w-0 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && (
          <div className="flex max-h-[32vh] flex-wrap justify-end gap-2 overflow-y-auto border-t border-[var(--border)] px-4 py-3 sm:px-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
