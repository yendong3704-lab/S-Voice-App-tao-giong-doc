/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_OWNER_MAX_CHARS_PER_TURN?: string;
  readonly VITE_OWNER_DAILY_QUOTA_PER_DEVICE?: string;
  readonly VITE_OWNER_COOLDOWN_SECONDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
