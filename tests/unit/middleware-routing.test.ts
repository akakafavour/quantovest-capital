import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Behavioral tests for middleware routing logic.
 *
 * These tests exercise the actual middleware function with mocked dependencies,
 * rather than reading source code as text. This means refactoring the middleware
 * (e.g. extracting helpers) won't break these tests as long as behavior is preserved.
 */

// ─── Mocks (hoisted to avoid initialization order issues) ────────────────────

const { mockGetUser, mockVerifyTwoFactorToken, mockSupabaseFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockVerifyTwoFactorToken: vi.fn(),
  mockSupabaseFrom: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockSupabaseFrom,
  })),
}));

vi.mock("@/lib/2fa-session", () => ({
  verifyTwoFactorToken: mockVerifyTwoFactorToken,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { middleware } from "../../middleware";

function createRequest(pathname: string, cookies: Record<string, string> = {}) {
  const url = `http://localhost:3000${pathname}`;
  return {
    url,
    nextUrl: { pathname, searchParams: new URLSearchParams() },
    cookies: {
      get: (name: string) => ({ value: cookies[name] }),
      getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })),
      set: vi.fn(),
    },
  } as any;
}

function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "user@example.com",
    app_metadata: {},
    user_metadata: {},
    ...overrides,
  };
}

function mockDbResponse(rows: any[]) {
  const profile = rows[0] ?? null;
  mockSupabaseFrom.mockReturnValue({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        limit: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: profile })),
        })),
      })),
    })),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("middleware routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
  });

  describe("public routes", () => {
    it.each([
      "/",
      "/how-it-works",
      "/about",
      "/services",
      "/plans",
      "/faq",
      "/contact",
      "/login",
      "/signup",
      "/admin/login",
      "/legal/terms",
      "/legal/privacy",
      "/api/plans",
      "/api/auth/login",
    ])("should allow unauthenticated access to %s", async (pathname) => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createRequest(pathname);
      const res = await middleware(req);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe("protected routes", () => {
    it("should redirect unauthenticated users from /dashboard to /login", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createRequest("/dashboard");
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });

    it("should return 401 for unauthenticated API access to /api/deposits", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createRequest("/api/deposits");
      const res = await middleware(req);
      expect(res.status).toBe(401);
    });

    it("should redirect unauthenticated users from /admin to /login", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createRequest("/admin");
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });
  });

  describe("role-based access", () => {
    it("should allow admin users to access /admin", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser() } });
      mockDbResponse([{ role: "admin", twoFactorEnabled: false }]);
      const req = createRequest("/admin");
      const res = await middleware(req);
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(307);
    });

    it("should redirect non-admin users from /admin to /dashboard", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser() } });
      mockDbResponse([{ role: "investor", twoFactorEnabled: false }]);
      const req = createRequest("/admin");
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/dashboard");
    });

    it("should redirect admin users from /dashboard to /admin", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser() } });
      mockDbResponse([{ role: "admin", twoFactorEnabled: false }]);
      const req = createRequest("/dashboard");
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/admin");
    });

    it("should allow admin access to /api/notifications (self-service allowlist)", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser() } });
      mockDbResponse([{ role: "admin", twoFactorEnabled: false }]);
      const req = createRequest("/api/notifications");
      const res = await middleware(req);
      expect(res.status).not.toBe(307);
    });

    it("should bounce admin from /api/deposits to /admin", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser() } });
      mockDbResponse([{ role: "admin", twoFactorEnabled: false }]);
      const req = createRequest("/api/deposits");
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/admin");
    });
  });

  describe("2FA enforcement", () => {
    it("should block API access when 2FA is enabled but not verified", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser() } });
      mockDbResponse([{ role: "investor", twoFactorEnabled: true }]);
      mockVerifyTwoFactorToken.mockResolvedValue(false);
      const req = createRequest("/api/deposits");
      const res = await middleware(req);
      expect(res.status).toBe(403);
    });

    it("should redirect pages when 2FA is enabled but not verified", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser() } });
      mockDbResponse([{ role: "investor", twoFactorEnabled: true }]);
      mockVerifyTwoFactorToken.mockResolvedValue(false);
      const req = createRequest("/dashboard");
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/verify-2fa");
    });

    it("should allow access when 2FA is enabled and verified", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser() } });
      mockDbResponse([{ role: "investor", twoFactorEnabled: true }]);
      mockVerifyTwoFactorToken.mockResolvedValue(true);
      const req = createRequest("/api/deposits");
      const res = await middleware(req);
      expect(res.status).not.toBe(403);
    });

    it("should allow access to /verify-2fa even when 2FA is pending", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser() } });
      mockDbResponse([{ role: "investor", twoFactorEnabled: true }]);
      mockVerifyTwoFactorToken.mockResolvedValue(false);
      const req = createRequest("/verify-2fa");
      const res = await middleware(req);
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(307);
    });

    it("should allow access when 2FA is not enabled", async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser() } });
      mockDbResponse([{ role: "investor", twoFactorEnabled: false }]);
      const req = createRequest("/api/deposits");
      const res = await middleware(req);
      expect(res.status).not.toBe(403);
    });
  });

  describe("fail-closed behavior", () => {
    it("should return 503 when Supabase env vars are missing", async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      const req = createRequest("/dashboard");
      const res = await middleware(req);
      expect(res.status).toBe(503);
    });
  });
});
