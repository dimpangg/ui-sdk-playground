const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" })
const longFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" })
const rangeFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })

/** Monday to Sunday of the week holding `from`. */
function weekDays(from: Date) {
  const monday = new Date(from)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return day
  })
}

/** Local `YYYY-MM-DD`, used as the day track id. */
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ")
}

export { weekDays, isoDay, formatDuration, weekdayFmt, longFmt, rangeFmt }
