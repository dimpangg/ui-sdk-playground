import type { CSSProperties } from "react"
import { formatMinutes, type Booking, type BookingsChangeDetails } from "./booking-calendar"
import {
  BookingCalendarBooking,
  BookingCalendarEdge,
  BookingCalendarRoot,
  BookingCalendarTrack,
} from "./booking-calendar-parts"
import { formatDuration, isoDay, weekdayFmt } from "./dates"

type BookingCalendarProps = {
  days: Date[]
  today: string
  bookings: Booking[]
  onBookingsChange: (value: Booking[], details: BookingsChangeDetails) => void
  selected?: string
  onSelect: (id: string) => void
  describe: (booking: Booking) => string
  dayStart?: number
  dayEnd?: number
  step?: number
  minDuration?: number
}

const edgeClass =
  "absolute inset-x-0 h-2.5 cursor-ns-resize after:absolute after:left-1/2 after:h-1 after:w-7 after:-translate-x-1/2 after:rounded-full after:bg-current after:opacity-0 after:transition-opacity after:duration-150 group-hover/booking:after:opacity-45 group-data-resizing/booking:after:opacity-45 motion-reduce:after:transition-none"

function BookingCalendar({
  days,
  today,
  bookings,
  onBookingsChange,
  selected,
  onSelect,
  describe,
  dayStart = 8 * 60,
  dayEnd = 20 * 60,
  step = 15,
  minDuration = 30,
}: BookingCalendarProps) {
  const dayIds = days.map(isoDay)
  const hours = Array.from({ length: (dayEnd - dayStart) / 60 }, (_, i) => dayStart + i * 60)

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-surface shadow-soft">
      <BookingCalendarRoot
        role="group"
        aria-label="Weekly booking calendar"
        className="group/cal grid min-w-[900px] has-[[data-dragging]]:cursor-grabbing has-[[data-resizing]]:cursor-ns-resize grid-cols-[64px_repeat(7,minmax(112px,1fr))] grid-rows-[auto_calc(var(--hours)*var(--hour))] pb-3 [--hour:60px]"
        style={{ "--hours": hours.length } as CSSProperties}
        bookings={bookings}
        onBookingsChange={onBookingsChange}
        days={dayIds}
        dayStart={dayStart}
        dayEnd={dayEnd}
        step={step}
        minDuration={minDuration}
        selected={selected}
        onSelect={onSelect}
        describe={describe}
      >
        <div className="sticky top-0 left-0 z-40 border-b border-line bg-surface" />
        {days.map((day) => {
          const id = isoDay(day)
          const isToday = id === today
          return (
            <div
              key={id}
              className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-l border-line bg-surface px-3 text-[13px] font-medium tracking-wide text-muted uppercase"
            >
              {weekdayFmt.format(day)}
              <span
                className={`grid h-7 min-w-7 place-items-center rounded-md px-1 text-[15px] font-semibold tracking-normal tabular-nums normal-case ${isToday ? "bg-accent text-white dark:text-[#111113]" : "text-ink"}`}
                aria-current={isToday ? "date" : undefined}
              >
                {day.getDate()}
              </span>
            </div>
          )
        })}

        <div
          className="sticky left-0 z-20 grid grid-rows-[repeat(var(--hours),1fr)] bg-surface text-[12px] text-muted tabular-nums"
          aria-hidden="true"
        >
          {hours.map((m, i) => (
            <span key={m} className={`pr-3 text-right ${i === 0 ? "pt-1" : "-translate-y-[0.65em]"}`}>
              {formatMinutes(m)}
            </span>
          ))}
        </div>

        {dayIds.map((id) => (
          <BookingCalendarTrack
            key={id}
            value={id}
            className={`hour-grid relative cursor-crosshair touch-none border-l border-line transition-colors duration-150 group-has-[[data-dragging]]/cal:cursor-grabbing has-[[data-dragging]]:bg-ink/[0.035] dark:has-[[data-dragging]]:bg-white/[0.04] motion-reduce:transition-none ${id === today ? "bg-accent-soft/50" : ""}`}
          >
            {({ bookings: onDay }) =>
              onDay.map((b) => (
                <BookingCalendarBooking
                  key={b.id}
                  value={b.id}
                  className={[
                    "group/booking inset-x-1 flex cursor-grab touch-none flex-col gap-0.5 overflow-hidden rounded-md border border-event-line bg-event px-2 py-1.5 text-ink shadow-soft select-none",
                    "transition-[box-shadow,scale,opacity,background-color,border-color] duration-150 ease-out motion-reduce:transition-none",
                    "hover:bg-event-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink",
                    // Selected: solid ink, the one strong mark on the grid.
                    "data-selected:z-10 data-selected:border-ink data-selected:bg-ink data-selected:text-white dark:data-selected:text-[#111113]",
                    // Dragging: lifted off the grid, the rest of the week steps back.
                    "group-has-[[data-dragging]]/cal:opacity-45 data-dragging:z-30 data-dragging:scale-[1.03] data-dragging:cursor-grabbing data-dragging:border-ink data-dragging:bg-ink data-dragging:text-white data-dragging:opacity-100 data-dragging:shadow-lift dark:data-dragging:text-[#111113] motion-reduce:data-dragging:scale-100",
                    // Resizing: same lift, no scale so the edge stays under the pointer.
                    "group-has-[[data-resizing]]/cal:opacity-45 data-resizing:z-30 data-resizing:border-ink data-resizing:opacity-100 data-resizing:shadow-lift",
                    // Drawing: a dashed outline until the pointer lets go.
                    "data-drawing:border-dashed data-drawing:border-ink/50 data-drawing:bg-ink/[0.04] data-drawing:shadow-none dark:data-drawing:border-white/50 dark:data-drawing:bg-white/[0.06]",
                  ].join(" ")}
                >
                  {({ booking, action }) =>
                    booking && (
                      <>
                        <BookingCalendarEdge side="start" className={`${edgeClass} top-0 after:top-0.75`} />
                        <span className="truncate text-[13px] leading-snug font-semibold">{booking.title || "Untitled"}</span>
                        <span className="truncate text-[12px] tabular-nums opacity-75">
                          {formatMinutes(booking.start)} – {formatMinutes(booking.end)}
                          {action ? ` · ${formatDuration(booking.end - booking.start)}` : ""}
                        </span>
                        <BookingCalendarEdge side="end" className={`${edgeClass} bottom-0 after:bottom-0.75`} />
                      </>
                    )
                  }
                </BookingCalendarBooking>
              ))
            }
          </BookingCalendarTrack>
        ))}
      </BookingCalendarRoot>
    </div>
  )
}

export { BookingCalendar, type BookingCalendarProps }
