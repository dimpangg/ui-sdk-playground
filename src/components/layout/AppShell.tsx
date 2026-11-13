import { Outlet } from "@tanstack/react-router"
import { Sidebar } from "./Sidebar"

function AppShell() {
  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}

export { AppShell }
