/** Mock CRM data: a deals pipeline, its teammates and a fake search API. Deterministic so reloads match. */

type Stage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost"

type Deal = {
  id: string
  name: string
  company: string
  ownerId: string
  stage: Stage
  amount: number
  probability: number
  /** Local date and time, `YYYY-MM-DDTHH:mm`. */
  closeAt: string
  notes: string
}

type User = { value: string; label: string; team: string }

const stages: { value: Stage; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Closed won" },
  { value: "lost", label: "Closed lost" },
]

const stageLabel = (stage: Stage) => stages.find((s) => s.value === stage)?.label ?? stage

const companies = [
  "Acme Logistics", "Bluefin Health", "Brightline Labs", "Cobalt Systems", "Copperleaf Bank", "Driftwood Media",
  "Evergreen Foods", "Fathom Analytics", "Foxglove Retail", "Granite Insurance", "Harbor Freight Co", "Helios Energy",
  "Ironclad Security", "Juniper Travel", "Keystone Realty", "Lakeside Clinics", "Lumen Robotics", "Maple Education",
  "Meridian Airlines", "Northwind Traders", "Nimbus Cloud", "Oakridge Pharma", "Orbit Telecom", "Pinecrest Hotels",
  "Polaris Mobility", "Quartz Payments", "Redwood Studios", "Riverstone Capital", "Saffron Kitchens", "Sequoia Legal",
  "Silverline Freight", "Summit Outdoor", "Tandem Bikes", "Tidewater Marine", "Umbra Games", "Vantage Retail",
  "Verdant Farms", "Wavelength Audio", "Willow Care", "Zephyr Wind",
]

const first = ["Ayu", "Bima", "Citra", "Dimas", "Eka", "Fajar", "Gita", "Hana", "Indra", "Joko", "Kirana", "Laras", "Maya", "Nadia", "Oscar", "Putri", "Raka", "Sari", "Tono", "Wulan", "Yusuf", "Zahra", "Alex", "Jordan", "Sam", "Taylor", "Morgan", "Riley", "Casey", "Jamie"]
const last = ["Pratama", "Santoso", "Wijaya", "Halim", "Saputra", "Kusuma", "Nugroho", "Lestari", "Hartono", "Gunawan", "Tan", "Lim", "Chen", "Park", "Nguyen", "Silva", "Novak", "Okafor", "Reyes", "Schmidt"]
const teams = ["Enterprise", "Mid-market", "SMB", "Partnerships", "APAC", "EMEA"]

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const users: User[] = (() => {
  const rand = rng(7)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]
  return Array.from({ length: 5000 }, (_, i) => ({
    value: `u${i + 1}`,
    label: `${pick(first)} ${pick(last)}`,
    team: pick(teams),
  }))
})()

const userById = new Map(users.map((u) => [u.value, u]))
const ownerName = (id: string) => userById.get(id)?.label ?? "Unassigned"

/** Fake `GET /api/users?q=`: 250–450ms latency, honours abort, returns every match. */
function searchUsers(query: string, { signal }: { signal: AbortSignal }) {
  return new Promise<User[]>((resolve, reject) => {
    const timer = setTimeout(
      () => {
        const needle = query.trim().toLowerCase()
        resolve(needle ? users.filter((u) => u.label.toLowerCase().includes(needle) || u.team.toLowerCase().includes(needle)) : users)
      },
      250 + Math.random() * 200,
    )
    signal.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })
}

const pad = (n: number) => String(n).padStart(2, "0")

function seedDeals(count = 2400): Deal[] {
  const rand = rng(42)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]
  const products = ["Platform renewal", "Expansion", "Pilot", "Annual plan", "Data add-on", "Seats upgrade", "Migration", "Support tier"]
  const notes = ["", "", "Waiting on security review.", "Champion moved teams, re-qualify.", "Legal redlines on MSA.", "Budget confirmed for Q1.", "Needs SSO and audit log.", "Asked for multi-year discount."]
  const base = new Date()
  return Array.from({ length: count }, (_, i) => {
    const stage = pick(stages).value
    const close = new Date(base.getFullYear(), base.getMonth(), base.getDate() + Math.floor(rand() * 120) - 30)
    const probability = stage === "won" ? 100 : stage === "lost" ? 0 : Math.round(rand() * 18) * 5 + 5
    return {
      id: `D-${String(1001 + i)}`,
      name: `${pick(companies).split(" ")[0]} ${pick(products)}`,
      company: pick(companies),
      ownerId: pick(users).value,
      stage,
      amount: Math.round((2 + rand() * 180) * 10) * 100,
      probability,
      closeAt: `${close.getFullYear()}-${pad(close.getMonth() + 1)}-${pad(close.getDate())}T${pad(9 + Math.floor(rand() * 9))}:${rand() > 0.5 ? "30" : "00"}`,
      notes: pick(notes),
    }
  })
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 })
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })

function formatCloseAt(value: string) {
  const [d, t = "00:00"] = value.split("T")
  const [y, m, day] = d.split("-").map(Number)
  const [h, min] = t.split(":").map(Number)
  return dateTimeFmt.format(new Date(y, m - 1, day, h, min))
}

export {
  companies,
  compactMoney,
  formatCloseAt,
  money,
  ownerName,
  searchUsers,
  seedDeals,
  stageLabel,
  stages,
  users,
  type Deal,
  type Stage,
  type User,
}
