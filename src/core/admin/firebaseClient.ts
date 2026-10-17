import { backend, firebaseConfig } from '../config/env'

/**
 * Lazily-created Firebase app + service handles. The firebase SDK is
 * dynamically imported so it lands in the admin/order chunk only — the
 * cinematic homepage never pays for it. Only PUBLIC web config is used
 * (the Firebase web apiKey is a client identifier, not a secret):
 * authorization is enforced by Firestore/Storage security rules and the
 * Cloud Functions callables, so a tampered browser session can never
 * read or write beyond what the rules grant.
 */
export interface FirebaseServices {
  auth: import('firebase/auth').Auth
  db: import('firebase/firestore').Firestore
  fn: import('firebase/functions').Functions
  storage: import('firebase/storage').FirebaseStorage
}

let services: Promise<FirebaseServices | null> | null = null

export function backendConfigured(): boolean {
  return backend.configured
}

export function getFb(): Promise<FirebaseServices | null> {
  if (!backend.configured) return Promise.resolve(null)
  if (!services) {
    services = (async () => {
      const [{ initializeApp }, { getAuth }, { getFirestore }, { getFunctions }, { getStorage }] =
        await Promise.all([
          import('firebase/app'),
          import('firebase/auth'),
          import('firebase/firestore'),
          import('firebase/functions'),
          import('firebase/storage'),
        ])
      const app = initializeApp({
        apiKey: firebaseConfig.apiKey,
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
        appId: firebaseConfig.appId,
      })
      return { auth: getAuth(app), db: getFirestore(app), fn: getFunctions(app), storage: getStorage(app) }
    })()
  }
  return services
}

export interface AdminSession {
  email: string | null
  isAdmin: boolean
}

/** Sign in with email/password (Firebase Auth). Errors surface as messages. */
export async function signIn(email: string, password: string): Promise<string | null> {
  const fb = await getFb()
  if (!fb) return 'Backend not configured.'
  const { signInWithEmailAndPassword } = await import('firebase/auth')
  try {
    await signInWithEmailAndPassword(fb.auth, email.trim(), password)
    return null
  } catch (e) {
    return e instanceof Error ? friendlyAuthError(e.message) : 'Sign-in failed.'
  }
}

function friendlyAuthError(code: string): string {
  const c = code.replace('auth/', '')
  if (c === 'invalid-credential' || c === 'wrong-password' || c === 'user-not-found')
    return 'Invalid email or password.'
  if (c === 'too-many-requests') return 'Too many attempts — wait a moment and try again.'
  if (c === 'user-disabled') return 'This account has been disabled.'
  return 'Sign-in failed. Check your credentials and try again.'
}

export async function signOut(): Promise<void> {
  const fb = await getFb()
  if (!fb) return
  const { signOut } = await import('firebase/auth')
  await signOut(fb.auth)
}

/**
 * Ask FIREBASE who this session is. The email itself comes from the verified
 * auth token (not browser storage); the admin flag is read from the
 * server-controlled `config/admins` document. This is a UI gate only — the
 * security rules enforce admin rights on every privileged read/write, and the
 * Cloud Functions re-check independently, so a forged client state gains
 * nothing.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const fb = await getFb()
  if (!fb) return null
  const user = fb.auth.currentUser
  if (!user) return null
  const email = user.email
  if (!email) return { email: null, isAdmin: false }
  try {
    const { doc, getDoc } = await import('firebase/firestore')
    const snap = await getDoc(doc(fb.db, 'config', 'admins'))
    const emails: unknown[] = snap.exists() ? (snap.data()?.emails ?? []) : []
    return { email, isAdmin: emails.map((e) => String(e).toLowerCase()).includes(email.toLowerCase()) }
  } catch {
    // Rules refuse the read for non-admins if the config doc is locked down —
    // treat that honestly as "not an admin", never as admin.
    return { email, isAdmin: false }
  }
}

export function onAuthChange(cb: () => void): () => void {
  if (!backendConfigured()) return () => {}
  let unsub = () => {}
  void getFb().then(async (fb) => {
    if (!fb) return
    const { onAuthStateChanged } = await import('firebase/auth')
    unsub = onAuthStateChanged(fb.auth, () => cb())
  })
  return () => unsub()
}
