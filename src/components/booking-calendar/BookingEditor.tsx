import { Button } from "@ui-sdk/react/button"
import { Field, FieldLabel } from "@ui-sdk/react/field"
import { Input } from "@ui-sdk/react/input"
import { Popover, PopoverClose, PopoverContent, PopoverTitle } from "@ui-sdk/react/popover"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control"
import { Separator } from "@ui-sdk/react/separator"
import { TimeInput, TimeInputSegment, type TimeInputSegmentData } from "@ui-sdk/react/time-input"
import { useState } from "react"
import { buttonClass } from "../ui/button"
import { formatMinutes, type Booking } from "./booking-calendar"
import { formatDuration } from "./dates"

type BookingEditorProps = {
  booking?: Booking
  open: boolean
  onOpenChange: (open: boolean) => void
  dayLabel: (id: string) => string
  /** Applies a change, or returns why it can't. */
  onChange: (id: string, patch: Partial<Omit<Booking, "id">>) => string | null
  onDelete: (id: string) => void
  /** Puts focus in the title, for a booking that was just drawn. */
  focusTitle?: boolean
}

const parseTime = (value: string | null) => {
  const match = value?.match(/^(\d{2}):(\d{2})/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

const fieldLabel = "text-[13px] font-medium text-muted"
const control =
  "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[15px] text-ink shadow-soft transition-[border-color,box-shadow] duration-150 outline-none focus:border-accent focus:ring-3 focus:ring-accent/15"
const timeControl = `${control} flex items-center tabular-nums focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15 data-invalid:border-danger`
const segment =
  "rounded px-px outline-none focus:bg-accent focus:text-white data-empty:text-muted data-[type=literal]:px-0 data-[type=literal]:text-muted"
const durations = [30, 60, 90, 120]

const renderSegments = ({ segments }: { segments: TimeInputSegmentData[] }) =>
  segments.map((s) => <TimeInputSegment key={s.key} segment={s} className={`${segment} box-content w-[2ch] text-center`} />)

function BookingEditor({ booking, open, onOpenChange, dayLabel, onChange, onDelete, focusTitle }: BookingEditorProps) {
  return (
    <Popover open={open && !!booking} onOpenChange={onOpenChange}>
      {booking && (
        <PopoverContent
          anchor={`[data-span-id="${booking.id}"]`}
          side="right"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          initialFocus={focusTitle ? "input[data-slot=input]" : "none"}
          finalFocus="none"
          className="z-50 w-80 origin-(--transform-origin) rounded-xl border border-line bg-surface p-4 text-body shadow-popover transition-[opacity,scale] duration-150 ease-out-strong data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0 motion-reduce:transition-none"
        >
          <EditorBody
            booking={booking}
            dayLabel={dayLabel}
            onChange={onChange}
            onDelete={onDelete}
          />
        </PopoverContent>
      )}
    </Popover>
  )
}

function EditorBody({ booking, dayLabel, onChange, onDelete }: Pick<BookingEditorProps, "dayLabel" | "onChange" | "onDelete"> & { booking: Booking }) {
  const [draft, setDraft] = useState({ start: formatMinutes(booking.start), end: formatMinutes(booking.end) })
  const [seen, setSeen] = useState({ id: booking.id, start: booking.start, end: booking.end })
  const [error, setError] = useState<string | null>(null)

  // A drag, an arrow key or another booking replaced the times: show the new ones.
  if (seen.id !== booking.id || seen.start !== booking.start || seen.end !== booking.end) {
    setSeen({ id: booking.id, start: booking.start, end: booking.end })
    setDraft({ start: formatMinutes(booking.start), end: formatMinutes(booking.end) })
    setError(null)
  }

  const commitTimes = (next: { start: string; end: string }) => {
    setDraft(next)
    const start = parseTime(next.start)
    const end = parseTime(next.end)
    if (start === null || end === null) return
    setError(onChange(booking.id, { start, end }))
  }

  const length = booking.end - booking.start

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PopoverTitle className="text-[15px] font-semibold text-ink">Edit booking</PopoverTitle>
          <p className="mt-0.5 text-[13px] text-muted">{dayLabel(booking.track)}</p>
        </div>
        <PopoverClose
          aria-label="Close"
          className={buttonClass("ghost", "-mt-1.5 -mr-2 size-8 px-0 text-muted")}
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </PopoverClose>
      </div>

      <Field className="grid gap-1.5">
        <FieldLabel className={fieldLabel}>Title</FieldLabel>
        <Input
          className={control}
          value={booking.title}
          placeholder="Untitled"
          onValueChange={(title) => onChange(booking.id, { title })}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
          }}
        />
      </Field>

      <div className="grid gap-1.5">
        <div className="grid grid-cols-2 gap-2">
          <Field className="grid gap-1.5">
            <FieldLabel className={fieldLabel}>Start</FieldLabel>
            <TimeInput
              className={timeControl}
              hourCycle={24}
              value={draft.start}
              onValueChange={(value) => commitTimes({ ...draft, start: value ?? "" })}
            >
              {renderSegments}
            </TimeInput>
          </Field>
          <Field className="grid gap-1.5">
            <FieldLabel className={fieldLabel}>End</FieldLabel>
            <TimeInput
              className={timeControl}
              hourCycle={24}
              value={draft.end}
              onValueChange={(value) => commitTimes({ ...draft, end: value ?? "" })}
            >
              {renderSegments}
            </TimeInput>
          </Field>
        </div>
        {error && (
          <p className="text-[13px] text-danger" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className={fieldLabel}>Duration</span>
          <span className="text-[13px] font-medium text-ink tabular-nums">{formatDuration(length)}</span>
        </div>
        <SegmentedControl
          aria-label="Duration"
          value={durations.includes(length) ? String(length) : null}
          onValueChange={(value) => {
            if (value) setError(onChange(booking.id, { end: booking.start + Number(value) }))
          }}
          className="relative isolate grid grid-cols-4 gap-1 rounded-lg bg-line-soft p-1"
        >
          <SegmentedControlIndicator className="absolute top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) -z-10 h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-md bg-surface shadow-soft transition-[top,left,width,height] duration-200 ease-out-strong motion-reduce:transition-none" />
          {durations.map((minutes) => (
            <SegmentedControlItem
              key={minutes}
              value={String(minutes)}
              className="h-7 cursor-pointer rounded-md text-[13px] font-medium text-body tabular-nums transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent data-checked:text-ink"
            >
              {formatDuration(minutes)}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>

      <div className="-mx-4 -mb-4">
        <Separator className="h-px bg-line" />
        <div className="flex items-center justify-between px-4 py-3">
          <Button className={buttonClass("danger", "-ml-2 h-8 px-2")} onClick={() => onDelete(booking.id)}>
            Delete
          </Button>
          <PopoverClose className={buttonClass("primary", "h-8")}>Done</PopoverClose>
        </div>
      </div>
    </div>
  )
}

export { BookingEditor, type BookingEditorProps }
