/// <reference types="vite/client" />

declare const __APP_VERSION__: string
/** Full git SHA of the deployed build (Vercel VERCEL_GIT_COMMIT_SHA, or local git; 'unknown' if unavailable). */
declare const __BUILD_SHA__: string
/** Git ref/branch of the deployed build (e.g. 'staging', 'main'). */
declare const __BUILD_REF__: string
/** Deploy environment: 'production' | 'preview' | 'development' (Vercel) or 'local'. */
declare const __BUILD_ENV__: string

interface BuildInfo {
  readonly sha: string
  readonly ref: string
  readonly env: string
  readonly version: string
}

interface ImportMetaEnv {
  readonly VITE_DROPBOX_APP_KEY: string
  readonly VITE_SPOTIFY_CLIENT_ID: string
  readonly VITE_SPOTIFY_REDIRECT_URI: string
  readonly VITE_MOCK_PROVIDER?: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  /** Build provenance, exposed for quick deploy verification from the console. */
  __BUILD__?: BuildInfo
}
