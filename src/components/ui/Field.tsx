import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react"

interface FieldProps {
  label: string
  children: ReactNode
  className?: string
  error?: string
}

export function Field({ label, children, className = "", error }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
      {children}
      {error && <span className="text-xs text-red-500" role="alert">{error}</span>}
    </label>
  )
}

const inputClass =
  "min-h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-base text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] sm:text-sm"

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />
}
