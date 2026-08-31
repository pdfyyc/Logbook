import type { ButtonHTMLAttributes } from "react"

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gradient"

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-white hover:brightness-110 shadow-sm shadow-sky-900/10",
  secondary:
    "bg-[var(--bg-inset)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--border)]/40",
  ghost: "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-inset)]",
  danger: "bg-red-600 text-white hover:bg-red-700",
  gradient:
    "bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] text-white hover:brightness-110 shadow-lg shadow-black/10",
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  pill?: boolean
}

export function Button({ variant = "primary", pill = false, className = "", ...rest }: Props) {
  const shape = pill ? "min-h-11 rounded-full px-5 py-3" : "min-h-11 rounded-lg px-3.5 py-2"
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 ${shape} text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${variantClasses[variant]} ${className}`}
      {...rest}
    />
  )
}
