import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { BottomBarProvider, BottomBarSlot } from '@/lib/bottomBar'

export default function App() {
  const { identity, isAdmin } = useAuth()

  return (
    <BottomBarProvider>
      <div className="h-screen h-dvh flex flex-col">
        <header
          className="border-b bg-white flex-shrink-0"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="container flex h-14 items-center justify-between gap-4">
            <Link to="/" className="font-semibold">
              SOL Cornhole
            </Link>
            <nav className="flex gap-4 text-sm items-center">
              <NavLink
                to="/events"
                className={({ isActive }) =>
                  isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                }
              >
                Events
              </NavLink>
            </nav>
            <div className="text-xs text-muted-foreground">
              {isAdmin ? (
                <span>{identity?.displayName} (admin)</span>
              ) : (
                // soldelco.com's own `redirect` param only accepts same-origin
                // paths (open-redirect protection), so it can't send someone
                // back to this subdomain -- they land on soldelco.com's home
                // page after picking a name and come back here manually.
                <a href="https://soldelco.com/whoami" className="underline">
                  Managing this tournament? Pick your name
                </a>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="container py-6">
            <Outlet />
          </div>
        </main>
        <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} className="flex-shrink-0">
          <BottomBarSlot />
        </div>
      </div>
    </BottomBarProvider>
  )
}
