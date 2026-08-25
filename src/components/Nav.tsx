import { BookOpen, Home, Moon, Plane, Sun, UserCircle2 } from "lucide-react"

export type Tab = "dashboard" | "logbook" | "aircraft" | "profile"

const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Home", icon: Home },
  { id: "logbook", label: "Logbook", icon: BookOpen },
  { id: "aircraft", label: "Aircraft", icon: Plane },
  { id: "profile", label: "Profile", icon: UserCircle2 },
]

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
  theme: "light" | "dark"
  onToggleTheme: () => void
}

export function Nav({ active, onChange, theme, onToggleTheme }: Props) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-elevated)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)] text-white">
              <Plane size={16} />
            </span>
            Logbook
          </div>

          <nav className="ml-2 hidden flex-1 items-center gap-1 sm:flex">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onChange(id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  active === id
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text)]"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>

          <span className="flex-1 sm:hidden" />

          <button
            onClick={onToggleTheme}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text)] cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 backdrop-blur sm:hidden">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors cursor-pointer ${
                isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
              }`}
            >
              <span
                className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors ${
                  isActive ? "bg-[var(--accent-soft)]" : ""
                }`}
              >
                <Icon size={18} />
              </span>
              {label}
            </button>
          )
        })}
      </nav>
    </>
  )
}
