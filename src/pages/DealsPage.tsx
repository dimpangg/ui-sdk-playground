import { Input } from "@ui-sdk/react/input"
import { Menu, MenuCheckboxItem, MenuContent, MenuGroup, MenuGroupLabel, MenuItem, MenuSeparator, MenuTrigger } from "@ui-sdk/react/menu"
import { Toolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator } from "@ui-sdk/react/toolbar"
import { useMemo, useState } from "react"
import { DealsTable, columns, compactMoney, defaultLayout, reviveLayout, seedDeals, stages, usePersistentState, type Deal, type Layout, type Stage } from "../components/data-table"
import { buttonClass } from "../components/ui/button"

const LAYOUT_KEY = "ui-sdk-playground:deals:layout"
const EDITS_KEY = "ui-sdk-playground:deals:edits"

const baseDeals = seedDeals()
const today = new Date().toISOString().slice(0, 10)

type Edits = Record<string, Partial<Deal>>

const menuPanel =
  "z-50 min-w-52 rounded-xl border border-line bg-surface p-1 text-[15px] text-body shadow-popover outline-none transition-[opacity,scale] duration-150 ease-out origin-(--transform-origin) data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0 motion-reduce:transition-none"
const menuItem =
  "flex h-8 cursor-default items-center gap-2.5 rounded-md px-2.5 outline-none select-none data-highlighted:bg-line-soft data-highlighted:text-ink data-disabled:text-muted/60"

function compare(a: Deal, b: Deal, id: keyof Deal) {
  const x = a[id]
  const y = b[id]
  if (id === "stage") return stages.findIndex((s) => s.value === x) - stages.findIndex((s) => s.value === y)
  if (typeof x === "number" && typeof y === "number") return x - y
  return String(x).localeCompare(String(y))
}

function DealsPage() {
  const [layout, setLayout] = usePersistentState<Layout>(LAYOUT_KEY, defaultLayout, reviveLayout)
  const [edits, setEdits] = usePersistentState<Edits>(EDITS_KEY, {})
  const [query, setQuery] = useState("")
  const [stageFilter, setStageFilter] = useState<Stage | "open" | "all">("all")

  const deals = useMemo(() => baseDeals.map((d) => (edits[d.id] ? { ...d, ...edits[d.id] } : d)), [edits])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = deals.filter((d) => {
      if (stageFilter === "open" && (d.stage === "won" || d.stage === "lost")) return false
      if (stageFilter !== "all" && stageFilter !== "open" && d.stage !== stageFilter) return false
      return !q || d.name.toLowerCase().includes(q) || d.company.toLowerCase().includes(q) || d.id.toLowerCase().includes(q)
    })
    const sort = layout.sort
    if (sort) list = [...list].sort((a, b) => compare(a, b, sort.id) * (sort.dir === "asc" ? 1 : -1))
    return list
  }, [deals, query, stageFilter, layout.sort])

  const pinnedSet = new Set(layout.pinnedRows)
  const byId = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals])
  const pinned = layout.pinnedRows.map((id) => byId.get(id)).filter((d): d is Deal => !!d)
  const rows = visible.filter((d) => !pinnedSet.has(d.id))

  const stats = useMemo(() => {
    const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost")
    const won = deals.filter((d) => d.stage === "won")
    return {
      pipeline: open.reduce((s, d) => s + d.amount, 0),
      weighted: open.reduce((s, d) => s + (d.amount * d.probability) / 100, 0),
      won: won.reduce((s, d) => s + d.amount, 0),
      open: open.length,
      wonCount: won.length,
    }
  }, [deals])

  const editCount = Object.values(edits).reduce((n, e) => n + Object.keys(e).length, 0)

  const onEdit = (id: string, patch: Partial<Deal>) =>
    setEdits((all) => {
      const base = baseDeals.find((d) => d.id === id)
      const next = { ...all[id], ...patch }
      // Editing a value back to the original clears the change marker.
      for (const k of Object.keys(next) as (keyof Deal)[]) if (base && base[k] === next[k]) delete next[k]
      const copy = { ...all }
      if (Object.keys(next).length) copy[id] = next
      else delete copy[id]
      return copy
    })

  const filters: { value: typeof stageFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "open", label: "Open" },
    { value: "won", label: "Won" },
    { value: "lost", label: "Lost" },
  ]

  return (
    <div className="flex h-svh min-h-0 flex-col gap-5 px-8 py-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium tracking-wide text-muted">Northwind CRM · Sales</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-ink">Pipeline</h1>
        </div>
        <dl className="flex gap-8">
          <Stat label="Open pipeline" value={compactMoney.format(stats.pipeline)} hint={`${stats.open.toLocaleString()} deals`} />
          <Stat label="Weighted forecast" value={compactMoney.format(stats.weighted)} hint="Amount × probability" />
          <Stat label="Closed won" value={compactMoney.format(stats.won)} hint={`${stats.wonCount.toLocaleString()} deals`} />
        </dl>
      </header>

      <Toolbar aria-label="Table controls" className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search deals, companies, IDs"
          aria-label="Search deals"
          className="h-9 w-72 rounded-lg border border-line bg-surface px-3 text-[15px] text-ink shadow-soft outline-none placeholder:text-muted/80 focus-visible:border-ink/40 focus-visible:ring-2 focus-visible:ring-ink/10"
        />
        <ToolbarGroup aria-label="Stage" className="flex items-center rounded-lg border border-line bg-surface p-0.5 shadow-soft">
          {filters.map((f) => (
            <ToolbarButton
              key={f.value}
              aria-pressed={stageFilter === f.value}
              onClick={() => setStageFilter(f.value)}
              className="h-8 rounded-md px-3 text-[14px] font-medium text-body transition-colors duration-150 hover:text-ink aria-pressed:bg-ink aria-pressed:text-surface"
            >
              {f.label}
            </ToolbarButton>
          ))}
        </ToolbarGroup>
        <span className="ml-1 text-[14px] text-muted tabular-nums" aria-live="polite">
          {visible.length.toLocaleString()} of {deals.length.toLocaleString()}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {editCount > 0 && (
            <span className="flex items-center gap-1.5 text-[14px] text-muted">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-ink/60" />
              {editCount} unsaved-to-server {editCount === 1 ? "change" : "changes"} · kept locally
            </span>
          )}
          <ToolbarSeparator className="mx-1 h-5 w-px bg-line" />
          <Menu>
            <MenuTrigger render={<ToolbarButton />} className={buttonClass("secondary")}>
              <ColumnsIcon />
              View
            </MenuTrigger>
            <MenuContent className={menuPanel} align="end" sideOffset={6}>
              <MenuGroup>
                <MenuGroupLabel className="px-2.5 pt-1.5 pb-1 text-[12px] font-medium tracking-wide text-muted uppercase">Columns</MenuGroupLabel>
                {columns.map((c) => (
                  <MenuCheckboxItem
                    key={c.id}
                    value={c.id}
                    disabled={c.id === "name"}
                    checked={!layout.hidden.includes(c.id)}
                    onCheckedChange={(checked) =>
                      setLayout((l) => ({ ...l, hidden: checked ? l.hidden.filter((h) => h !== c.id) : [...l.hidden, c.id] }))
                    }
                    className={`${menuItem} group/check`}
                  >
                    <span className="grid size-4 place-items-center rounded border border-line text-surface group-data-checked/check:border-ink group-data-checked/check:bg-ink">
                      <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                        <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {c.label}
                  </MenuCheckboxItem>
                ))}
              </MenuGroup>
              <MenuSeparator className="my-1 h-px bg-line" />
              <MenuItem className={menuItem} onClick={() => setLayout(defaultLayout)}>
                Reset layout
              </MenuItem>
              <MenuItem className={menuItem} disabled={editCount === 0} onClick={() => setEdits({})}>
                Discard local edits
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </Toolbar>

      <DealsTable rows={rows} pinned={pinned} edited={edits} layout={layout} onLayoutChange={setLayout} onEdit={onEdit} today={today} />

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted">
        <Hint keys="↑ ↓ ← →">Move</Hint>
        <Hint keys="Enter">Edit · open column menu</Hint>
        <Hint keys="Tab">Save &amp; next</Hint>
        <Hint keys="Esc">Cancel</Hint>
        <Hint keys="⌥ ← →">Move column</Hint>
        <Hint keys="⇧ ← →">Resize column</Hint>
        <Hint keys="Space">Sort · pin row</Hint>
        <span className="ml-auto whitespace-nowrap">Layout and edits are saved in this browser.</span>
      </footer>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-32">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[22px] font-semibold tracking-tight text-ink tabular-nums">{value}</dd>
      <dd className="text-[13px] text-muted">{hint}</dd>
    </div>
  )
}

function Hint({ keys, children }: { keys: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded border border-line bg-surface px-1.5 py-px font-sans text-[12px] text-body shadow-soft">{keys}</kbd>
      {children}
    </span>
  )
}

function ColumnsIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M6 3v10M10 3v10" />
    </svg>
  )
}

export { DealsPage }
