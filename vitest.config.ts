import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    // Force DEMO mode regardless of a local .env.local so the suite stays
    // hermetic (never reaches a real Firebase project).
    env: {
      VITE_FIREBASE_API_KEY: '',
      VITE_FIREBASE_AUTH_DOMAIN: '',
      VITE_FIREBASE_PROJECT_ID: '',
      VITE_FIREBASE_STORAGE_BUCKET: '',
      VITE_FIREBASE_APP_ID: '',
      VITE_BACKEND_MODE: '',
    },
  },
})
