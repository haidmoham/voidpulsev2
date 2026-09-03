/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional direct URL for a rights-cleared, CORS-enabled demo sample. */
  readonly VITE_DEMO_AUDIO_URL?: string;
  readonly VITE_DEMO_AUDIO_TITLE?: string;
  readonly VITE_DEMO_AUDIO_ATTRIBUTION?: string;
  readonly VITE_DEMO_AUDIO_LICENSE?: string;
  readonly VITE_DEMO_AUDIO_LICENSE_URL?: string;
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
  readonly VITE_SPOTIFY_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
