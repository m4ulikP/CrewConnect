import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import {
  generateKeyPair,
  exportJWK,
  SignJWT,
  type GenerateKeyPairResult,
  type KeyLike,
} from "jose";
import { app } from "../src/app.js";
import { User } from "../src/models/User.js";
import { connectToDatabase, disconnectDatabase } from "../src/db/connection.js";
import { GoogleAuthService, type GoogleUserProfile } from "../src/services/google-auth.service.js";
import { env } from "../src/config/env.js";

describe("Phase 1.1.1 — Google OAuth Security Audit & Edge-Case Verification", () => {
  let testKeyPair: GenerateKeyPairResult<KeyLike>;
  let untrustedKeyPair: GenerateKeyPairResult<KeyLike>;

  beforeAll(async () => {
    await connectToDatabase();
    await User.syncIndexes();

    testKeyPair = await generateKeyPair("RS256");
    untrustedKeyPair = await generateKeyPair("RS256");
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@test-google-auth\.com$/ });
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await User.deleteMany({ email: /@test-google-auth\.com$/ });
    vi.restoreAllMocks();
    GoogleAuthService._setJwksOverride(null);
    GoogleAuthService._setCustomVerifier(null);
    GoogleAuthService._clearReplayCache();
  });

  async function createTestIdToken(
    claims: Record<string, unknown> = {},
    keyPair: GenerateKeyPairResult<KeyLike> = testKeyPair,
    options: { iat?: number; exp?: number | string; omitClaims?: string[] } = {}
  ) {
    const payload: Record<string, unknown> = {
      iss: "https://accounts.google.com",
      aud: "mock-client-id.apps.googleusercontent.com",
      sub: "verified-google-sub-12345",
      email: "alex@test-google-auth.com",
      email_verified: true,
      name: "Alex Rivera",
      picture: "https://lh3.googleusercontent.com/alex.jpg",
      nonce: "mock-nonce-12345",
      ...claims,
    };

    if (options.omitClaims) {
      for (const key of options.omitClaims) {
        delete payload[key];
      }
    }

    const builder = new SignJWT(payload).setProtectedHeader({ alg: "RS256", kid: "test-key-id" });

    if (!options.omitClaims?.includes("iat")) {
      builder.setIssuedAt(options.iat);
    }

    if (!options.omitClaims?.includes("exp")) {
      builder.setExpirationTime(options.exp ?? "1h");
    }

    return builder.sign(keyPair.privateKey);
  }

  describe("1. Genuine OIDC Token Verification, Time Bounds & Claims", () => {
    it("successfully verifies authentic Google ID token signed by trusted key", async () => {
      const origId = env.GOOGLE_CLIENT_ID;
      try {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID =
          "mock-client-id.apps.googleusercontent.com";

        const testJwk = await exportJWK(testKeyPair.publicKey);
        testJwk.kid = "test-key-id";
        testJwk.alg = "RS256";
        GoogleAuthService._setJwksOverride(async () => testKeyPair.publicKey);

        const idToken = await createTestIdToken({ nonce: "test-nonce-abc" });
        const profile = await GoogleAuthService.verifyIdToken(idToken, "test-nonce-abc");

        expect(profile.sub).toBe("verified-google-sub-12345");
        expect(profile.email).toBe("alex@test-google-auth.com");
        expect(profile.email_verified).toBe(true);
        expect(profile.name).toBe("Alex Rivera");
      } finally {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = origId;
      }
    });

    it("rejects token signed by untrusted private key (signature forgery)", async () => {
      const origId = env.GOOGLE_CLIENT_ID;
      try {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID =
          "mock-client-id.apps.googleusercontent.com";
        GoogleAuthService._setJwksOverride(async () => testKeyPair.publicKey);

        const forgedToken = await createTestIdToken({ nonce: "nonce-1" }, untrustedKeyPair);

        await expect(GoogleAuthService.verifyIdToken(forgedToken, "nonce-1")).rejects.toThrow(
          /cryptographic verification failed/i
        );
      } finally {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = origId;
      }
    });

    it("rejects expired Google ID token beyond 30s clock tolerance", async () => {
      const origId = env.GOOGLE_CLIENT_ID;
      try {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID =
          "mock-client-id.apps.googleusercontent.com";
        GoogleAuthService._setJwksOverride(async () => testKeyPair.publicKey);

        const now = Math.floor(Date.now() / 1000);
        const expiredToken = await createTestIdToken(
          { nonce: "nonce-xyz" },
          testKeyPair,
          { iat: now - 3600, exp: now - 60 } // expired 60s ago (>30s tolerance)
        );

        await expect(GoogleAuthService.verifyIdToken(expiredToken, "nonce-xyz")).rejects.toThrow(
          /cryptographic verification failed/i
        );
      } finally {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = origId;
      }
    });

    it("rejects ID token with future iat beyond 30s clock tolerance", async () => {
      const origId = env.GOOGLE_CLIENT_ID;
      try {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID =
          "mock-client-id.apps.googleusercontent.com";
        GoogleAuthService._setJwksOverride(async () => testKeyPair.publicKey);

        const now = Math.floor(Date.now() / 1000);
        const futureIatToken = await createTestIdToken(
          { nonce: "nonce-future" },
          testKeyPair,
          { iat: now + 120, exp: now + 3720 } // 2 mins in future
        );

        await expect(
          GoogleAuthService.verifyIdToken(futureIatToken, "nonce-future")
        ).rejects.toThrow(/cryptographic verification failed/i);
      } finally {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = origId;
      }
    });

    it("accepts minor clock skew within defined 30s tolerance", async () => {
      const origId = env.GOOGLE_CLIENT_ID;
      try {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID =
          "mock-client-id.apps.googleusercontent.com";
        GoogleAuthService._setJwksOverride(async () => testKeyPair.publicKey);

        const now = Math.floor(Date.now() / 1000);
        const slightSkewToken = await createTestIdToken(
          { nonce: "nonce-skew" },
          testKeyPair,
          { iat: now + 10, exp: now + 3600 } // 10s skew <= 30s tolerance
        );

        const profile = await GoogleAuthService.verifyIdToken(slightSkewToken, "nonce-skew");
        expect(profile.sub).toBe("verified-google-sub-12345");
      } finally {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = origId;
      }
    });

    it("rejects ID token exceeding maxTokenAge bound (excessive age even if exp is future)", async () => {
      const origId = env.GOOGLE_CLIENT_ID;
      try {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID =
          "mock-client-id.apps.googleusercontent.com";
        GoogleAuthService._setJwksOverride(async () => testKeyPair.publicKey);

        const now = Math.floor(Date.now() / 1000);
        const staleToken = await createTestIdToken(
          { nonce: "nonce-stale" },
          testKeyPair,
          { iat: now - 4000, exp: now + 3600 } // issued > 1h ago
        );

        await expect(GoogleAuthService.verifyIdToken(staleToken, "nonce-stale")).rejects.toThrow(
          /cryptographic verification failed/i
        );
      } finally {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = origId;
      }
    });

    it("rejects ID token missing required claims (iat, exp, sub, email, nonce)", async () => {
      const origId = env.GOOGLE_CLIENT_ID;
      try {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID =
          "mock-client-id.apps.googleusercontent.com";
        GoogleAuthService._setJwksOverride(async () => testKeyPair.publicKey);

        for (const claim of ["iat", "exp", "sub", "email", "nonce"]) {
          const incompleteToken = await createTestIdToken({ nonce: "nonce-req" }, testKeyPair, {
            omitClaims: [claim],
          });

          await expect(
            GoogleAuthService.verifyIdToken(incompleteToken, "nonce-req")
          ).rejects.toThrow(/cryptographic verification failed/i);
        }
      } finally {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = origId;
      }
    });

    it("rejects ID token with wrong audience or issuer, mismatched nonce, or unverified email", async () => {
      const origId = env.GOOGLE_CLIENT_ID;
      try {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID =
          "mock-client-id.apps.googleusercontent.com";
        GoogleAuthService._setJwksOverride(async () => testKeyPair.publicKey);

        const wrongAud = await createTestIdToken({ aud: "other-app", nonce: "n1" });
        await expect(GoogleAuthService.verifyIdToken(wrongAud, "n1")).rejects.toThrow();

        const wrongIss = await createTestIdToken({ iss: "https://evil.com", nonce: "n1" });
        await expect(GoogleAuthService.verifyIdToken(wrongIss, "n1")).rejects.toThrow();

        const wrongNonce = await createTestIdToken({ nonce: "attacker-nonce" });
        await expect(GoogleAuthService.verifyIdToken(wrongNonce, "browser-nonce")).rejects.toThrow(
          /nonce mismatch/i
        );

        const unverified = await createTestIdToken({ email_verified: false, nonce: "n1" });
        await expect(GoogleAuthService.verifyIdToken(unverified, "n1")).rejects.toThrow(
          /not verified/i
        );
      } finally {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = origId;
      }
    });
  });

  describe("2. PKCE Binding & Verification Edge Cases", () => {
    it("generates S256 challenge matching bound HTTP-only verifier and never exposes verifier in URL", async () => {
      const origId = env.GOOGLE_CLIENT_ID;
      const origSecret = env.GOOGLE_CLIENT_SECRET;
      try {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = "mock-id";
        (env as { GOOGLE_CLIENT_SECRET?: string }).GOOGLE_CLIENT_SECRET = "mock-secret";

        const initRes = await request(app).get("/api/v1/auth/google").expect(302);
        const authUrl = new URL(initRes.headers.location);

        const codeChallenge = authUrl.searchParams.get("code_challenge");
        const method = authUrl.searchParams.get("code_challenge_method");
        expect(codeChallenge).toBeTruthy();
        expect(method).toBe("S256");

        // Extract verifier from signed HTTP-only cookie
        const setCookie = initRes.headers["set-cookie"]?.[0] || "";
        expect(setCookie).toContain("HttpOnly");
        const cookieVal = decodeURIComponent(setCookie.split(";")[0].split("=")[1]);
        const base64Payload = cookieVal.split(".")[0];
        const sessionData = JSON.parse(Buffer.from(base64Payload, "base64url").toString("utf-8"));

        // Verify verifier is NOT in redirect URL
        expect(initRes.headers.location).not.toContain(sessionData.codeVerifier);

        // Verify SHA-256(codeVerifier) base64url matches code_challenge
        const expectedChallenge = crypto
          .createHash("sha256")
          .update(sessionData.codeVerifier)
          .digest("base64url");
        expect(codeChallenge).toBe(expectedChallenge);
      } finally {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = origId;
        (env as { GOOGLE_CLIENT_SECRET?: string }).GOOGLE_CLIENT_SECRET = origSecret;
      }
    });

    it("rejects empty or missing PKCE verifier in exchangeCode", async () => {
      await expect(GoogleAuthService.exchangeCode("auth-code", "")).rejects.toThrow(
        /Missing PKCE code_verifier/i
      );
    });

    it("rejects callback cleanly when PKCE verification fails at token exchange endpoint", async () => {
      const origId = env.GOOGLE_CLIENT_ID;
      const origSecret = env.GOOGLE_CLIENT_SECRET;
      try {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = "mock-id";
        (env as { GOOGLE_CLIENT_SECRET?: string }).GOOGLE_CLIENT_SECRET = "mock-secret";

        const initRes = await request(app).get("/api/v1/auth/google").expect(302);
        const cookieHeader = String(initRes.headers["set-cookie"]?.[0]);
        const state = new URL(initRes.headers.location).searchParams.get("state")!;

        // Simulate Google rejecting authorization code / PKCE verifier mismatch
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          text: async () => JSON.stringify({ error: "invalid_grant" }),
        } as unknown as Response);

        const callbackRes = await request(app)
          .get(`/api/v1/auth/google/callback?code=code-123&state=${state}`)
          .set("Cookie", cookieHeader)
          .expect(302);

        expect(callbackRes.headers.location).toContain("/auth/callback?error=");
        expect(decodeURIComponent(callbackRes.headers.location)).toMatch(/PKCE verifier/i);

        // Ensure no session token cookie is issued on failure
        const setCookies = callbackRes.headers["set-cookie"] || [];
        expect(setCookies.find((c: string) => c.startsWith("token="))).toBeUndefined();
      } finally {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = origId;
        (env as { GOOGLE_CLIENT_SECRET?: string }).GOOGLE_CLIENT_SECRET = origSecret;
      }
    });
  });

  describe("3. Concurrent OAuth Attempts & One-Time Replay Protection", () => {
    it("isolates concurrent OAuth transactions so neither overwrites the other", async () => {
      const origId = env.GOOGLE_CLIENT_ID;
      const origSecret = env.GOOGLE_CLIENT_SECRET;
      try {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID =
          "mock-client-id.apps.googleusercontent.com";
        (env as { GOOGLE_CLIENT_SECRET?: string }).GOOGLE_CLIENT_SECRET = "mock-secret";
        GoogleAuthService._setJwksOverride(async () => testKeyPair.publicKey);

        // Initiate two concurrent tabs: Tab A -> /teams, Tab B -> /profile
        const initA = await request(app).get("/api/v1/auth/google?returnTo=/teams").expect(302);
        const initB = await request(app).get("/api/v1/auth/google?returnTo=/profile").expect(302);

        const cookieA = String(initA.headers["set-cookie"]?.[0]);
        const cookieB = String(initB.headers["set-cookie"]?.[0]);

        const cookieNameA = cookieA.split("=")[0];
        const cookieNameB = cookieB.split("=")[0];
        expect(cookieNameA).not.toBe(cookieNameB); // Distinct per-txId cookies!

        const urlA = new URL(initA.headers.location);
        const urlB = new URL(initB.headers.location);
        const stateA = urlA.searchParams.get("state")!;
        const nonceA = urlA.searchParams.get("nonce")!;
        const stateB = urlB.searchParams.get("state")!;
        const nonceB = urlB.searchParams.get("nonce")!;

        // Complete Tab A with both cookies present in browser jar
        const tokenA = await createTestIdToken({
          nonce: nonceA,
          email: "tab.a@test-google-auth.com",
          sub: "sub-tab-a",
        });
        const exchangeSpy = vi.spyOn(GoogleAuthService, "exchangeCode").mockResolvedValueOnce({
          access_token: "at-a",
          id_token: tokenA,
        });

        const cbA = await request(app)
          .get(`/api/v1/auth/google/callback?code=codeA&state=${stateA}`)
          .set("Cookie", [cookieA.split(";")[0], cookieB.split(";")[0]])
          .expect(302);

        expect(cbA.headers.location).toBe("http://localhost:5173/teams");

        // Now complete Tab B with Tab B's cookie still valid!
        const tokenB = await createTestIdToken({
          nonce: nonceB,
          email: "tab.b@test-google-auth.com",
          sub: "sub-tab-b",
        });
        exchangeSpy.mockResolvedValueOnce({
          access_token: "at-b",
          id_token: tokenB,
        });

        const cbB = await request(app)
          .get(`/api/v1/auth/google/callback?code=codeB&state=${stateB}`)
          .set("Cookie", cookieB.split(";")[0])
          .expect(302);

        expect(cbB.headers.location).toBe("http://localhost:5173/profile");

        // Verify Tab A passed Tab A's verifier and Tab B passed Tab B's verifier (distinct)
        expect(exchangeSpy).toHaveBeenCalledTimes(2);
        const verifierUsedA = exchangeSpy.mock.calls[0][1];
        const verifierUsedB = exchangeSpy.mock.calls[1][1];
        expect(verifierUsedA).not.toBe(verifierUsedB);
      } finally {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = origId;
        (env as { GOOGLE_CLIENT_SECRET?: string }).GOOGLE_CLIENT_SECRET = origSecret;
      }
    });

    it("rejects cross-transaction state/cookie substitution between concurrent attempts", async () => {
      const origId = env.GOOGLE_CLIENT_ID;
      const origSecret = env.GOOGLE_CLIENT_SECRET;
      try {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = "mock-id";
        (env as { GOOGLE_CLIENT_SECRET?: string }).GOOGLE_CLIENT_SECRET = "mock-secret";

        const initA = await request(app).get("/api/v1/auth/google").expect(302);
        const initB = await request(app).get("/api/v1/auth/google").expect(302);

        const stateA = new URL(initA.headers.location).searchParams.get("state")!;
        const cookieB = String(initB.headers["set-cookie"]?.[0]);

        // Send stateA paired ONLY with cookieB
        const cb = await request(app)
          .get(`/api/v1/auth/google/callback?code=code123&state=${stateA}`)
          .set("Cookie", cookieB.split(";")[0])
          .expect(302);

        expect(cb.headers.location).toContain("/auth/callback?error=");
        expect(decodeURIComponent(cb.headers.location)).toMatch(/expired or missing/i);
      } finally {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = origId;
        (env as { GOOGLE_CLIENT_SECRET?: string }).GOOGLE_CLIENT_SECRET = origSecret;
      }
    });

    it("rejects replayed callback even when client manually re-sends captured cookie", async () => {
      const origId = env.GOOGLE_CLIENT_ID;
      const origSecret = env.GOOGLE_CLIENT_SECRET;
      try {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID =
          "mock-client-id.apps.googleusercontent.com";
        (env as { GOOGLE_CLIENT_SECRET?: string }).GOOGLE_CLIENT_SECRET = "mock-secret";
        GoogleAuthService._setJwksOverride(async () => testKeyPair.publicKey);

        const init = await request(app).get("/api/v1/auth/google").expect(302);
        const cookie = String(init.headers["set-cookie"]?.[0]).split(";")[0];
        const url = new URL(init.headers.location);
        const state = url.searchParams.get("state")!;
        const nonce = url.searchParams.get("nonce")!;

        const idToken = await createTestIdToken({
          nonce,
          email: "replay@test-google-auth.com",
          sub: "sub-replay",
        });
        vi.spyOn(GoogleAuthService, "exchangeCode").mockResolvedValue({
          access_token: "at",
          id_token: idToken,
        });

        // First attempt succeeds
        await request(app)
          .get(`/api/v1/auth/google/callback?code=code1&state=${state}`)
          .set("Cookie", cookie)
          .expect(302)
          .expect((res) => {
            expect(res.headers.location).toBe("http://localhost:5173/dashboard");
          });

        // Replay exact same callback request with captured cookie -> rejected
        const replayRes = await request(app)
          .get(`/api/v1/auth/google/callback?code=code1&state=${state}`)
          .set("Cookie", cookie)
          .expect(302);

        expect(replayRes.headers.location).toContain("/auth/callback?error=");
        expect(decodeURIComponent(replayRes.headers.location)).toMatch(/already been consumed/i);
      } finally {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = origId;
        (env as { GOOGLE_CLIENT_SECRET?: string }).GOOGLE_CLIENT_SECRET = origSecret;
      }
    });

    it("rejects expired OAuth session cookie (>10 min TTL)", async () => {
      const origId = env.GOOGLE_CLIENT_ID;
      const origSecret = env.GOOGLE_CLIENT_SECRET;
      try {
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = "mock-id";
        (env as { GOOGLE_CLIENT_SECRET?: string }).GOOGLE_CLIENT_SECRET = "mock-secret";

        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));

        const init = await request(app).get("/api/v1/auth/google").expect(302);
        const cookie = String(init.headers["set-cookie"]?.[0]).split(";")[0];
        const state = new URL(init.headers.location).searchParams.get("state")!;

        // Advance time by 11 minutes
        vi.setSystemTime(new Date("2026-11-11T12:11:00Z"));

        const cb = await request(app)
          .get(`/api/v1/auth/google/callback?code=code1&state=${state}`)
          .set("Cookie", cookie)
          .expect(302);

        expect(cb.headers.location).toContain("/auth/callback?error=");
        expect(decodeURIComponent(cb.headers.location)).toMatch(/Invalid or expired/i);
      } finally {
        vi.useRealTimers();
        (env as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID = origId;
        (env as { GOOGLE_CLIENT_SECRET?: string }).GOOGLE_CLIENT_SECRET = origSecret;
      }
    });
  });

  describe("4. Redirect Canonicalization & Explicit Allowlist Defense", () => {
    it("rejects external origins, protocol-relative URLs, backslashes, and control characters", () => {
      expect(GoogleAuthService.sanitizeReturnTo("//evil.com")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("///evil.com")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("https://evil.com")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("/\\evil.com")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("\\evil.com")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("/dashboard\r\nSet-Cookie: a=1")).toBe(
        "/dashboard"
      );
      expect(GoogleAuthService.sanitizeReturnTo("/dashboard\0evil")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("javascript:alert(1)")).toBe("/dashboard");
    });

    it("rejects deeply nested URL encoding and malformed percent sequences", () => {
      expect(GoogleAuthService.sanitizeReturnTo("/%2f/evil.com")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("/%252f/evil.com")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("/%2525252f/evil.com")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("/%5cevil.com")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("/%255cevil.com")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("/teams/%2e%2e/evil")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("/dashboard?q=%ZZ")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("/dashboard?q=%2")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("/%E0%A4%A")).toBe("/dashboard");
    });

    it("enforces explicit application route allowlist while preserving valid query params", () => {
      expect(GoogleAuthService.sanitizeReturnTo("/")).toBe("/");
      expect(GoogleAuthService.sanitizeReturnTo("/dashboard")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("/dashboard?tab=overview")).toBe(
        "/dashboard?tab=overview"
      );
      expect(GoogleAuthService.sanitizeReturnTo("/profile")).toBe("/profile");
      expect(GoogleAuthService.sanitizeReturnTo("/teams")).toBe("/teams");
      expect(GoogleAuthService.sanitizeReturnTo("/teams-preview")).toBe("/teams-preview");
      expect(GoogleAuthService.sanitizeReturnTo("/teams/team-open-123")).toBe(
        "/teams/team-open-123"
      );
      expect(GoogleAuthService.sanitizeReturnTo("/teams/squad-alpha?tab=roster")).toBe(
        "/teams/squad-alpha?tab=roster"
      );

      // Unlisted routes fall back safely to /dashboard
      expect(GoogleAuthService.sanitizeReturnTo("/unknown-external-path")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("/admin/users")).toBe("/dashboard");
      expect(GoogleAuthService.sanitizeReturnTo("/teams/a/b/c")).toBe("/dashboard");
    });
  });

  describe("5. Account and Identity Integrity Hardening", () => {
    it("strictly prevents silent account takeover of existing password-based users", async () => {
      const passwordHash = await User.hashPassword("OriginalPassword123!");
      await User.create({
        email: "existing.developer@test-google-auth.com",
        displayName: "Existing Dev",
        passwordHash,
        skills: ["Rust"],
        authProvider: "local",
      });

      const profile: GoogleUserProfile = {
        sub: "attacker-google-sub-999",
        email: "existing.developer@test-google-auth.com",
        email_verified: true,
        name: "Attacker",
      };

      await expect(GoogleAuthService.resolveUser(profile)).rejects.toThrow(
        /already exists using password authentication/
      );
    });

    it("ensures Google-only user cannot authenticate via password login endpoint", async () => {
      await User.create({
        email: "google.only@test-google-auth.com",
        displayName: "Google Only User",
        googleId: "google-only-sub-555",
        skills: ["Builder"],
        authProvider: "google",
      });

      const res = await request(app).post("/api/v1/auth/login").send({
        email: "google.only@test-google-auth.com",
        password: "AnyAttemptedPassword!",
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("mitigates concurrent duplicate-key races when creating users with the same googleId", async () => {
      const profile: GoogleUserProfile = {
        sub: "race-sub-4444",
        email: "race.user@test-google-auth.com",
        email_verified: true,
        name: "Race User",
      };

      const firstUser = await User.create({
        email: "race.user@test-google-auth.com",
        displayName: "Race User",
        googleId: "race-sub-4444",
        skills: ["Builder"],
        authProvider: "google",
      });

      const resolved = await GoogleAuthService.resolveUser(profile);
      expect(resolved._id.toString()).toBe(firstUser._id.toString());
    });

    it("rejects suspended users during Google authentication", async () => {
      await User.create({
        email: "suspended.coder@test-google-auth.com",
        displayName: "Suspended Coder",
        googleId: "suspended-sub-777",
        skills: ["Builder"],
        status: "SUSPENDED",
      });

      const profile: GoogleUserProfile = {
        sub: "suspended-sub-777",
        email: "suspended.coder@test-google-auth.com",
        email_verified: true,
      };

      await expect(GoogleAuthService.resolveUser(profile)).rejects.toThrow(
        /Account has been suspended/
      );
    });
  });
});
