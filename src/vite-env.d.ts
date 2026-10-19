/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API including the version prefix, for example `/api/v1`. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
