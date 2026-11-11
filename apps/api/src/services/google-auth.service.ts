import crypto from "crypto";
import type { Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { User, type IUser } from "../models/User.js";
import { env } from "../config/env.js";
import { AuthService } from "./auth.service.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "@crewconnect/shared";

export interface GoogleUserProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export interface GoogleOAuthSession {
  txId: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  createdAt: number;
}

// Google's trusted JWKS endpoint for OpenID Connect token verification
const GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");
const defaultJWKS = createRemoteJWKSet(GOOGLE_JWKS_URL);

export class GoogleAuthService {
  private static readonly STATE_COOKIE_PREFIX = "g_oauth_tx_";
  private static readonly STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private static readonly CLOCK_TOLERANCE_SECONDS = 30;
  private static readonly MAX_ID_TOKEN_AGE_SECONDS = 3600; // 1 hour bound on ID token age
  private static readonly MAX_REPLAY_CACHE_SIZE = 10_000;

  // Explicit allowlist of supported internal post-authentication application routes
  private static readonly ALLOWED_RETURN_ROUTES: RegExp[] = [
    /^\/$/,
    /^\/dashboard$/,
    /^\/profile$/,
    /^\/teams$/,
    /^\/teams-preview$/,
    /^\/teams\/[a-zA-Z0-9_-]+$/,
  ];

  // Bounded replay prevention cache mapping txId -> expiry timestamp
  private static consumedTransactions = new Map<string, number>();

  // Injectable JWKS key-set or custom verifier for deterministic testing
  private static jwksOverride: JWTVerifyGetKey | null = null;
  private static customVerifier:
    ((idToken: string, expectedNonce: string) => Promise<GoogleUserProfile>) | null = null;

  /**
   * Test hook: override JWKS key retriever (e.g. for local test keys)
   */
  static _setJwksOverride(override: JWTVerifyGetKey | null): void {
    this.jwksOverride = override;
  }

  /**
   * Test hook: override the full token verifier
   */
  static _setCustomVerifier(
    verifier: ((idToken: string, expectedNonce: string) => Promise<GoogleUserProfile>) | null
  ): void {
    this.customVerifier = verifier;
  }

  /**
   * Test hook: reset replay cache between isolated tests
   */
  static _clearReplayCache(): void {
    this.consumedTransactions.clear();
  }

  /**
   * Returns true if Google OAuth credentials are fully configured in the environment
   */
  static isConfigured(): boolean {
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  }

  /**
   * Resolves the canonical Google OAuth callback URL
   */
  static getCallbackUrl(): string {
    if (env.GOOGLE_CALLBACK_URL) {
      return env.GOOGLE_CALLBACK_URL;
    }
    return `http://localhost:${env.PORT}/api/v1/auth/google/callback`;
  }

  /**
   * Canonicalizes and validates returnTo destination against an explicit route allowlist:
   * - Rejects external origins, protocol-relative URLs (//), backslashes, and control characters
   * - Rejects malformed percent-encoding and double/multi-layer encoded ambiguities (%25, %2f, %5c, %3a)
   * - Validates parsed pathname against explicit internal application routes
   * - Preserves legitimate internal query parameters and hash fragments
   */
  static sanitizeReturnTo(returnTo?: string | null): string {
    if (!returnTo || typeof returnTo !== "string") {
      return "/dashboard";
    }

    const trimmed = returnTo.trim();
    if (!trimmed) {
      return "/dashboard";
    }

    // 1. Reject ASCII control characters, tabs, null bytes, or CRLF immediately
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(trimmed)) {
      return "/dashboard";
    }

    // 2. Must begin with a single '/', never '//' or '/\' or contain backslashes anywhere
    if (
      !trimmed.startsWith("/") ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("/\\") ||
      trimmed.includes("\\")
    ) {
      return "/dashboard";
    }

    // 3. Reject malformed percent sequences (any '%' not followed by two hex digits)
    if (/%(?![0-9a-fA-F]{2})/.test(trimmed)) {
      return "/dashboard";
    }

    // 4. Reject ambiguous / multi-layer percent encodings (%25 = encoded '%', %2f = '/', %5c = '\', %3a = ':')
    if (/%(25|2f|5c|3a)/i.test(trimmed)) {
      return "/dashboard";
    }

    // 5. Parse cleanly with WHATWG URL parser against a synthetic internal origin
    let parsed: URL;
    try {
      parsed = new URL(trimmed, "https://crewconnect.internal");
    } catch {
      return "/dashboard";
    }

    // Verify synthetic internal origin was not escaped
    if (parsed.origin !== "https://crewconnect.internal") {
      return "/dashboard";
    }

    // 6. Decode pathname and check for residual ambiguities or dot-segment traversal
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(parsed.pathname);
    } catch {
      return "/dashboard";
    }

    if (
      decodedPath !== parsed.pathname ||
      decodedPath.includes("..") ||
      decodedPath.includes("\\") ||
      decodedPath.includes("//") ||
      decodedPath.includes("%")
    ) {
      return "/dashboard";
    }

    // 7. Enforce explicit allowlist of supported internal application routes
    const isAllowedRoute = this.ALLOWED_RETURN_ROUTES.some((pattern) => pattern.test(decodedPath));
    if (!isAllowedRoute) {
      return "/dashboard";
    }

    // 8. Validate query string and hash decode cleanly without control characters or residual nesting
    try {
      const decodedSearch = parsed.search ? decodeURIComponent(parsed.search) : "";
      const decodedHash = parsed.hash ? decodeURIComponent(parsed.hash) : "";
      // eslint-disable-next-line no-control-regex
      if (/[\x00-\x1f\x7f\\]/.test(decodedSearch) || /[\x00-\x1f\x7f\\]/.test(decodedHash)) {
        return "/dashboard";
      }
      // Ensure no residual %25 or malformed sequences exist after single decode
      if (/%[0-9a-fA-F]{2}/.test(decodedSearch) || /%[0-9a-fA-F]{2}/.test(decodedHash)) {
        return "/dashboard";
      }
    } catch {
      return "/dashboard";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  /**
   * Cookie options scoped specifically to the OAuth callback endpoint
   */
  private static getStateCookieOptions() {
    return {
      ...AuthService.getCookieOptions(),
      path: "/api/v1/auth/google/callback",
    };
  }

  /**
   * Extracts and validates the transaction ID prefix from a formatted OAuth state string
   */
  private static extractTxId(state: string): string | null {
    const match = /^([a-f0-9]{24})\.([a-f0-9]{48})$/.exec(state);
    return match ? match[1] : null;
  }

  /**
   * Marks a transaction ID as consumed to prevent single-use replay attacks
   */
  private static markTransactionConsumed(txId: string): void {
    const now = Date.now();
    // Prune expired entries first
    for (const [id, expiry] of this.consumedTransactions.entries()) {
      if (expiry <= now) {
        this.consumedTransactions.delete(id);
      }
    }
    // Enforce hard memory cap
    if (this.consumedTransactions.size >= this.MAX_REPLAY_CACHE_SIZE) {
      const oldestKey = this.consumedTransactions.keys().next().value;
      if (oldestKey) {
        this.consumedTransactions.delete(oldestKey);
      }
    }
    this.consumedTransactions.set(txId, now + this.STATE_TTL_MS);
  }

  /**
   * Signs a serialized session payload using HMAC-SHA256 with JWT_SECRET
   */
  private static signSession(session: GoogleOAuthSession): string {
    const raw = JSON.stringify(session);
    const base64 = Buffer.from(raw).toString("base64url");
    const hmac = crypto.createHmac("sha256", env.JWT_SECRET).update(base64).digest("base64url");
    return `${base64}.${hmac}`;
  }

  /**
   * Verifies and decodes a signed session payload
   */
  private static verifySession(token: string): GoogleOAuthSession | null {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [base64, signature] = parts;
    const expected = crypto.createHmac("sha256", env.JWT_SECRET).update(base64).digest("base64url");

    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return null;
    }

    try {
      const parsed = JSON.parse(
        Buffer.from(base64, "base64url").toString("utf-8")
      ) as GoogleOAuthSession;
      if (!parsed.txId || !parsed.state || !parsed.nonce || !parsed.codeVerifier) {
        return null;
      }
      if (Date.now() - parsed.createdAt > this.STATE_TTL_MS) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Initiates an isolated Google OAuth flow:
   * - Generates unique per-attempt txId, state, nonce, and PKCE S256 verifier/challenge
   * - Binds transaction state into a per-txId signed HTTP-only cookie so concurrent tabs do not overwrite each other
   */
  static buildAuthorizationUrl(res: Response, returnToParam?: string): string {
    if (!this.isConfigured()) {
      throw new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        "Google OAuth is not configured on this server. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        503
      );
    }

    const txId = crypto.randomBytes(12).toString("hex"); // 24 hex chars
    const stateSecret = crypto.randomBytes(24).toString("hex"); // 48 hex chars
    const state = `${txId}.${stateSecret}`;
    const nonce = crypto.randomBytes(32).toString("hex");
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
    const returnTo = this.sanitizeReturnTo(returnToParam);

    const session: GoogleOAuthSession = {
      txId,
      state,
      nonce,
      codeVerifier,
      returnTo,
      createdAt: Date.now(),
    };

    const cookieName = `${this.STATE_COOKIE_PREFIX}${txId}`;
    res.cookie(cookieName, this.signSession(session), {
      ...this.getStateCookieOptions(),
      maxAge: this.STATE_TTL_MS,
    });

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      redirect_uri: this.getCallbackUrl(),
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      nonce,
      prompt: "select_account",
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Clears the transaction-specific state verification cookie
   */
  static clearSessionCookie(res: Response, txId?: string | null): void {
    if (txId) {
      res.clearCookie(`${this.STATE_COOKIE_PREFIX}${txId}`, this.getStateCookieOptions());
    }
  }

  /**
   * Exchanges an authorization code with Google token endpoint using the session's bound PKCE code_verifier
   */
  static async exchangeCode(
    code: string,
    codeVerifier: string
  ): Promise<{ access_token: string; id_token: string }> {
    if (!codeVerifier || typeof codeVerifier !== "string") {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "Missing PKCE code_verifier for authorization code exchange",
        401
      );
    }

    const callbackUrl = this.getCallbackUrl();
    const body = new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID || "",
      client_secret: env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: callbackUrl,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    });

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "Google rejected the authorization code or PKCE verifier during token exchange.",
        401
      );
    }

    const json = (await response.json()) as { access_token: string; id_token?: string };
    if (!json.id_token) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "Google token response did not contain required id_token",
        401
      );
    }

    return { access_token: json.access_token, id_token: json.id_token };
  }

  /**
   * Performs genuine OpenID Connect Google ID Token verification:
   * 1. Cryptographically verifies JWT signature against Google's public JWKS certificates
   * 2. Validates issuer is https://accounts.google.com or accounts.google.com
   * 3. Validates audience strictly equals configured GOOGLE_CLIENT_ID
   * 4. Validates expiration (exp), future issued-at (iat) within 30s clock tolerance, and maxTokenAge <= 3600s
   * 5. Requires all mandatory claims (iss, sub, aud, exp, iat, email, email_verified, nonce)
   * 6. Validates nonce matches initiating session nonce
   * 7. Validates email_verified is strictly true
   */
  static async verifyIdToken(idToken: string, expectedNonce: string): Promise<GoogleUserProfile> {
    if (this.customVerifier) {
      return this.customVerifier(idToken, expectedNonce);
    }

    if (!env.GOOGLE_CLIENT_ID) {
      throw new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        "Google OAuth client ID is not configured on this server.",
        503
      );
    }

    try {
      const keySet = this.jwksOverride || defaultJWKS;
      const { payload } = await jwtVerify(idToken, keySet, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: env.GOOGLE_CLIENT_ID,
        clockTolerance: this.CLOCK_TOLERANCE_SECONDS,
        maxTokenAge: this.MAX_ID_TOKEN_AGE_SECONDS,
        requiredClaims: ["iss", "sub", "aud", "exp", "iat", "email", "email_verified", "nonce"],
      });

      // Nonce binding validation
      if (!payload.nonce || payload.nonce !== expectedNonce) {
        throw new AppError(
          ERROR_CODES.UNAUTHORIZED,
          "ID token nonce mismatch. Replay or session substitution detected.",
          401
        );
      }

      // Verified email validation
      if (payload.email_verified !== true) {
        throw new AppError(
          ERROR_CODES.UNAUTHORIZED,
          "Google account email is not verified. Please verify your email with Google.",
          401
        );
      }

      // Subject identity validation
      if (!payload.sub || typeof payload.sub !== "string") {
        throw new AppError(
          ERROR_CODES.UNAUTHORIZED,
          "Missing valid subject (sub) claim in Google ID token.",
          401
        );
      }

      if (!payload.email || typeof payload.email !== "string") {
        throw new AppError(
          ERROR_CODES.UNAUTHORIZED,
          "Missing valid email claim in Google ID token.",
          401
        );
      }

      return {
        sub: payload.sub,
        email: payload.email,
        email_verified: true,
        name: typeof payload.name === "string" ? payload.name : undefined,
        picture: typeof payload.picture === "string" ? payload.picture : undefined,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      const message = err instanceof Error ? err.message : "ID token verification failed";
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        `Google ID token cryptographic verification failed: ${message}`,
        401
      );
    }
  }

  /**
   * Resolves or provisions a user account based on Google profile invariants:
   * - Finds existing user by googleId
   * - If found by email without googleId, rejects with 409 Conflict (no silent linking)
   * - If completely new, creates account (with duplicate key race handling)
   */
  static async resolveUser(profile: GoogleUserProfile): Promise<IUser> {
    const normalizedEmail = profile.email.toLowerCase().trim();

    // 1. Look for existing account already linked to this googleId
    const userByGoogleId = await User.findOne({ googleId: profile.sub });
    if (userByGoogleId) {
      if (userByGoogleId.status === "SUSPENDED") {
        throw new AppError(ERROR_CODES.FORBIDDEN, "Account has been suspended", 403);
      }
      let modified = false;
      if (!userByGoogleId.avatarUrl && profile.picture) {
        userByGoogleId.avatarUrl = profile.picture;
        modified = true;
      }
      if (modified) {
        await userByGoogleId.save();
      }
      return userByGoogleId;
    }

    // 2. Check if an account already exists with this email address
    const existingEmailUser = await User.findOne({ email: normalizedEmail });
    if (existingEmailUser) {
      throw new AppError(
        ERROR_CODES.EMAIL_ALREADY_EXISTS,
        `An account with email "${normalizedEmail}" already exists using password authentication. Please sign in with your email and password.`,
        409
      );
    }

    // 3. Provision new Google-authenticated user (with race-condition mitigation)
    try {
      const newUser = await User.create({
        email: normalizedEmail,
        displayName: (profile.name || normalizedEmail.split("@")[0]).trim().slice(0, 50),
        googleId: profile.sub,
        avatarUrl: profile.picture,
        authProvider: "google",
        skills: ["Builder"],
        status: "ACTIVE",
        timeZone: "UTC",
      });

      return newUser;
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: number }).code === 11000
      ) {
        const existing = await User.findOne({ googleId: profile.sub });
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  /**
   * Processes the full callback from Google:
   * - Identifies isolated transaction via state prefix txId
   * - Prevents replay via single-use consumption tracking and clearing transaction cookie
   * - Exchanges authorization code with bound PKCE codeVerifier
   * - Cryptographically verifies ID token, timing bounds, claims, and nonce
   * - Resolves user account safely and issues HTTP-only session cookie
   */
  static async handleCallback(
    req: Request,
    res: Response
  ): Promise<{ user: IUser; returnTo: string }> {
    const { code, state, error: oauthError } = req.query;
    const rawState = typeof state === "string" ? state : null;
    const txId = rawState ? this.extractTxId(rawState) : null;

    if (oauthError) {
      if (txId) {
        this.clearSessionCookie(res, txId);
        this.markTransactionConsumed(txId);
      }
      if (oauthError === "access_denied") {
        throw new AppError(ERROR_CODES.UNAUTHORIZED, "Google sign-in was cancelled.", 401);
      }
      throw new AppError(ERROR_CODES.UNAUTHORIZED, `Google authorization was not granted.`, 401);
    }

    if (!code || typeof code !== "string" || !rawState || !txId) {
      if (txId) {
        this.clearSessionCookie(res, txId);
      }
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        "Missing or malformed authorization code or state parameter.",
        400
      );
    }

    // Check single-use replay protection
    const consumedExpiry = this.consumedTransactions.get(txId);
    if (consumedExpiry && consumedExpiry > Date.now()) {
      this.clearSessionCookie(res, txId);
      throw new AppError(
        ERROR_CODES.CSRF_VIOLATION,
        "OAuth callback has already been consumed. Replay detected.",
        401
      );
    }

    const cookieName = `${this.STATE_COOKIE_PREFIX}${txId}`;
    const rawSessionCookie = req.cookies?.[cookieName];

    // Clear transaction cookie and mark consumed immediately upon attempt
    this.clearSessionCookie(res, txId);
    this.markTransactionConsumed(txId);

    if (!rawSessionCookie) {
      throw new AppError(
        ERROR_CODES.CSRF_VIOLATION,
        "OAuth session cookie expired or missing. Please try signing in again.",
        401
      );
    }

    const session = this.verifySession(rawSessionCookie);
    if (!session || session.txId !== txId || session.state !== rawState) {
      throw new AppError(
        ERROR_CODES.CSRF_VIOLATION,
        "Invalid or expired OAuth state parameter. Request rejected to prevent CSRF.",
        401
      );
    }

    // Exchange authorization code using this transaction's bound PKCE verifier
    const tokens = await this.exchangeCode(code, session.codeVerifier);

    // Cryptographically verify Google ID token and validate nonce
    const profile = await this.verifyIdToken(tokens.id_token, session.nonce);

    // Resolve or provision user
    const user = await this.resolveUser(profile);

    // Issue standard CrewConnect session cookie
    const token = AuthService.generateToken(user);
    AuthService.setAuthCookie(res, token);

    return { user, returnTo: session.returnTo };
  }
}
