import { useAsyncOptions } from "@ui-sdk/react/async-options"
import { Button } from "@ui-sdk/react/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxStatus,
} from "@ui-sdk/react/combobox"
import { DatePicker, DatePickerContent, DatePickerInput, DatePickerTrigger } from "@ui-sdk/react/date-picker"
import { Field, FieldLabel } from "@ui-sdk/react/field"
import { Input } from "@ui-sdk/react/input"
import { NumberInput, NumberInputControl } from "@ui-sdk/react/number-input"
import { Popover, PopoverContent, PopoverTitle } from "@ui-sdk/react/popover"
import {
  createSelectController,
 Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui-sdk/react/select"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from "@ui-sdk/react/slider"
import { Textarea } from "@ui-sdk/react/textarea"
import { TimeInput, TimeInputSegment, type TimeInputSegmentData } from "@ui-sdk/react/time-input"
import { useRef, useState, type KeyboardEvent, type ReactNode, useEffect } from "react"
import { buttonClass } from "../ui/button"
import { companies, ownerName, searchUsers, stages, type User } from "./deals-data"

/** Where focus goes after a commit: stay on the cell, or step to a neighbour like a spreadsheet. */
type Nav = "stay" | "next" | "prev" | "down"

type EditorProps<V> = {
  value: V
  label: string
  onCommit: (value: V, nav?: Nav) => void
  onCancel: () => void
}

const cellControl =
  "h-full w-full min-w-0 bg-surface px-3 text-[15px] text-ink outline-none ring-2 ring-inset ring-accent"
const listbox =
  "z-50 max-h-72 min-w-(--anchor-width) overflow-auto rounded-xl border border-line bg-surface p-1 text-[15px] text-body shadow-popover outline-none transition-[opacity,scale] duration-150 ease-out data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:transition-none"
const option =
  "flex h-8 cursor-default items-center gap-2 rounded-md px-2.5 outline-none select-none data-highlighted:bg-line-soft data-highlighted:text-ink data-selected:font-medium data-selected:text-ink"
const fieldLabel = "text-[13px] font-medium text-muted"
const control =
  "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[15px] text-ink shadow-soft transition-[border-color,box-shadow] duration-150 outline-none focus:border-accent focus:ring-3 focus:ring-accent/15"

/** Keys every in-cell editor shares: Enter keeps, Tab keeps and steps, Escape throws the draft away. */
function commitKeys<V>(e: KeyboardEvent, draft: () => V, { onCommit, onCancel }: Pick<EditorProps<V>, "onCommit" | "onCancel">) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault()
    onCommit(draft(), "down")
  } else if (e.key === "Tab") {
    e.preventDefault()
    onCommit(draft(), e.shiftKey ? "prev" : "next")
  } else if (e.key === "Escape") {
    e.preventDefault()
    e.stopPropagation()
    onCancel()
  }
}

/** Guards against a blur arriving after Enter or Escape already finished the edit. */
function useOnce() {
  const done = useRef(false)
  return <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      if (done.current) return
      done.current = true
      fn(...args)
    }
}

function TextEditor({ value, label, onCommit, onCancel, seed }: EditorProps<string> & { seed?: string }) {
  const [draft, setDraft] = useState(seed ?? value)
  const once = useOnce()
  const commit = once(onCommit)
  const cancel = once(onCancel)
  return (
    <Input
      aria-label={label}
      autoFocus
      className={cellControl}
      value={draft}
      onValueChange={setDraft}
      onFocus={(e) => seed === undefined && e.currentTarget.select()}
      onBlur={() => commit(draft.trim() || value, "stay")}
      onKeyDown={(e) => commitKeys(e, () => draft.trim() || value, { onCommit: commit, onCancel: cancel })}
    />
  )
}

const usd = { style: "currency", currency: "USD", maximumFractionDigits: 0 } as const

/** Currency through NumberInput's Intl format: types digits, shows `$12,500`, steps by $100 with arrows. */
function CurrencyEditor({ value, label, onCommit, onCancel }: EditorProps<number>) {
  const [draft, setDraft] = useState<number | null>(value)
  const once = useOnce()
  const commit = once(onCommit)
  const cancel = once(onCancel)
  const read = () => Math.max(0, draft ?? 0)
  return (
    <NumberInput value={draft} onValueChange={setDraft} format={usd} min={0} step={100} largeStep={1000}>
      <NumberInputControl
        aria-label={label}
        autoFocus
        className={`${cellControl} text-right tabular-nums`}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => commit(read(), "stay")}
        onKeyDown={(e) => commitKeys(e, read, { onCommit: commit, onCancel: cancel })}
      />
    </NumberInput>
  )
}

/**
 * Select and combobox report their pick and their close separately. Closing without a pick
 * cancels, but only after the pick had its chance to land.
 */
function usePickOrCancel<V>(onCommit: EditorProps<V>["onCommit"], onCancel: () => void) {
  const done = useRef(false)
  const pick = (v: V) => {
    if (done.current) return
    done.current = true
    onCommit(v, "stay")
  }
  const closed = () =>
    setTimeout(() => {
      if (done.current) return
      done.current = true
      onCancel()
    })
  return { pick, closed }
}

function StageEditor({ value, label, onCommit, onCancel }: EditorProps<string>) {
  const { pick, closed } = usePickOrCancel(onCommit, onCancel)
  // Open through a controller after mount: unlike defaultOpen, this hands focus to the list,
  // so arrow keys work straight away.
  const [controller] = useState(() => createSelectController<string>())
  useEffect(() => {
    controller.setOpen(true)
  }, [controller])
  return (
    <Select
      controller={controller}
      value={value}
      onValueChange={(v) => {
        if (v) pick(v as string)
      }}
      onOpenChange={(open) => {
        if (!open) closed()
      }}
    >
      <SelectTrigger aria-label={label} className={`${cellControl} flex items-center justify-between gap-2 text-left`}>
        <SelectValue />
        <Chevron />
      </SelectTrigger>
      <SelectContent className={listbox}>
        {stages.map((s) => (
          <SelectItem key={s.value} value={s.value} className={option}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const companyItems = companies.map((c) => ({ value: c, label: c }))

function CompanyEditor({ value, label, onCommit, onCancel, seed }: EditorProps<string> & { seed?: string }) {
  const { pick, closed } = usePickOrCancel(onCommit, onCancel)
  return (
    <Combobox
      items={companyItems}
      value={value}
      defaultQuery={seed ?? value}
      defaultOpen
      onValueChange={(v) => {
        if (v) pick(v as string)
      }}
      onOpenChange={(open) => {
        if (!open) closed()
      }}
    >
      <ComboboxInput aria-label={label} autoFocus className={cellControl} onFocus={(e) => seed === undefined && e.currentTarget.select()} />
      <ComboboxContent className={listbox}>
        <ComboboxEmpty className="px-2.5 py-2 text-[13px] text-muted">No matching company.</ComboboxEmpty>
        <ComboboxList>
          {(state) =>
            (state.items as typeof companyItems).map((item) => (
              <ComboboxItem key={item.value} value={item.value} label={item.label} className={option}>
                {item.label}
              </ComboboxItem>
            ))
          }
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

const OPTION_ROW = 40
const OPTION_VIEW = 280

/** Owner search: async results from the mock API, windowed so 5,000 people stay cheap. */
function OwnerEditor({ value, label, onCommit, onCancel }: EditorProps<string>) {
  const { pick, closed } = usePickOrCancel(onCommit, onCancel)
  const people = useAsyncOptions(searchUsers, { immediate: true })
  const scroller = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  return (
    <Combobox
      items={people.items}
      filter={false}
      status={people.status}
      value={value}
      itemToLabel={ownerName}
      defaultOpen
      onQueryChange={(query) => {
        people.setQuery(query)
        if (scroller.current) scroller.current.scrollTop = 0
      }}
      onValueChange={(v) => {
        if (v) pick(v as string)
      }}
      onOpenChange={(open) => {
        if (!open) closed()
      }}
      onHighlight={(_, { index }) => {
        const el = scroller.current
        if (!el || index < 0) return
        const top = index * OPTION_ROW
        if (top < el.scrollTop) el.scrollTop = top
        else if (top + OPTION_ROW > el.scrollTop + el.clientHeight) el.scrollTop = top + OPTION_ROW - el.clientHeight
      }}
    >
      <ComboboxInput aria-label={label} autoFocus className={cellControl} onFocus={(e) => e.currentTarget.select()} />
      <ComboboxContent className={`${listbox} w-72 overflow-hidden p-0`}>
        <div
          ref={scroller}
          className="overflow-auto p-1"
          style={{ maxHeight: OPTION_VIEW }}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
          <ComboboxEmpty className="px-2.5 py-2 text-[13px] text-muted">
            {(state) => (state.empty && !state.loading ? "Nobody matches." : null)}
          </ComboboxEmpty>
          <ComboboxList>
            {(state) => {
              const items = state.items as User[]
              const start = Math.max(0, Math.floor(scrollTop / OPTION_ROW) - 4)
              const end = Math.min(items.length, Math.ceil((scrollTop + OPTION_VIEW) / OPTION_ROW) + 4)
              return (
                <div className="relative" style={{ height: items.length * OPTION_ROW }}>
                  {items.slice(start, end).map((item, offset) => (
                    <ComboboxItem
                      key={item.value}
                      value={item.value}
                      label={item.label}
                      index={start + offset}
                      className={`${option} absolute inset-x-0 h-10`}
                      style={{ top: (start + offset) * OPTION_ROW }}
                    >
                      <Initials name={item.label} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <span className="text-[13px] text-muted">{item.team}</span>
                    </ComboboxItem>
                  ))}
                </div>
              )
            }}
          </ComboboxList>
        </div>
        <ComboboxStatus className="border-t border-line px-3 py-2 text-[13px] text-muted tabular-nums">
          {(state) => (state.loading ? "Searching…" : `${state.count.toLocaleString()} people`)}
        </ComboboxStatus>
      </ComboboxContent>
    </Combobox>
  )
}

/**
 * Shell for editors that need room: a popover pinned to the cell. Escape discards, Save or
 * ⌘/Ctrl+Enter keeps, and clicking away keeps too, the way a sheet cell behaves.
 */
function PopoverEditor<V>({
  value,
  label,
  onCommit,
  onCancel,
  initialFocus,
  width = "w-80",
  children,
}: EditorProps<V> & {
  initialFocus: string
  width?: string
  children: (draft: V, set: (v: V) => void) => ReactNode
}) {
  const [draft, setDraft] = useState(value)
  const once = useOnce()
  const commit = once(onCommit)
  const cancel = once(onCancel)
  return (
    <Popover
      open
      onOpenChange={(open, details) => {
        if (open) return
        if (details.reason === "escape-key") cancel()
        else commit(draft, "stay")
      }}
    >
      <PopoverContent
        anchor="[data-editing]"
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={12}
        initialFocus={initialFocus}
        finalFocus="none"
        className={`z-50 ${width} origin-(--transform-origin) rounded-xl border border-line bg-surface p-4 text-body shadow-popover transition-[opacity,scale] duration-150 ease-out data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0 motion-reduce:transition-none`}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            commit(draft, "stay")
          }
        }}
      >
        <div className="grid gap-4">
          <PopoverTitle className="text-[15px] font-semibold text-ink">{label}</PopoverTitle>
          {children(draft, setDraft)}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-muted">
              <Kbd>⌘</Kbd> <Kbd>↵</Kbd> to save
            </span>
            <div className="flex gap-2">
              <Button className={buttonClass("ghost", "h-8")} onClick={() => cancel()}>
                Cancel
              </Button>
              <Button className={buttonClass("primary", "h-8")} onClick={() => commit(draft, "stay")}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function NotesEditor(props: EditorProps<string>) {
  return (
    <PopoverEditor {...props} initialFocus="textarea" width="w-96">
      {(draft, set) => (
        <Textarea
          aria-label={props.label}
          className={`${control} h-auto min-h-32 resize-y py-2 leading-relaxed`}
          rows={5}
          placeholder="Next steps, blockers, context for the team…"
          value={draft}
          onValueChange={set}
        />
      )}
    </PopoverEditor>
  )
}

/** One value, two ways in: drag or arrow the slider, or type an exact percentage. */
function ProbabilityEditor(props: EditorProps<number>) {
  return (
    <PopoverEditor {...props} initialFocus="[data-slot=slider-thumb]">
      {(draft, set) => (
        <div className="grid gap-3">
          <div className="flex items-center gap-4">
            <Slider
              className="flex-1"
              value={draft}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) => set(v as number)}
            >
              <SliderControl className="relative flex h-6 cursor-pointer items-center">
                <SliderTrack className="relative h-1.5 w-full rounded-full bg-line">
                  <SliderIndicator className="absolute h-full rounded-full bg-ink" />
                  <SliderThumb
                    aria-label={props.label}
                    className="absolute top-1/2 size-4 -translate-1/2 rounded-full border border-line bg-surface shadow-soft outline-none transition-[scale] duration-150 focus-visible:ring-3 focus-visible:ring-accent/25 active:scale-110"
                  />
                </SliderTrack>
              </SliderControl>
            </Slider>
            <NumberInput
              value={draft}
              min={0}
              max={100}
              step={1}
              format={{ style: "unit", unit: "percent" }}
              onValueChange={(v) => v !== null && set(Math.min(100, Math.max(0, Math.round(v))))}
            >
              <NumberInputControl aria-label={`${props.label}, exact`} className={`${control} w-20 text-right tabular-nums`} />
            </NumberInput>
          </div>
          <div className="flex justify-between text-[13px] text-muted tabular-nums">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      )}
    </PopoverEditor>
  )
}

const timeSegment =
  "box-content w-[2ch] rounded px-px text-center outline-none focus:bg-accent focus:text-surface data-empty:text-muted data-[type=literal]:w-auto data-[type=literal]:px-0 data-[type=literal]:text-muted"

const renderSegments = ({ segments }: { segments: TimeInputSegmentData[] }) =>
  segments.map((s) => <TimeInputSegment key={s.key} segment={s} className={timeSegment} />)

/** `YYYY-MM-DDTHH:mm` split across a DatePicker and a TimeInput, joined back on save. */
function CloseDateEditor(props: EditorProps<string>) {
  return (
    <PopoverEditor {...props} initialFocus="[data-slot=date-picker-input]">
      {(draft, set) => {
        const [date, time = "09:00"] = draft.split("T")
        return (
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field className="grid gap-1.5">
              <FieldLabel className={fieldLabel}>Date</FieldLabel>
              <DatePicker value={date} onValueChange={(v) => typeof v === "string" && set(`${v}T${time}`)}>
                <div className="flex gap-1.5">
                  <DatePickerInput className={`${control} tabular-nums`} />
                  <DatePickerTrigger aria-label="Choose date" className={buttonClass("secondary", "w-9 shrink-0 px-0")}>
                    <CalendarIcon />
                  </DatePickerTrigger>
                </div>
                <DatePickerContent className="z-50 rounded-xl border border-line bg-surface p-3 shadow-popover" />
              </DatePicker>
            </Field>
            <Field className="grid gap-1.5">
              <FieldLabel className={fieldLabel}>Time</FieldLabel>
              <TimeInput
                className={`${control} flex items-center tabular-nums focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15`}
                hourCycle={24}
                value={time}
                onValueChange={(v) => v && set(`${date}T${v.slice(0, 5)}`)}
              >
                {renderSegments}
              </TimeInput>
            </Field>
          </div>
        )
      }}
    </PopoverEditor>
  )
}

function Initials({ name }: { name: string }) {
  const letters = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
  return (
    <span
      aria-hidden="true"
      className="grid size-6 shrink-0 place-items-center rounded-full bg-line-soft text-[11px] font-semibold text-body ring-1 ring-line"
    >
      {letters}
    </span>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid h-5 min-w-5 place-items-center rounded border border-line bg-canvas px-1 font-sans text-[11px] font-medium text-body">
      {children}
    </kbd>
  )
}

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4.5 6.5L8 10l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4" aria-hidden="true">
      <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
      <path d="M3 8.5h14M7 2.75v3.5M13 2.75v3.5" strokeLinecap="round" />
    </svg>
  )
}

export {
  Chevron,
  CloseDateEditor,
  CompanyEditor,
  CurrencyEditor,
  Initials,
  Kbd,
  NotesEditor,
  OwnerEditor,
  ProbabilityEditor,
  StageEditor,
  TextEditor,
  type EditorProps,
  type Nav,
}
