/**
 * Validated runtime environment config — Firebase.
 *
 * Only PUBLIC client configuration may appear here (the Firebase web apiKey
 * is a client identifier, not a secret — security lives in Firestore/Storage
 * rules and Callable auth). Admin SDK service-account credentials must NEVER
 * be added to frontend code; server privileges exist only inside Cloud
 * Functions, which run on Google's servers.
 */
const key = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

const apiKey = key(import.meta.env.VITE_FIREBASE_API_KEY)
const authDomain = key(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)
const projectId = key(import.meta.env.VITE_FIREBASE_PROJECT_ID)
const storageBucket = key(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET)
const appId = key(import.meta.env.VITE_FIREBASE_APP_ID)

function configured(): boolean {
  return (
    apiKey.length > 20 &&
    !apiKey.includes('your-') &&
    /^[\w-]+\.firebaseapp\.com$/.test(authDomain) &&
    projectId.length > 4 &&
    appId.includes(':')
  )
}

export const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  appId,
  configured: configured(),
  missing: [
    ...(apiKey.length > 20 ? [] : ['VITE_FIREBASE_API_KEY']),
    ...(/^\w+\.firebaseapp\.com$/.test(authDomain) ? [] : ['VITE_FIREBASE_AUTH_DOMAIN']),
    ...(projectId.length > 4 ? [] : ['VITE_FIREBASE_PROJECT_ID']),
    ...(appId.includes(':') ? [] : ['VITE_FIREBASE_APP_ID']),
    ...(storageBucket.length > 4 ? [] : ['VITE_FIREBASE_STORAGE_BUCKET']),
  ],
} as const

/**
 * Backend mode:
 *  - 'functions'   — full server authority: checkout validated and orders
 *                    created by Cloud Functions (needs the Blaze plan).
 *  - 'rules-only'  — Spark/free plan fallback: Firestore security rules
 *                    enforce admin rights, order-draft constraints and status
 *                    transitions; totals are computed in-app from the live
 *                    Firestore menu data (never editable display text) and
 *                    orders are stored as UNVERIFIED drafts pending WhatsApp
 *                    confirmation by the restaurant.
 */
const mode = (typeof import.meta.env.VITE_BACKEND_MODE === 'string' ? import.meta.env.VITE_BACKEND_MODE : '').trim()

export const backendMode: 'functions' | 'rules-only' = mode === 'functions' ? 'functions' : 'rules-only'

/** Back-compat shape used by commerce modules. */
export const backend = {
  configured: firebaseConfig.configured,
  missing: firebaseConfig.missing,
  mode: backendMode,
} as const
