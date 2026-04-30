/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DROPBOX_APP_KEY: string
  readonly VITE_SPOTIFY_CLIENT_ID: string
  readonly VITE_SPOTIFY_REDIRECT_URI: string
  readonly VITE_MOCK_PROVIDER?: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
