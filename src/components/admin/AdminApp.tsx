import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { backendConfigured, getAdminSession, onAuthChange, signIn, signOut, type AdminSession } from '../../core/admin/firebaseClient'
import { backend } from '../../core/config/env'
import { Overview } from './Overview'
import { MenuManager } from './MenuManager'
import { OrdersAdmin } from './OrdersAdmin'

type Phase = 'checking' | 'unconfigured' | 'signed-out' | 'not-admin' | 'ready'
type Tab = 'overview' | 'menu' | 'orders'

/**
 * Private restaurant dashboard at /admin.
 * Gate order: (1) backend configured? (2) Firebase Auth session?
 * (3) admin email present in the server-controlled config/admins document.
 * Hiding this UI is convenience — the Firestore security rules and Cloud
 * Functions refuse every unauthorized read/write regardless.
 */
export default function AdminApp() {
  const [phase, setPhase] = useState<Phase>('checking')
  const [session, setSession] = useState<AdminSession | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  const refresh = useCallback(async () => {
    if (!backendConfigured()) {
      setPhase('unconfigured')
      return
    }
    setPhase('checking')
    const s = await getAdminSession()
    setSession(s)
    if (!s) setPhase('signed-out')
    else setPhase(s.isAdmin ? 'ready' : 'not-admin')
  }, [])

  useEffect(() => {
    void refresh()
    return onAuthChange(() => void refresh())
  }, [refresh])

  if (phase === 'checking') return <Centered>Checking access…</Centered>

  if (phase === 'unconfigured') {
    return (
      <Centered>
        <div className="max-w-lg rounded-2xl border border-charcoal-line bg-coal p-8 text-left">
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-cream">Dashboard not connected</h1>
          <p className="mt-3 text-sm leading-relaxed text-ash">
            The admin area needs the restaurant database before it can show real orders or manage the
            menu. Nothing is displayed here until it is configured — no demo or fabricated data.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-smoke">
            <li>Create a Firebase project (console.firebase.google.com) with Authentication (Email/Password) and a Firestore database.</li>
            <li>
              Publish the rules from <code className="text-gold">firestore.rules</code> in Firestore → Rules
              (the free plan is enough; Cloud Functions are optional for server-verified pricing).
            </li>
            <li>
              Register admins: create the Firestore document{' '}
              <code className="text-gold">config/admins</code> with{' '}
              <code className="text-gold">{`{ emails: ["owner@email.com"] }`}</code> — the emails must
              match their Authentication accounts.
            </li>
            <li>
              Set the <code className="text-gold">VITE_FIREBASE_*</code> web-config variables (public web
              API key only — service-account credentials never go in frontend code) and rebuild.
            </li>
          </ol>
          {backend.missing.length > 0 && (
            <p className="mt-4 text-xs text-flame">Missing: {backend.missing.join(', ')}</p>
          )}
        </div>
      </Centered>
    )
  }

  if (phase === 'signed-out') return <SignIn onDone={refresh} />

  if (phase === 'not-admin') {
    return (
      <Centered>
        <div className="max-w-md rounded-2xl border border-ember/40 bg-coal p-8 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-xl text-cream">Not authorized</h1>
          <p className="mt-2 text-sm text-ash">
            Signed in as {session?.email} — this account is not on the restaurant admin list.
          </p>
          <SignOutButton onDone={refresh} />
        </div>
      </Centered>
    )
  }

  return (
    <div className="min-h-screen bg-obsidian text-cream">
      <header className="border-b border-charcoal-line bg-coal/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-baseline gap-3">
            <span className="font-[family-name:var(--font-display)] text-xl">
              Hot <span className="text-ember">&amp;</span> Appetizing
            </span>
            <span className="text-[10px] tracking-[0.35em] uppercase text-ash">Restaurant dashboard</span>
          </div>
          <nav className="flex items-center gap-1" aria-label="Dashboard sections">
            {(['overview', 'menu', 'orders'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-current={tab === t ? 'page' : undefined}
                className={`min-h-11 rounded-full px-4 text-xs uppercase tracking-[0.2em] ${
                  tab === t ? 'bg-ember text-obsidian' : 'text-smoke hover:text-flame'
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-xs text-ash">
            <span>{session?.email}</span>
            <SignOutButton onDone={refresh} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        {tab === 'overview' && <Overview />}
        {tab === 'menu' && <MenuManager />}
        {tab === 'orders' && <OrdersAdmin />}
      </main>
    </div>
  )
}

function SignOutButton({ onDone }: { onDone: () => Promise<void> | void }) {
  return (
    <button
      onClick={() => void signOut().then(onDone)}
      className="min-h-11 rounded-full border border-charcoal-line px-4 text-xs uppercase tracking-[0.2em] text-smoke hover:border-ember hover:text-flame"
    >
      Sign out
    </button>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-obsidian p-6 text-cream">{children}</div>
}

function SignIn({ onDone }: { onDone: () => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await signIn(email, password)
    setBusy(false)
    if (err) setError(err)
    else await onDone()
  }

  return (
    <Centered>
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-charcoal-line bg-coal p-8">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-cream">Staff sign in</h1>
        <p className="mt-1 text-xs text-ash">Authorized restaurant accounts only.</p>
        <label className="mt-6 block text-xs text-ash">
          Email
          <input
            type="email"
            name="admin-email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-charcoal-line bg-obsidian px-3 py-2.5 text-sm text-cream"
          />
        </label>
        <label className="mt-3 block text-xs text-ash">
          Password
          <input
            type="password"
            name="admin-password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-charcoal-line bg-obsidian px-3 py-2.5 text-sm text-cream"
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 rounded border border-ember/40 bg-ember/10 p-2 text-xs text-flame">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="mt-6 w-full rounded-full bg-ember px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-obsidian hover:bg-flame disabled:opacity-40"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </Centered>
  )
}
