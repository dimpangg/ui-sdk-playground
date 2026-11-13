import { getRouteApi } from "@tanstack/react-router"
import { Toolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator } from "@ui-sdk/react/toolbar"
import { useMemo, useState } from "react"
import {
  BookingCalendar,
  BookingEditor,
  formatDuration,
  formatMinutes,
  isoDay,
  longFmt,
  rangeFmt,
  weekDays,
  type Booking,
} from "../components/booking-calendar"
import { buttonClass } from "../components/ui/button"

const route = getRouteApi("/bookings")

const DAY_START = 8 * 60
const DAY_END = 20 * 60
const MIN_DURATION = 30

function seed(days: string[]): Booking[] {
  return [
    { id: "b1", track: days[0], start: 9 * 60, end: 10 * 60 + 30, title: "Studio A, Rina" },
    { id: "b2", track: days[1], start: 13 * 60, end: 15 * 60, title: "Consultation" },
    { id: "b3", track: days[2], start: 10 * 60, end: 11 * 60, title: "Court 2, Dimas" },
    { id: "b4", track: days[3], start: 16 * 60, end: 18 * 60 + 30, title: "Workshop" },
    { id: "b5", track: days[4], start: 8 * 60 + 30, end: 9 * 60 + 15, title: "Check-in call" },
  ]
}

const parseDay = (id: string) => {
  const [y, m, d] = id.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** Why a booking can't take these times, or null when it can. */
function rejectTimes(list: Booking[], next: Booking) {
  if (next.end - next.start < MIN_DURATION) return `Bookings last at least ${MIN_DURATION} minutes.`
  if (next.start < DAY_START || next.end > DAY_END)
    return `Bookable hours are ${formatMinutes(DAY_START)}–${formatMinutes(DAY_END)}.`
  const clash = list.find((b) => b.id !== next.id && b.track === next.track && b.start < next.end && next.start < b.end)
  return clash ? `Overlaps “${clash.title || "Untitled"}”.` : null
}

const chevron = (d: string) => (
  <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function BookingsPage() {
  const { week } = route.useSearch()
  const navigate = route.useNavigate()
  const [today] = useState(() => isoDay(new Date()))
  const days = useMemo(() => weekDays(parseDay(week ?? today)), [week, today])
  const [bookings, setBookings] = useState<Booking[]>(() => seed(weekDays(parseDay(today)).map(isoDay)))
  const [selected, setSelected] = useState<string | undefined>()
  const [editing, setEditing] = useState(false)
  const [justDrawn, setJustDrawn] = useState(false)

  const dayIds = days.map(isoDay)
  const dayLabel = (id: string) => longFmt.format(parseDay(id))
  const inWeek = bookings.filter((b) => dayIds.includes(b.track))
  const weekTotal = inWeek.reduce((sum, b) => sum + b.end - b.start, 0)
  const isThisWeek = dayIds.includes(today)

  const goToWeek = (delta: number) => {
    const monday = new Date(days[0])
    monday.setDate(monday.getDate() + delta * 7)
    setEditing(false)
    navigate({ search: { week: delta === 0 ? undefined : isoDay(monday) } })
  }

  const select = (id: string) => {
    setSelected(id)
    setJustDrawn(false)
    setEditing(true)
  }

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-6">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-[-0.01em] text-ink">Bookings</h1>
          <span className="truncate text-[15px] text-muted tabular-nums">
            {inWeek.length} booked · {formatDuration(weekTotal) || "0h"}
          </span>
        </div>

        <Toolbar aria-label="Week" className="flex items-center gap-2">
          <ToolbarButton
            className={buttonClass("secondary", "data-disabled:cursor-default data-disabled:text-muted data-disabled:hover:bg-surface data-disabled:active:scale-100")}
            onClick={() => goToWeek(0)}
            disabled={isThisWeek && !week}
          >
            Today
          </ToolbarButton>
          <ToolbarGroup aria-label="Change week" className="flex items-center rounded-lg border border-line bg-surface shadow-soft">
            <ToolbarButton className={buttonClass("ghost", "w-9 rounded-r-none px-0")} onClick={() => goToWeek(-1)} aria-label="Previous week">
              {chevron("M10 4L6 8l4 4")}
            </ToolbarButton>
            <ToolbarSeparator className="h-5 w-px bg-line" />
            <ToolbarButton className={buttonClass("ghost", "w-9 rounded-l-none px-0")} onClick={() => goToWeek(1)} aria-label="Next week">
              {chevron("M6 4l4 4-4 4")}
            </ToolbarButton>
          </ToolbarGroup>
          <span className="min-w-36 text-[15px] font-medium text-ink tabular-nums" aria-live="polite">
            {rangeFmt.format(days[0])} – {rangeFmt.format(days[6])}, {days[6].getFullYear()}
          </span>
        </Toolbar>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-6">
        <p className="text-[13px] text-muted">
          Drag on empty time to book. Drag a booking to move it, stretch its edges to resize, click it to edit.
        </p>
        <BookingCalendar
          days={days}
          today={today}
          bookings={bookings}
          dayStart={DAY_START}
          dayEnd={DAY_END}
          minDuration={MIN_DURATION}
          onBookingsChange={(value, details) => {
            setBookings(value)
            if (details.action === "draw") {
              setSelected(details.id)
              setJustDrawn(true)
              setEditing(true)
            }
            if (details.action === "delete" && details.id === selected) {
              setSelected(undefined)
              setEditing(false)
            }
          }}
          selected={selected}
          onSelect={select}
          describe={(b) => `${b.title || "Untitled"}, ${dayLabel(b.track)}, ${formatMinutes(b.start)} to ${formatMinutes(b.end)}`}
        />
      </div>

      <BookingEditor
        booking={bookings.find((b) => b.id === selected)}
        open={editing}
        onOpenChange={setEditing}
        focusTitle={justDrawn}
        dayLabel={dayLabel}
        onChange={(id, patch) => {
          const current = bookings.find((b) => b.id === id)
          if (!current) return null
          const next = { ...current, ...patch }
          const problem = patch.start !== undefined || patch.end !== undefined ? rejectTimes(bookings, next) : null
          if (!problem) setBookings((list) => list.map((b) => (b.id === id ? next : b)))
          return problem
        }}
        onDelete={(id) => {
          setBookings((list) => list.filter((b) => b.id !== id))
          setSelected(undefined)
          setEditing(false)
        }}
      />
    </div>
  )
}

export default BookingsPage
