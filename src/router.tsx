import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router"
import { AppShell } from "./components/layout/AppShell"
import BookingsPage from "./pages/BookingsPage"
import { DealsPage } from "./pages/DealsPage"

type BookingsSearch = { week?: string }

const rootRoute = createRootRoute({ component: AppShell })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/bookings" })
  },
})

const bookingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bookings",
  validateSearch: (search: Record<string, unknown>): BookingsSearch => ({
    week: typeof search.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.week) ? search.week : undefined,
  }),
  component: BookingsPage,
})

const dealsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deals",
  component: DealsPage,
})

const routeTree = rootRoute.addChildren([indexRoute, bookingsRoute, dealsRoute])

const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

export { router }
