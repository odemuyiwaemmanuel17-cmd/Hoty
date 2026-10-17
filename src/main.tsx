import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// The private dashboard is a separate lazily-loaded chunk: the public
// homepage never ships or executes admin code. Authorization itself lives in
// database security rules (firestore.rules) + Cloud Functions, not in this switch.
const AdminApp = lazy(() => import('./components/admin/AdminApp'))

const isAdminRoute = window.location.pathname.replace(/\/+$/, '').startsWith('/admin')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-obsidian text-sm tracking-[0.3em] uppercase text-ash">
            Loading dashboard…
          </div>
        }
      >
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
