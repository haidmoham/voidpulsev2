export interface DemoAudioMetadata {
  title: string | null;
  attribution: string | null;
  license: string | null;
  licenseUrl: string | null;
}

export type DemoAudioConfig =
  | ({ available: true; url: string } & DemoAudioMetadata)
  | { available: false; reason: string };

type DemoAudioEnvironment = Partial<Record<
  | "VITE_DEMO_AUDIO_URL"
  | "VITE_DEMO_AUDIO_TITLE"
  | "VITE_DEMO_AUDIO_ATTRIBUTION"
  | "VITE_DEMO_AUDIO_LICENSE"
  | "VITE_DEMO_AUDIO_LICENSE_URL",
  string | undefined
>>;

const CONFIGURATION_HINT = "Set VITE_DEMO_AUDIO_URL to an absolute http(s) URL for a licensed sample.";

/**
 * Reads the optional sample seam without inferring ownership, artist, track,
 * or license information from the URL.
 */
export function readDemoAudioConfig(environment: DemoAudioEnvironment): DemoAudioConfig {
  const url = clean(environment.VITE_DEMO_AUDIO_URL);
  if (!url || !isHttpUrl(url)) return { available: false, reason: CONFIGURATION_HINT };

  return {
    available: true,
    url,
    title: clean(environment.VITE_DEMO_AUDIO_TITLE),
    attribution: clean(environment.VITE_DEMO_AUDIO_ATTRIBUTION),
    license: clean(environment.VITE_DEMO_AUDIO_LICENSE),
    licenseUrl: clean(environment.VITE_DEMO_AUDIO_LICENSE_URL),
  };
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
