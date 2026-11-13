import { createLocalStorage } from "@ui-sdk/core"
import { useEffect, useMemo, useState } from "react"
import type { Deal } from "./deals-data"

type ColumnId = Exclude<keyof Deal, never>
type EditorKind = "none" | "text" | "currency" | "select" | "combobox" | "async-combobox" | "textarea" | "slider" | "datetime"
type Pin = "left" | "right"

type ColumnDef = {
  id: ColumnId
  label: string
  width: number
  editor: EditorKind
  align?: "end"
  /** Shown in the columns menu and the keyboard legend. */
  hint: string
}

const columns: ColumnDef[] = [
  { id: "id", label: "Deal", width: 96, editor: "none", hint: "Read only" },
  { id: "name", label: "Name", width: 220, editor: "text", hint: "Text" },
  { id: "company", label: "Company", width: 196, editor: "combobox", hint: "Combobox" },
  { id: "ownerId", label: "Owner", width: 188, editor: "async-combobox", hint: "Async combobox, 5,000 people" },
  { id: "stage", label: "Stage", width: 148, editor: "select", hint: "Select" },
  { id: "amount", label: "Amount", width: 136, editor: "currency", align: "end", hint: "Currency" },
  { id: "probability", label: "Probability", width: 156, editor: "slider", hint: "Slider + number" },
  { id: "closeAt", label: "Close date", width: 204, editor: "datetime", hint: "Date and time" },
  { id: "notes", label: "Notes", width: 260, editor: "textarea", hint: "Long text" },
]

const columnById = new Map(columns.map((c) => [c.id, c]))

/** Popover editors open a card; the rest edit inside the cell. */
const popoverEditors: EditorKind[] = ["textarea", "slider", "datetime"]

type SortState = { id: ColumnId; dir: "asc" | "desc" } | null

type Layout = {
  order: ColumnId[]
  hidden: ColumnId[]
  pins: Partial<Record<ColumnId, Pin>>
  widths: Partial<Record<ColumnId, number>>
  pinnedRows: string[]
  sort: SortState
}

const defaultLayout: Layout = {
  order: columns.map((c) => c.id),
  hidden: [],
  pins: { id: "left", name: "left" },
  widths: {},
  pinnedRows: [],
  sort: null,
}

const MIN_WIDTH = 80
const MAX_WIDTH = 560
const clampWidth = (w: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(w)))

/** JSON state mirrored to localStorage through ui-sdk's storage adapter. */
function usePersistentState<T>(key: string, initial: T, revive: (saved: unknown) => T = (s) => s as T) {
  const storage = useMemo(() => createLocalStorage(key), [key])
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = storage.get()
      return raw ? revive(JSON.parse(raw)) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    storage.set(JSON.stringify(value))
  }, [storage, value])
  return [value, setValue] as const
}

/** Keeps saved layouts valid when columns are added or removed later. */
function reviveLayout(saved: unknown): Layout {
  const s = (saved ?? {}) as Partial<Layout>
  const known = new Set(columns.map((c) => c.id))
  const order = (s.order ?? []).filter((id) => known.has(id))
  for (const c of columns) if (!order.includes(c.id)) order.push(c.id)
  return {
    order,
    hidden: (s.hidden ?? []).filter((id) => known.has(id)),
    pins: s.pins ?? defaultLayout.pins,
    widths: s.widths ?? {},
    pinnedRows: s.pinnedRows ?? [],
    sort: s.sort && known.has(s.sort.id) ? s.sort : null,
  }
}

type Placed = ColumnDef & { width: number; pin: Pin | null; offset: number; edge: boolean }

/** Visible columns in render order (left pins, scrolling, right pins) with sticky offsets. */
function placeColumns(layout: Layout, gutter: number): Placed[] {
  const visible = layout.order.filter((id) => !layout.hidden.includes(id)).map((id) => columnById.get(id)!)
  const width = (c: ColumnDef) => layout.widths[c.id] ?? c.width
  const left = visible.filter((c) => layout.pins[c.id] === "left")
  const center = visible.filter((c) => !layout.pins[c.id])
  const right = visible.filter((c) => layout.pins[c.id] === "right")
  let x = gutter
  const placedLeft = left.map((c, i) => {
    const p = { ...c, width: width(c), pin: "left" as Pin, offset: x, edge: i === left.length - 1 }
    x += p.width
    return p
  })
  let r = 0
  const placedRight = [...right].reverse().map((c, i) => {
    const p = { ...c, width: width(c), pin: "right" as Pin, offset: r, edge: i === right.length - 1 }
    r += p.width
    return p
  })
  placedRight.reverse()
  return [...placedLeft, ...center.map((c) => ({ ...c, width: width(c), pin: null, offset: 0, edge: false })), ...placedRight]
}

/** Moves `id` one step within its pin group (`-1` left, `1` right). */
function moveColumn(layout: Layout, id: ColumnId, step: -1 | 1): Layout {
  const group = layout.pins[id] ?? null
  const peers = layout.order.filter((c) => (layout.pins[c] ?? null) === group && !layout.hidden.includes(c))
  const at = peers.indexOf(id)
  const target = peers[at + step]
  if (!target) return layout
  return reorderColumn(layout, id, target, step > 0 ? "after" : "before")
}

function reorderColumn(layout: Layout, id: ColumnId, target: ColumnId, side: "before" | "after"): Layout {
  if (id === target) return layout
  const order = layout.order.filter((c) => c !== id)
  const at = order.indexOf(target) + (side === "after" ? 1 : 0)
  order.splice(at, 0, id)
  return { ...layout, order }
}

export {
  MAX_WIDTH,
  MIN_WIDTH,
  clampWidth,
  columnById,
  columns,
  defaultLayout,
  moveColumn,
  placeColumns,
  popoverEditors,
  reorderColumn,
  reviveLayout,
  usePersistentState,
  type ColumnDef,
  type ColumnId,
  type EditorKind,
  type Layout,
  type Pin,
  type Placed,
  type SortState,
}
