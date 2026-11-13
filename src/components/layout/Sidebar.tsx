import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

type NavItem = {
  to: "/bookings" | "/deals"
  label: string
  icon: ReactNode
}

const calendarIcon = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-[18px]" aria-hidden="true">
    <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
    <path d="M3 8.5h14M7 2.75v3.5M13 2.75v3.5" strokeLinecap="round" />
  </svg>
)

const tableIcon = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-[18px]" aria-hidden="true">
    <rect x="3" y="3.5" width="14" height="13" rx="2.5" />
    <path d="M3 8h14M3 12.25h14M8 8v8.5" strokeLinecap="round" />
  </svg>
)

const nav: NavItem[] = [
  { to: "/bookings", label: "Bookings", icon: calendarIcon },
  { to: "/deals", label: "Deals", icon: tableIcon },
]

function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-svh w-60 shrink-0 flex-col border-r border-line bg-canvas">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-5">
        <span className="grid size-7 place-items-center rounded-lg bg-ink text-xs font-semibold text-surface" aria-hidden="true">UI</span>
        <span className="font-semibold tracking-[-0.01em] text-ink">UI SDK Playground</span>
      </div>

      <nav aria-label="Main" className="grid gap-0.5 px-3 py-4">
        <span className="px-2 pb-1.5 text-[13px] font-medium text-muted">Components</span>
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex h-9 items-center gap-2.5 rounded-lg px-2 text-body transition-colors duration-150 hover:bg-line-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[status=active]:bg-ink data-[status=active]:font-medium data-[status=active]:text-surface data-[status=active]:shadow-soft data-[status=active]:hover:bg-ink"
          >
            <span className="text-muted in-data-[status=active]:text-surface">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}

export { Sidebar }
