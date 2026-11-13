import { Button } from "@ui-sdk/react/button"
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@ui-sdk/react/menu"
import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react"
import { formatCloseAt, money, ownerName, stageLabel, stages, type Deal, type Stage } from "./deals-data"
import {
  CloseDateEditor,
  CompanyEditor,
  CurrencyEditor,
  Initials,
  NotesEditor,
  OwnerEditor,
  ProbabilityEditor,
  StageEditor,
  TextEditor,
  type Nav,
} from "./editors"
import {
  clampWidth,
  moveColumn,
  placeColumns,
  popoverEditors,
  reorderColumn,
  type ColumnId,
  type Layout,
  type Pin,
  type Placed,
} from "./table-model"

const ROW = 44
const HEAD = 40
const GUTTER = 48
const OVERSCAN = 6
const PIN = "__pin"
const HEADER = "__header"

type NavCol = ColumnId | typeof PIN
type Active = { row: string; col: NavCol }
type Editing = { row: string; col: ColumnId; seed?: string }

type DealsTableProps = {
  rows: Deal[]
  /** Rows pinned to the top, already resolved from `layout.pinnedRows`. */
  pinned: Deal[]
  edited: Record<string, Partial<Deal>>
  layout: Layout
  onLayoutChange: (update: (layout: Layout) => Layout) => void
  onEdit: (id: string, patch: Partial<Deal>) => void
  today: string
}

const menuPanel =
  "z-50 min-w-48 rounded-xl border border-line bg-surface p-1 text-[15px] text-body shadow-popover outline-none transition-[opacity,scale] duration-150 ease-out origin-(--transform-origin) data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0 motion-reduce:transition-none"
const menuItem =
  "flex h-8 cursor-default items-center justify-between gap-6 rounded-md px-2.5 outline-none select-none data-highlighted:bg-line-soft data-highlighted:text-ink data-disabled:text-muted/60"

const cellKey = (row: string, col: NavCol) => `${row}|${col}`

function DealsTable({ rows, pinned, edited, layout, onLayoutChange, onEdit, today }: DealsTableProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState({ top: 0, left: 0, height: 600, width: 1000 })
  const [active, setActive] = useState<Active>({ row: rows[0]?.id ?? HEADER, col: "name" })
  const [editing, setEditing] = useState<Editing | null>(null)
  const [menuFor, setMenuFor] = useState<ColumnId | null>(null)
  const [drag, setDrag] = useState<{ id: ColumnId; dx: number; target: ColumnId | null; side: "before" | "after" } | null>(null)
  const pendingFocus = useRef(false)

  const cols = useMemo(() => placeColumns(layout, GUTTER), [layout])
  const navCols: NavCol[] = useMemo(() => [PIN, ...cols.map((c) => c.id)], [cols])
  const navRows = useMemo(() => [HEADER, ...pinned.map((r) => r.id), ...rows.map((r) => r.id)], [pinned, rows])
  const rowIndex = useMemo(() => new Map(navRows.map((id, i) => [id, i])), [navRows])
  const dealById = useMemo(() => new Map([...pinned, ...rows].map((r) => [r.id, r])), [pinned, rows])

  const totalWidth = GUTTER + cols.reduce((sum, c) => sum + c.width, 0)
  const leftEdge = GUTTER + cols.filter((c) => c.pin === "left").reduce((s, c) => s + c.width, 0)
  const rightEdge = cols.filter((c) => c.pin === "right").reduce((s, c) => s + c.width, 0)
  const stickyHeight = HEAD + pinned.length * ROW

  // A filter or a sort can drop the active row: fall back to the first one.
  const safeActive: Active =
    rowIndex.has(active.row) && navCols.includes(active.col) ? active : { row: navRows[1] ?? HEADER, col: navCols.includes(active.col) ? active.col : "name" }

  const first = Math.max(0, Math.floor(scroll.top / ROW) - OVERSCAN)
  const last = Math.min(rows.length, Math.ceil((scroll.top + scroll.height - stickyHeight) / ROW) + OVERSCAN)
  const windowed = rows.slice(first, last).map((r, i) => ({ deal: r, index: first + i }))
  // Keep an open editor mounted even when its row scrolls out of the window.
  const editingIndex = editing ? rows.findIndex((r) => r.id === editing.row) : -1
  if (editingIndex >= 0 && (editingIndex < first || editingIndex >= last)) windowed.push({ deal: rows[editingIndex], index: editingIndex })

  const measure = useCallback(() => {
    const el = scroller.current
    if (el) setScroll({ top: el.scrollTop, left: el.scrollLeft, height: el.clientHeight, width: el.clientWidth })
  }, [])

  useLayoutEffect(() => {
    measure()
    const el = scroller.current
    if (!el) return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure])

  // Focus follows the active cell once it has rendered (it may need a scroll first).
  useLayoutEffect(() => {
    if (!pendingFocus.current || editing) return
    const el = scroller.current?.querySelector<HTMLElement>(`[data-cell="${cellKey(safeActive.row, safeActive.col)}"]`)
    if (el) {
      pendingFocus.current = false
      el.focus({ preventScroll: true })
    }
  })

  /** Scrolls so the cell clears the sticky header, pinned rows and pinned columns. */
  const reveal = (target: Active) => {
    const el = scroller.current
    if (!el) return
    const i = rows.findIndex((r) => r.id === target.row)
    if (i >= 0) {
      if (i * ROW < el.scrollTop) el.scrollTop = i * ROW
      else if (stickyHeight + (i + 1) * ROW > el.scrollTop + el.clientHeight) el.scrollTop = stickyHeight + (i + 1) * ROW - el.clientHeight
    }
    const col = cols.find((c) => c.id === target.col)
    if (col && !col.pin) {
      let x = GUTTER
      for (const c of cols) {
        if (c.id === col.id) break
        x += c.width
      }
      if (x < el.scrollLeft + leftEdge) el.scrollLeft = x - leftEdge
      else if (x + col.width > el.scrollLeft + el.clientWidth - rightEdge) el.scrollLeft = x + col.width - el.clientWidth + rightEdge
    }
    measure()
  }

  const focusCell = (target: Active) => {
    setActive(target)
    pendingFocus.current = true
    reveal(target)
  }

  const step = (from: Active, dRow: number, dCol: number): Active => {
    const r = Math.min(navRows.length - 1, Math.max(0, (rowIndex.get(from.row) ?? 0) + dRow))
    const c = Math.min(navCols.length - 1, Math.max(0, navCols.indexOf(from.col) + dCol))
    return { row: navRows[r], col: navCols[c] }
  }

  const togglePin = (id: string) =>
    onLayoutChange((l) => ({
      ...l,
      pinnedRows: l.pinnedRows.includes(id) ? l.pinnedRows.filter((r) => r !== id) : [...l.pinnedRows, id],
    }))

  const startEdit = (row: string, col: NavCol, seed?: string) => {
    if (col === PIN || row === HEADER) return
    const def = cols.find((c) => c.id === col)
    if (!def || def.editor === "none") return
    setActive({ row, col })
    setEditing({ row, col: def.id, seed })
  }

  const commit = (value: unknown, nav: Nav = "stay") => {
    if (!editing) return
    const deal = dealById.get(editing.row)
    if (deal && deal[editing.col] !== value) onEdit(editing.row, { [editing.col]: value } as Partial<Deal>)
    const from = { row: editing.row, col: editing.col as NavCol }
    setEditing(null)
    const next = nav === "next" ? step(from, 0, 1) : nav === "prev" ? step(from, 0, -1) : nav === "down" ? step(from, 1, 0) : from
    // A click elsewhere already moved focus on purpose; only reclaim it when it fell to the page.
    const lost = !document.activeElement || document.activeElement === document.body || scroller.current?.contains(document.activeElement)
    if (nav !== "stay" || lost) focusCell(next)
    else setActive(next)
  }

  const cancel = () => {
    if (!editing) return
    const from = { row: editing.row, col: editing.col as NavCol }
    setEditing(null)
    focusCell(from)
  }

  const sortBy = (id: ColumnId, dir?: "asc" | "desc") =>
    onLayoutChange((l) => {
      const next = dir ?? (l.sort?.id !== id ? "asc" : l.sort.dir === "asc" ? "desc" : null)
      return { ...l, sort: next ? { id, dir: next } : null }
    })

  const setPin = (id: ColumnId, pin: Pin | null) =>
    onLayoutChange((l) => {
      const pins = { ...l.pins }
      if (pin) pins[id] = pin
      else delete pins[id]
      return { ...l, pins }
    })

  const resize = (id: ColumnId, width: number) => onLayoutChange((l) => ({ ...l, widths: { ...l.widths, [id]: clampWidth(width) } }))

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.dataset.cell === undefined || editing) return
    const at = safeActive
    const page = Math.max(1, Math.floor((scroll.height - stickyHeight) / ROW) - 1)
    const mod = e.metaKey || e.ctrlKey
    const col = cols.find((c) => c.id === at.col)

    if (at.row === HEADER && col && e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault()
      onLayoutChange((l) => moveColumn(l, col.id, e.key === "ArrowLeft" ? -1 : 1))
      pendingFocus.current = true
      return
    }
    if (at.row === HEADER && col && e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault()
      resize(col.id, col.width + (e.key === "ArrowLeft" ? -16 : 16))
      return
    }

    const moves: Record<string, () => Active> = {
      ArrowUp: () => step(at, -1, 0),
      ArrowDown: () => step(at, 1, 0),
      ArrowLeft: () => step(at, 0, -1),
      ArrowRight: () => step(at, 0, 1),
      Home: () => (mod ? { row: navRows[1] ?? HEADER, col: navCols[0] } : { ...at, col: navCols[0] }),
      End: () => (mod ? { row: navRows[navRows.length - 1], col: navCols[navCols.length - 1] } : { ...at, col: navCols[navCols.length - 1] }),
      PageUp: () => step(at, -page, 0),
      PageDown: () => step(at, page, 0),
    }
    if (moves[e.key]) {
      e.preventDefault()
      focusCell(moves[e.key]())
      return
    }

    if (at.row === HEADER) {
      if (!col) return
      if (e.key === "Enter") {
        e.preventDefault()
        setMenuFor(col.id)
      } else if (e.key === " ") {
        e.preventDefault()
        sortBy(col.id)
      }
      return
    }
    if (at.col === PIN) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        togglePin(at.row)
        pendingFocus.current = true
      }
      return
    }
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault()
      startEdit(at.row, at.col)
    } else if (e.key.length === 1 && !mod && !e.altKey && col && (col.editor === "text" || col.editor === "combobox")) {
      e.preventDefault()
      startEdit(at.row, at.col, e.key)
    }
  }

  /** Header drag: follow the pointer, show where the column lands, and adopt the target's pin. */
  const startDrag = (e: PointerEvent<HTMLElement>, id: ColumnId) => {
    if (e.button !== 0) return
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const heads = [...(scroller.current?.querySelectorAll<HTMLElement>("[data-header]") ?? [])]
    let state = { id, dx: 0, target: null as ColumnId | null, side: "before" as "before" | "after" }
    setDrag(state)

    const move = (ev: globalThis.PointerEvent) => {
      const el = scroller.current
      if (el) {
        const box = el.getBoundingClientRect()
        if (ev.clientX > box.right - 48) el.scrollLeft += 12
        else if (ev.clientX < box.left + leftEdge + 24) el.scrollLeft -= 12
      }
      let target: ColumnId | null = null
      let side: "before" | "after" = "before"
      for (const h of heads) {
        const r = h.getBoundingClientRect()
        if (ev.clientX >= r.left && ev.clientX < r.right) {
          target = h.dataset.header as ColumnId
          side = ev.clientX < r.left + r.width / 2 ? "before" : "after"
        }
      }
      state = { id, dx: ev.clientX - startX, target: target === id ? null : target, side }
      setDrag(state)
    }
    const up = () => {
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", up)
      handle.removeEventListener("pointercancel", up)
      setDrag(null)
      const { target, side } = state
      if (!target) return
      onLayoutChange((l) => {
        const pins = { ...l.pins }
        if (l.pins[target]) pins[id] = l.pins[target]
        else delete pins[id]
        return reorderColumn({ ...l, pins }, id, target, side)
      })
      setActive({ row: HEADER, col: id })
      pendingFocus.current = true
    }
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", up)
    handle.addEventListener("pointercancel", up)
  }

  const startResize = (e: PointerEvent<HTMLElement>, col: Placed) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const sign = col.pin === "right" ? -1 : 1
    const move = (ev: globalThis.PointerEvent) => resize(col.id, col.width + sign * (ev.clientX - startX))
    const up = () => {
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", up)
    }
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", up)
  }

  const stick = (c: Placed, z: number): CSSProperties =>
    c.pin === "left" ? { position: "sticky", left: c.offset, zIndex: z } : c.pin === "right" ? { position: "sticky", right: c.offset, zIndex: z } : {}

  const edgeClass = (c: Placed) =>
    c.edge ? (c.pin === "left" ? "shadow-[1px_0_0_var(--color-line)] group-data-[scrolled]/grid:shadow-[1px_0_0_var(--color-line),6px_0_12px_-8px_rgb(0_0_0/0.25)]" : "shadow-[-1px_0_0_var(--color-line)] group-data-[scrolled-end]/grid:shadow-none group-data-[overflow]/grid:shadow-[-1px_0_0_var(--color-line),-6px_0_12px_-8px_rgb(0_0_0/0.25)]") : ""

  const rowsCount = navRows.length
  const rowCell = (deal: Deal, ariaRow: number, pinnedRow: boolean) => {
    const isActiveRow = safeActive.row === deal.id
    const changes = edited[deal.id]
    return (
      <div
        role="row"
        aria-rowindex={ariaRow}
        aria-selected={undefined}
        data-active={isActiveRow || undefined}
        className={`group/row flex ${pinnedRow ? "bg-canvas" : "bg-surface"}`}
        style={{ width: totalWidth, height: ROW }}
      >
        <div
          role="gridcell"
          aria-colindex={1}
          data-cell={cellKey(deal.id, PIN)}
          tabIndex={safeActive.row === deal.id && safeActive.col === PIN ? 0 : -1}
          onPointerDown={() => setActive({ row: deal.id, col: PIN })}
          className={`${cellBase} sticky left-0 z-10 justify-center ${pinnedRow ? "bg-canvas" : "bg-surface"} group-hover/row:bg-line-soft`}
          style={{ width: GUTTER }}
        >
          <Button
            tabIndex={-1}
            aria-label={pinnedRow ? `Unpin ${deal.name}` : `Pin ${deal.name}`}
            aria-pressed={pinnedRow}
            onClick={() => togglePin(deal.id)}
            className={`grid size-7 place-items-center rounded-md text-muted transition-[opacity,background-color,color] duration-150 hover:bg-line hover:text-ink ${pinnedRow ? "text-ink opacity-100" : "opacity-0 group-hover/row:opacity-100 group-data-[active]/row:opacity-100"}`}
          >
            <PinIcon filled={pinnedRow} />
          </Button>
        </div>
        {cols.map((c, ci) => {
          const isActive = isActiveRow && safeActive.col === c.id
          const isEditing = editing?.row === deal.id && editing.col === c.id
          const inCell = isEditing && !popoverEditors.includes(c.editor)
          return (
            <div
              key={c.id}
              role="gridcell"
              aria-colindex={ci + 2}
              aria-readonly={c.editor === "none" || undefined}
              data-cell={cellKey(deal.id, c.id)}
              data-editing={isEditing || undefined}
              data-pin={c.pin ?? undefined}
              data-dragging={drag?.id === c.id || undefined}
              tabIndex={isActive && !inCell ? 0 : -1}
              onPointerDown={() => {
                if (!isEditing) setActive({ row: deal.id, col: c.id })
              }}
              onDoubleClick={() => startEdit(deal.id, c.id)}
              className={`${cellBase} ${c.align === "end" ? "justify-end text-right" : ""} ${c.pin ? (pinnedRow ? "bg-canvas" : "bg-surface") : ""} ${edgeClass(c)} group-hover/row:bg-line-soft data-dragging:opacity-40 ${inCell ? "p-0" : "px-3"}`}
              style={{ width: c.width, ...stick(c, 10) }}
            >
              {inCell ? (
                <InCellEditor col={c.id} deal={deal} seed={editing?.seed} label={`${c.label}, ${deal.name}`} onCommit={commit} onCancel={cancel} />
              ) : (
                <>
                  <CellView col={c.id} deal={deal} today={today} />
                  {changes && c.id in changes && (
                    <span aria-hidden="true" title="Edited" className="pointer-events-none absolute top-0 right-0 size-0 border-t-[7px] border-l-[7px] border-t-muted/70 border-l-transparent" />
                  )}
                  {isEditing && (
                    <PopoverEditorFor col={c.id} deal={deal} label={`${c.label} · ${deal.name}`} onCommit={commit} onCancel={cancel} />
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const scrolled = scroll.left > 0
  const overflow = totalWidth > scroll.width
  const atEnd = scroll.left + scroll.width >= totalWidth - 1

  return (
    <div
      ref={scroller}
      role="grid"
      aria-label="Deals"
      aria-rowcount={rowsCount}
      aria-colcount={navCols.length}
      aria-multiselectable={false}
      tabIndex={-1}
      data-scrolled={scrolled || undefined}
      data-overflow={overflow || undefined}
      data-scrolled-end={atEnd || undefined}
      onScroll={measure}
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        // Tabbing in when the active cell is virtualized away lands here: bring it back.
        if (e.target === e.currentTarget) return focusCell(safeActive)
        // Any focused cell becomes the active one, however focus got there.
        const key = (e.target as HTMLElement).dataset.cell
        if (key && !editing) {
          const [row, col] = key.split("|")
          if (row !== safeActive.row || col !== safeActive.col) setActive({ row, col: col as NavCol })
        }
      }}
      className="group/grid relative min-h-0 flex-1 overflow-auto overscroll-contain rounded-xl border border-line bg-surface shadow-soft outline-none [scrollbar-gutter:stable] [&_[data-cell]:focus-visible]:z-20 [&_[data-cell]:focus-visible]:shadow-[inset_0_0_0_2px_var(--color-ink)]"
    >
      <div className="sticky top-0 z-30" style={{ width: totalWidth, minWidth: "100%" }}>
        <div role="row" aria-rowindex={1} className="flex border-b border-line bg-canvas" style={{ width: totalWidth, height: HEAD }}>
          <div
            role="columnheader"
            aria-colindex={1}
            data-cell={cellKey(HEADER, PIN)}
            tabIndex={safeActive.row === HEADER && safeActive.col === PIN ? 0 : -1}
            onPointerDown={() => setActive({ row: HEADER, col: PIN })}
            className={`${headBase} sticky left-0 z-10 justify-center bg-canvas`}
            style={{ width: GUTTER }}
          >
            <span className="sr-only">Pinned</span>
            <PinIcon filled={false} />
          </div>
          {cols.map((c, ci) => {
            const sort = layout.sort?.id === c.id ? layout.sort.dir : null
            const dropHere = drag?.target === c.id
            return (
              <div
                key={c.id}
                role="columnheader"
                aria-colindex={ci + 2}
                aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined}
                data-header={c.id}
                data-cell={cellKey(HEADER, c.id)}
                data-dragging={drag?.id === c.id || undefined}
                tabIndex={safeActive.row === HEADER && safeActive.col === c.id ? 0 : -1}
                onPointerDown={() => setActive({ row: HEADER, col: c.id })}
                className={`${headBase} group/head bg-canvas ${c.align === "end" ? "justify-end" : ""} ${edgeClass(c)} data-dragging:z-40 data-dragging:bg-surface data-dragging:shadow-lift`}
                style={{
                  width: c.width,
                  ...stick(c, 10),
                  ...(drag?.id === c.id ? { translate: `${drag.dx}px 0`, position: c.pin ? "sticky" : "relative" } : {}),
                }}
              >
                <span
                  aria-hidden="true"
                  title="Drag to reorder"
                  onPointerDown={(e) => startDrag(e, c.id)}
                  className="absolute top-1/2 left-0.5 grid h-6 w-3 -translate-y-1/2 cursor-grab touch-none place-items-center rounded text-muted opacity-0 transition-opacity duration-150 group-hover/head:opacity-100 active:cursor-grabbing"
                >
                  <GripIcon />
                </span>
                <Button
                  tabIndex={-1}
                  onClick={() => sortBy(c.id)}
                  className={`flex min-w-0 items-center gap-1 rounded text-[13px] font-medium whitespace-nowrap text-body hover:text-ink ${c.align === "end" ? "ml-auto flex-row-reverse" : ""}`}
                >
                  <span className="truncate">{c.label}</span>
                  {c.pin && <span className="sr-only">, pinned {c.pin}</span>}
                  <SortIcon dir={sort} />
                </Button>
                <Menu
                  open={menuFor === c.id}
                  onOpenChange={(open) => setMenuFor(open ? c.id : null)}
                  onAction={(value) => {
                    const [kind, arg] = value.split(":")
                    if (kind === "sort") sortBy(c.id, arg as "asc" | "desc")
                    if (kind === "unsort") onLayoutChange((l) => ({ ...l, sort: null }))
                    if (kind === "pin") setPin(c.id, (arg || null) as Pin | null)
                    if (kind === "move") onLayoutChange((l) => moveColumn(l, c.id, arg === "left" ? -1 : 1))
                    if (kind === "width") onLayoutChange((l) => {
                      const widths = { ...l.widths }
                      delete widths[c.id]
                      return { ...l, widths }
                    })
                    if (kind === "hide") onLayoutChange((l) => ({ ...l, hidden: [...l.hidden, c.id] }))
                    setActive({ row: HEADER, col: kind === "hide" ? "name" : c.id })
                    pendingFocus.current = true
                  }}
                >
                  <MenuTrigger
                    tabIndex={-1}
                    aria-label={`${c.label} column options`}
                    className={`grid size-6 shrink-0 place-items-center rounded-md text-muted opacity-0 transition-opacity duration-150 group-hover/head:opacity-100 group-focus-visible/head:opacity-100 hover:bg-line hover:text-ink data-popup-open:opacity-100 ${c.align === "end" ? "order-first" : "ml-auto"}`}
                  >
                    <DotsIcon />
                  </MenuTrigger>
                  <MenuContent className={menuPanel} align="start" sideOffset={6} finalFocus={`[data-header="${c.id}"]`}>
                    <MenuItem value="sort:asc" className={menuItem}>
                      Sort ascending {sort === "asc" && <Check />}
                    </MenuItem>
                    <MenuItem value="sort:desc" className={menuItem}>
                      Sort descending {sort === "desc" && <Check />}
                    </MenuItem>
                    {sort && (
                      <MenuItem value="unsort" className={menuItem}>
                        Clear sort
                      </MenuItem>
                    )}
                    <MenuSeparator className="my-1 h-px bg-line" />
                    <MenuItem value="pin:left" className={menuItem}>
                      Pin to left {c.pin === "left" && <Check />}
                    </MenuItem>
                    <MenuItem value="pin:right" className={menuItem}>
                      Pin to right {c.pin === "right" && <Check />}
                    </MenuItem>
                    <MenuItem value="pin:" disabled={!c.pin} className={menuItem}>
                      Unpin
                    </MenuItem>
                    <MenuSeparator className="my-1 h-px bg-line" />
                    <MenuItem value="move:left" className={menuItem}>
                      Move left <Shortcut keys="⌥←" />
                    </MenuItem>
                    <MenuItem value="move:right" className={menuItem}>
                      Move right <Shortcut keys="⌥→" />
                    </MenuItem>
                    <MenuItem value="width" disabled={layout.widths[c.id] === undefined} className={menuItem}>
                      Reset width
                    </MenuItem>
                    <MenuSeparator className="my-1 h-px bg-line" />
                    <MenuItem value="hide" disabled={c.id === "name"} className={menuItem}>
                      Hide column
                    </MenuItem>
                  </MenuContent>
                </Menu>
                <span
                  aria-hidden="true"
                  title="Drag to resize, double-click to reset"
                  onPointerDown={(e) => startResize(e, c)}
                  onDoubleClick={() =>
                    onLayoutChange((l) => {
                      const widths = { ...l.widths }
                      delete widths[c.id]
                      return { ...l, widths }
                    })
                  }
                  className={`absolute top-0 ${c.pin === "right" ? "-left-1" : "-right-1"} z-20 h-full w-2 cursor-col-resize touch-none after:absolute after:inset-y-2 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent after:transition-colors hover:after:bg-muted active:after:bg-ink`}
                />
                {dropHere && (
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-y-1 z-30 w-0.5 rounded-full bg-ink ${drag.side === "before" ? "-left-px" : "-right-px"}`}
                  />
                )}
              </div>
            )
          })}
        </div>
        {pinned.length > 0 && (
          <div role="rowgroup" aria-label="Pinned deals" className="border-b border-line shadow-[0_6px_12px_-10px_rgb(0_0_0/0.3)]">
            {pinned.map((deal) => (
              <Fragment key={deal.id}>{rowCell(deal, (rowIndex.get(deal.id) ?? 0) + 1, true)}</Fragment>
            ))}
          </div>
        )}
      </div>

      <div role="rowgroup" className="relative" style={{ height: rows.length * ROW, width: totalWidth, minWidth: "100%" }}>
        {windowed.map(({ deal, index }) => (
          <div key={deal.id} className="absolute left-0" style={{ top: index * ROW }}>
            {rowCell(deal, pinned.length + index + 2, false)}
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="sticky left-0 grid h-48 place-items-center text-[15px] text-muted" style={{ width: scroll.width }}>
          No deals match these filters.
        </div>
      )}
    </div>
  )
}

const cellBase =
  "relative flex shrink-0 items-center overflow-hidden border-b border-line-soft text-[15px] text-body outline-none transition-[background-color,opacity] duration-100"
const headBase = "relative flex h-full shrink-0 items-center gap-1 px-3 outline-none select-none"

function InCellEditor({
  col,
  deal,
  label,
  seed,
  onCommit,
  onCancel,
}: {
  col: ColumnId
  deal: Deal
  label: string
  seed?: string
  onCommit: (value: unknown, nav?: Nav) => void
  onCancel: () => void
}) {
  const common = { label, onCommit, onCancel }
  switch (col) {
    case "name":
      return <TextEditor {...common} value={deal.name} seed={seed} />
    case "company":
      return <CompanyEditor {...common} value={deal.company} seed={seed} />
    case "ownerId":
      return <OwnerEditor {...common} value={deal.ownerId} />
    case "stage":
      return <StageEditor {...common} value={deal.stage} />
    case "amount":
      return <CurrencyEditor {...common} value={deal.amount} />
    default:
      return null
  }
}

function PopoverEditorFor({
  col,
  deal,
  label,
  onCommit,
  onCancel,
}: {
  col: ColumnId
  deal: Deal
  label: string
  onCommit: (value: unknown, nav?: Nav) => void
  onCancel: () => void
}) {
  const common = { label, onCommit, onCancel }
  switch (col) {
    case "notes":
      return <NotesEditor {...common} value={deal.notes} />
    case "probability":
      return <ProbabilityEditor {...common} value={deal.probability} />
    case "closeAt":
      return <CloseDateEditor {...common} value={deal.closeAt} />
    default:
      return null
  }
}

const stageTone: Record<Stage, string> = {
  lead: "border-line text-body",
  qualified: "border-line bg-line-soft text-body",
  proposal: "border-transparent bg-line text-ink",
  negotiation: "border-transparent bg-event text-ink",
  won: "border-transparent bg-ink text-surface",
  lost: "border-line text-muted line-through decoration-muted/60",
}

function CellView({ col, deal, today }: { col: ColumnId; deal: Deal; today: string }) {
  switch (col) {
    case "id":
      return <span className="font-mono text-[13px] text-muted tabular-nums">{deal.id}</span>
    case "name":
      return <span className="truncate font-medium text-ink">{deal.name}</span>
    case "company":
      return <span className="truncate">{deal.company}</span>
    case "ownerId": {
      const name = ownerName(deal.ownerId)
      return (
        <span className="flex min-w-0 items-center gap-2">
          <Initials name={name} />
          <span className="truncate">{name}</span>
        </span>
      )
    }
    case "stage": {
      const step = stages.findIndex((s) => s.value === deal.stage)
      return (
        <span className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-medium whitespace-nowrap ${stageTone[deal.stage]}`}>
          {deal.stage !== "won" && deal.stage !== "lost" && (
            <span aria-hidden="true" className="flex gap-0.5">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`h-2 w-[3px] rounded-full ${i <= step ? "bg-ink/70" : "bg-ink/15"}`} />
              ))}
            </span>
          )}
          {stageLabel(deal.stage)}
        </span>
      )
    }
    case "amount":
      return <span className="font-medium text-ink tabular-nums">{money.format(deal.amount)}</span>
    case "probability":
      return (
        <span className="flex w-full items-center gap-2.5">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <span className="block h-full rounded-full bg-ink/80 transition-[width] duration-300 ease-out" style={{ width: `${deal.probability}%` }} />
          </span>
          <span className="w-9 text-right text-[13px] text-body tabular-nums">{deal.probability}%</span>
        </span>
      )
    case "closeAt": {
      const overdue = deal.closeAt.slice(0, 10) < today && deal.stage !== "won" && deal.stage !== "lost"
      return (
        <span className="flex min-w-0 items-center gap-2 tabular-nums">
          <span className={`truncate ${overdue ? "text-ink" : ""}`}>{formatCloseAt(deal.closeAt)}</span>
          {overdue && <span className="rounded border border-ink/70 px-1 text-[11px] font-semibold tracking-wide text-ink uppercase">Late</span>}
        </span>
      )
    }
    case "notes":
      return deal.notes ? <span className="truncate text-body">{deal.notes}</span> : <span className="text-muted/70">Add a note</span>
  }
}

function Shortcut({ keys }: { keys: string }) {
  return <span className="text-[13px] text-muted">{keys}</span>
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 text-ink" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  if (!dir) return null
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-ink" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={dir === "asc" ? "M8 12.5v-9M4.5 7L8 3.5 11.5 7" : "M8 3.5v9M4.5 9L8 12.5 11.5 9"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PinIcon({ filled }: { filled: boolean }): ReactNode {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6 2.5h4l-.5 4 2.5 2.5H4L6.5 6.5 6 2.5zM8 9v4.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function GripIcon() {
  return (
    <svg viewBox="0 0 8 14" className="h-3.5 w-2" fill="currentColor" aria-hidden="true">
      {[2, 7, 12].flatMap((y) => [<circle key={`a${y}`} cx="2" cy={y} r="1.1" />, <circle key={`b${y}`} cx="6" cy={y} r="1.1" />])}
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
      <circle cx="3.5" cy="8" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="12.5" cy="8" r="1.2" />
    </svg>
  )
}

export { DealsTable }
