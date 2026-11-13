"use client"

import { createParts } from "@ui-sdk/react/primitive"
import { bookingCalendar } from "./booking-calendar"

const {
  Root: BookingCalendarRoot,
  Track: BookingCalendarTrack,
  Booking: BookingCalendarBooking,
  Edge: BookingCalendarEdge,
} = createParts(bookingCalendar, {
  root: "div",
  track: "div",
  booking: "div",
  edge: "span",
})

export { BookingCalendarRoot, BookingCalendarTrack, BookingCalendarBooking, BookingCalendarEdge }
