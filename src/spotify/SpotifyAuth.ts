const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SCOPES = ["user-read-playback-state"];
const TOKEN_STORAGE_KEY = "voidpulse.spotify.tokens";
const VERIFIER_STORAGE_KEY = "voidpulse.spotify.verifier";
const STATE_STORAGE_KEY = "voidpulse.spotify.state";

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

    const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
    const expectedState = sessionStorage.getItem(STATE_STORAGE_KEY);
    sessionStorage.removeItem(VERIFIER_STORAGE_KEY);
    sessionStorage.removeItem(STATE_STORAGE_KEY);

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
    const serialized = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!serialized) return null;
    try {
      return JSON.parse(serialized) as StoredTokens;
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
  return response.json() as Promise<SpotifyTokenResponse>;
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
