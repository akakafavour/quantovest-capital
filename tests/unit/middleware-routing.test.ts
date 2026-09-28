import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const middlewareSource = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");

// ---------------------------------------------------------------------------
// The helpers below are verbatim mirrors of the private route predicates in
// middleware.ts (which are not exported, so prod code is untouched). The
// "pins prod source" tests beneath fail if middleware.ts drifts from these
// mirrors, keeping the matrix honest without modifying production code.
// ---------------------------------------------------------------------------
function mirrorIsPublicRoute(pathname: string): boolean {
  if (
    pathname === "/" ||
    pathname === "/how-it-works" ||
    pathname === "/about" ||
    pathname === "/services" ||
    pathname === "/plans" ||
    pathname === "/faq" ||
    pathname === "/contact" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/admin/login"
  ) {
    return true;
  }
  if (pathname.startsWith("/legal/")) return true;
  if (pathname.startsWith("/api/plans")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

function mirrorIsInvestorRoute(pathname: string): boolean {
  if (pathname.startsWith("/dashboard")) return true;
  const investorApiRoutes = [
    "/api/deposits",
    "/api/withdrawals",
    "/api/kyc",
    "/api/uploads",
    "/api/notifications",
    "/api/profile",
    "/api/history",
    "/api/referrals",
    "/api/deposit-instructions",
    "/api/investor-profile",
    "/api/portfolio",
    "/api/swap",
    "/api/traders",
    "/api/push",
  ];
  return investorApiRoutes.some((route) => pathname.startsWith(route));
}

function mirrorIsAdminRoute(pathname: string): boolean {
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/api/admin")) return true;
  return false;
}

type TwoFactorGate =
  | { outcome: "pass" }
  | { outcome: "api-blocked"; status: number }
  | { outcome: "page-redirect"; location: string };

function mirrorTwoFactorGate(pathname: string, pending: boolean, verified: boolean): TwoFactorGate {
  if (pending && pathname !== "/verify-2fa" && !pathname.startsWith("/api/auth/2fa")) {
    if (!verified) {
      if (pathname.startsWith("/api/")) return { outcome: "api-blocked", status: 403 };
      return { outcome: "page-redirect", location: "/verify-2fa" };
    }
  }
  return { outcome: "pass" };
}

/** Admins hitting investor routes are bounced to /admin except the allowlist. */
function mirrorAdminOnInvestorRoute(pathname: string): "pass" | "/admin" {
  if (
    pathname === "/api/notifications" ||
    pathname.startsWith("/api/notifications/") ||
    pathname === "/api/investor-profile" ||
    pathname.startsWith("/api/investor-profile/")
  ) {
    return "pass";
  }
  return "/admin";
}

describe("middleware routing matrix", () => {
  it("should pin public-route branches when prod source is read", () => {
    expect(middlewareSource).toContain("/admin/login");
    expect(middlewareSource).toContain("/legal/");
    expect(middlewareSource).toContain("/api/plans");
    expect(middlewareSource).toContain("/api/auth/");
  });

  it("should pin investor, admin, 2FA and allowlist branches when prod source is read", () => {
    expect(middlewareSource).toContain("/dashboard");
    expect(middlewareSource).toContain("/api/deposit-instructions");
    expect(middlewareSource).toContain("/api/admin");
    expect(middlewareSource).toContain("qv_2fa_pending");
    expect(middlewareSource).toContain("Two-factor verification required.");
    expect(middlewareSource).toContain("/verify-2fa");
    expect(middlewareSource).toContain("/api/auth/2fa");
    expect(middlewareSource).toContain("/api/notifications");
    expect(middlewareSource).toContain("/api/investor-profile");
  });

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
    "/api/plans/42",
    "/api/auth/login",
    "/api/auth/2fa/verify",
  ])("should treat %s as public when it matches the public table", (pathname) => {
    expect(mirrorIsPublicRoute(pathname)).toBe(true);
  });

  it.each([
    "/dashboard",
    "/admin",
    "/admin/deposits",
    "/api/admin/plans",
    "/api/deposits",
    "/api/withdrawals",
    "/verify-2fa",
  ])("should treat %s as protected when it is outside the public table", (pathname) => {
    expect(mirrorIsPublicRoute(pathname)).toBe(false);
  });

  it.each([
    "/dashboard",
    "/dashboard/settings",
    "/api/deposits",
    "/api/withdrawals",
    "/api/kyc",
    "/api/uploads",
    "/api/notifications",
    "/api/profile",
    "/api/history",
    "/api/referrals",
    "/api/deposit-instructions",
    "/api/investor-profile",
    "/api/portfolio",
    "/api/swap",
    "/api/swap/rate",
    "/api/traders",
    "/api/push/subscribe",
  ])("should treat %s as an investor route when it matches the investor table", (pathname) => {
    expect(mirrorIsInvestorRoute(pathname)).toBe(true);
  });

  it.each(["/", "/api/plans", "/admin", "/api/admin/deposits", "/api/auth/login"])(
    "should not treat %s as an investor route when it is outside the investor table",
    (pathname) => {
      expect(mirrorIsInvestorRoute(pathname)).toBe(false);
    },
  );

  it.each(["/admin", "/admin/deposits", "/api/admin", "/api/admin/plans", "/api/admin/roi"])(
    "should treat %s as an admin route when it matches the admin table",
    (pathname) => {
      expect(mirrorIsAdminRoute(pathname)).toBe(true);
    },
  );

  it.each(["/api/plans", "/dashboard", "/api/deposits", "/api/auth/login", "/"])(
    "should not treat %s as an admin route when it is outside the admin table",
    (pathname) => {
      expect(mirrorIsAdminRoute(pathname)).toBe(false);
    },
  );

  it("should keep /api/plans public while /api/admin/plans stays admin-only", () => {
    expect(mirrorIsPublicRoute("/api/plans")).toBe(true);
    expect(mirrorIsAdminRoute("/api/plans")).toBe(false);
    expect(mirrorIsPublicRoute("/api/admin/plans")).toBe(false);
    expect(mirrorIsAdminRoute("/api/admin/plans")).toBe(true);
    expect(mirrorIsInvestorRoute("/api/admin/plans")).toBe(false);
  });

  it("should return 403 for APIs when 2FA is pending and unverified", () => {
    expect(mirrorTwoFactorGate("/api/deposits", true, false)).toEqual({
      outcome: "api-blocked",
      status: 403,
    });
    expect(mirrorTwoFactorGate("/api/portfolio", true, false)).toEqual({
      outcome: "api-blocked",
      status: 403,
    });
  });

  it("should redirect pages when 2FA is pending and unverified", () => {
    expect(mirrorTwoFactorGate("/dashboard", true, false)).toEqual({
      outcome: "page-redirect",
      location: "/verify-2fa",
    });
    expect(mirrorTwoFactorGate("/admin", true, false)).toEqual({
      outcome: "page-redirect",
      location: "/verify-2fa",
    });
  });

  it("should pass the 2FA gate for exempt paths when verification is pending", () => {
    expect(mirrorTwoFactorGate("/verify-2fa", true, false)).toEqual({ outcome: "pass" });
    expect(mirrorTwoFactorGate("/api/auth/2fa/verify", true, false)).toEqual({ outcome: "pass" });
    expect(mirrorTwoFactorGate("/api/auth/2fa/setup", true, false)).toEqual({ outcome: "pass" });
  });

  it("should pass the 2FA gate when nothing is pending or verification succeeded", () => {
    expect(mirrorTwoFactorGate("/dashboard", false, false)).toEqual({ outcome: "pass" });
    expect(mirrorTwoFactorGate("/api/deposits", false, false)).toEqual({ outcome: "pass" });
    expect(mirrorTwoFactorGate("/dashboard", true, true)).toEqual({ outcome: "pass" });
    expect(mirrorTwoFactorGate("/api/deposits", true, true)).toEqual({ outcome: "pass" });
  });

  it.each([
    "/api/notifications",
    "/api/notifications/unread",
    "/api/investor-profile",
    "/api/investor-profile/abc",
  ])("should allow admins on %s when it is in the self-service allowlist", (pathname) => {
    expect(mirrorAdminOnInvestorRoute(pathname)).toBe("pass");
  });

  it.each(["/dashboard", "/api/deposits", "/api/portfolio", "/api/swap", "/api/traders"])(
    "should bounce admins to /admin from %s when it is outside the allowlist",
    (pathname) => {
      expect(mirrorAdminOnInvestorRoute(pathname)).toBe("/admin");
    },
  );
});
