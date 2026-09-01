const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SCOPES = ["user-read-playback-state"];
const TOKEN_STORAGE_KEY = "faltone.spotify.tokens";
const VERIFIER_STORAGE_KEY = "faltone.spotify.verifier";
const STATE_STORAGE_KEY = "faltone.spotify.state";
const LEGACY_TOKEN_STORAGE_KEY = "voidpulse.spotify.tokens";
const LEGACY_VERIFIER_STORAGE_KEY = "voidpulse.spotify.verifier";
const LEGACY_STATE_STORAGE_KEY = "voidpulse.spotify.state";

interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
}

interface StoredTokens {
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
}

interface StoredTokenCandidate {
  accessToken?: unknown;
  expiresAt?: unknown;
  refreshToken?: unknown;
}

interface SpotifyTokenCandidate {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  token_type?: unknown;
}

export type SpotifyAuthStatus = "unconfigured" | "disconnected" | "connecting" | "connected";

export class SpotifyAuth {
  private readonly clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim() ?? "";
  private readonly redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI?.trim()
    || `${window.location.origin}/callback`;

  status(): SpotifyAuthStatus {
    if (!this.clientId) return "unconfigured";
    if (new URL(window.location.href).searchParams.has("code")) return "connecting";
    return this.readTokens() ? "connected" : "disconnected";
  }

  async connect(): Promise<void> {
    if (!this.clientId) {
      throw new Error("VITE_SPOTIFY_CLIENT_ID is not configured");
    }

    const verifier = randomUrlSafeString(64);
    const state = randomUrlSafeString(24);
    const challenge = await sha256Base64Url(verifier);
    sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier);
    sessionStorage.setItem(STATE_STORAGE_KEY, state);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      scope: SCOPES.join(" "),
      redirect_uri: this.redirectUri,
      state,
      code_challenge_method: "S256",
      code_challenge: challenge,
    });

    window.location.assign(`${AUTHORIZE_URL}?${params}`);
  }

  async handleCallback(): Promise<boolean> {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    if (!code && !error) return false;

    if (error) {
      this.cleanCallbackUrl();
      throw new Error(`Spotify authorization failed: ${error}`);
    }

    const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY)
      ?? sessionStorage.getItem(LEGACY_VERIFIER_STORAGE_KEY);
    const expectedState = sessionStorage.getItem(STATE_STORAGE_KEY)
      ?? sessionStorage.getItem(LEGACY_STATE_STORAGE_KEY);
    sessionStorage.removeItem(VERIFIER_STORAGE_KEY);
    sessionStorage.removeItem(STATE_STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_VERIFIER_STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_STATE_STORAGE_KEY);

    if (!verifier || !returnedState || returnedState !== expectedState) {
      this.cleanCallbackUrl();
      throw new Error("Spotify OAuth state mismatch");
    }

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code ?? "",
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        code_verifier: verifier,
      }),
    });

    if (!response.ok) {
      this.cleanCallbackUrl();
      throw new Error(`Spotify token exchange failed (${response.status})`);
    }

    this.storeTokens(await parseTokenResponse(response));
    this.cleanCallbackUrl();
    return true;
  }

  async accessToken(): Promise<string | null> {
    const tokens = this.readTokens();
    if (!tokens) return null;
    if (Date.now() < tokens.expiresAt - 60_000) return tokens.accessToken;
    if (!tokens.refreshToken) {
      this.disconnect();
      return null;
    }

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
        client_id: this.clientId,
      }),
    });

    if (!response.ok) {
      this.disconnect();
      return null;
    }

    const refreshed = await parseTokenResponse(response);
    this.storeTokens(refreshed, tokens.refreshToken);
    return refreshed.access_token;
  }

  disconnect(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
  }

  private storeTokens(response: SpotifyTokenResponse, fallbackRefreshToken = ""): void {
    const tokens: StoredTokens = {
      accessToken: response.access_token,
      expiresAt: Date.now() + response.expires_in * 1000,
      refreshToken: response.refresh_token ?? fallbackRefreshToken,
    };
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  }

  private readTokens(): StoredTokens | null {
    const serialized = localStorage.getItem(TOKEN_STORAGE_KEY)
      ?? localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY);
    if (!serialized) return null;
    try {
      const parsed: unknown = JSON.parse(serialized);
      if (Object.prototype.toString.call(parsed) !== "[object Object]") {
        this.disconnect();
        return null;
      }
      // SAFETY: the record check above establishes the boundary object; every field is decoded below.
      const candidate = parsed as StoredTokenCandidate;
      if (
        Object.prototype.toString.call(candidate.accessToken) !== "[object String]"
        || Object.prototype.toString.call(candidate.expiresAt) !== "[object Number]"
        || !Number.isFinite(Number(candidate.expiresAt))
        || Object.prototype.toString.call(candidate.refreshToken) !== "[object String]"
      ) {
        this.disconnect();
        return null;
      }
      const tokens = {
        accessToken: String(candidate.accessToken),
        expiresAt: Number(candidate.expiresAt),
        refreshToken: String(candidate.refreshToken),
      };
      if (!localStorage.getItem(TOKEN_STORAGE_KEY)) {
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
      }
      localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
      return tokens;
    } catch {
      this.disconnect();
      return null;
    }
  }

  private cleanCallbackUrl(): void {
    window.history.replaceState({}, "", "/");
  }
}

async function parseTokenResponse(response: Response): Promise<SpotifyTokenResponse> {
  const parsed: unknown = await response.json();
  if (Object.prototype.toString.call(parsed) !== "[object Object]") {
    throw new Error("Spotify returned an invalid token payload");
  }
  // SAFETY: the record check above establishes the boundary object; every field is decoded below.
  const candidate = parsed as SpotifyTokenCandidate;
  if (
    Object.prototype.toString.call(candidate.access_token) !== "[object String]"
    || Object.prototype.toString.call(candidate.expires_in) !== "[object Number]"
    || !Number.isFinite(Number(candidate.expires_in))
    || Object.prototype.toString.call(candidate.token_type) !== "[object String]"
    || (
      candidate.refresh_token !== undefined
      && Object.prototype.toString.call(candidate.refresh_token) !== "[object String]"
    )
  ) {
    throw new Error("Spotify returned an invalid token payload");
  }
  return {
    access_token: String(candidate.access_token),
    expires_in: Number(candidate.expires_in),
    refresh_token: candidate.refresh_token === undefined
      ? undefined
      : String(candidate.refresh_token),
    token_type: String(candidate.token_type),
  };
}

function randomUrlSafeString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return base64Url(bytes);
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
