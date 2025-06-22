/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DROPBOX_APP_KEY: string
  readonly VITE_YOUTUBE_API_KEY?: string
  readonly VITE_UNSPLASH_ACCESS_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
