import {
  createChange,
  definePrimitive,
  type ChangeDetails,
  type Span,
  type SpanAction,
  type SpansDraft,
  type SpansReason,
  createSpans,
} from "@ui-sdk/core"

type Booking = Span & { title: string }

type BookingsChangeDetails = ChangeDetails<SpansReason> & {
  id: string
  action: SpanAction
}

type BookingCalendarOptions = {
  bookings?: Booking[]
  defaultBookings?: Booking[]
  onBookingsChange?: (value: Booking[], details: BookingsChangeDetails) => void
  /** Day ids in order, like ISO dates. Arrows across move a booking between them. */
  days?: string[]
  /** First bookable minute of the day. */
  dayStart?: number
  /** Last bookable minute of the day. */
  dayEnd?: number
  /** Snap size in minutes. */
  step?: number
  /** Shortest booking in minutes. */
  minDuration?: number
  /** The selected booking id. */
  selected?: string
  onSelect?: (id: string) => void
  /** Accessible name for a booking. */
  describe?: (booking: Booking) => string
}

type BookingCalendarState = {
  bookings: Booking[]
  draft: SpansDraft<Booking> | null
  selected: string | null
}

const formatMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`

let created = 0

const bookingCalendar = definePrimitive({
  name: "booking-calendar",
  options: {
    bookings: "value",
    defaultBookings: "value",
    onBookingsChange: "callback",
    days: "list",
    dayStart: "number",
    dayEnd: "number",
    step: "number",
    minDuration: "number",
    selected: "string",
    onSelect: "callback",
    describe: "value",
  },
  controlled: ["bookings"],
  state: (options: BookingCalendarOptions): BookingCalendarState => ({
    bookings: options.bookings ?? options.defaultBookings ?? [],
    draft: null,
    selected: options.selected ?? null,
  }),
  sync: (options) => ({
    ...(options.bookings === undefined ? {} : { bookings: options.bookings }),
    selected: options.selected ?? null,
  }),
  api: (context) => {
    const change = createChange(context)
    const describe = (booking: Booking) =>
      context.options().describe?.(booking) ??
      `${booking.title}, ${booking.track} ${formatMinutes(booking.start)} to ${formatMinutes(booking.end)}`

    const spans = createSpans<BookingCalendarState, Booking>(context, {
      key: "bookings",
      draft: "draft",
      set: (value, details) => change("bookings", value, details),
      axis: "y",
      min: () => context.options().dayStart ?? 8 * 60,
      max: () => context.options().dayEnd ?? 20 * 60,
      step: () => context.options().step ?? 15,
      minSize: () => context.options().minDuration ?? 30,
      size: () => 60,
      tracks: () => context.options().days ?? [],
      overlap: false,
      create: (span) => ({ ...span, id: `booking-${Date.now()}-${++created}`, title: "New booking" }),
      label: describe,
      createAutoScroll: { edge: 32 },
    })

    if (typeof window !== "undefined") {
      window.addEventListener("blur", spans.cancel)
      context.onDestroy(() => window.removeEventListener("blur", spans.cancel))
    }

    return {
      spans,
      describe,
      select: (id: string) => context.options().onSelect?.(id),
      update: (id: string, patch: Partial<Omit<Booking, "id">>) => spans.update(id, patch),
      remove: (id: string) => spans.remove(id),
    }
  },
  slots: (slot) => ({
    root: slot<{}, { bookings: Booking[] }>({
      state: (state, { api }) => ({ bookings: api.spans.spans(state) }),
    }),
    track: slot<{ value: string }, { bookings: Booking[] }>({
      props: { value: "string" },
      state: (state, { api, key }) => ({ bookings: api.spans.spansOn(state, key) }),
      attrs: (_state, { key }) => ({ "data-day": key }),
      bind: (el, { api, key }) => api.spans.bindTrack(el, key),
      on: {
        pointerdown: (event, { api, key }) => api.spans.trackPointerdown(event as PointerEvent, key),
      },
    }),
    booking: slot<{ value: string }, { booking: Booking | undefined; action: SpanAction | undefined }>({
      props: { value: "string" },
      role: "button",
      focus: "tab-stop",
      press: ({ api, key }) => api.select(key),
      state: (state, { api, key }) => ({
        booking: api.spans.spans(state).find((b) => b.id === key),
        action: api.spans.action(state, key),
      }),
      attrs: (state, { api, key }) => {
        const booking = api.spans.spans(state).find((b) => b.id === key)
        return {
          ...api.spans.spanAttrs(state, key),
          tabindex: "0",
          style: booking ? api.spans.spanStyle(booking) : undefined,
          "aria-label": booking ? api.describe(booking) : undefined,
          "aria-roledescription": "booking",
          "data-selected": state.selected === key ? "" : undefined,
        }
      },
      bind: (el, { api, key }) => api.spans.bindSpan(el, key),
      on: {
        pointerdown: (event, { api, key }) => api.spans.spanPointerdown(event as PointerEvent, key),
        keydown: (event, { api, key }) => {
          const e = event as KeyboardEvent
          if (api.spans.keydown(e, key)) return
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            api.select(key)
          }
        },
      },
    }),
    edge: slot<{ side: string }>({
      props: { side: "string" },
      attrs: (_state, { props }) => ({ "data-span-edge": props.side, "aria-hidden": "true" }),
    }),
  }),
  agent: { actions: ["update", "remove"] },
})

export { bookingCalendar, formatMinutes, type Booking, type BookingCalendarOptions, type BookingsChangeDetails }
