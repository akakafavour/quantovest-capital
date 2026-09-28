"use client";

import { useState } from "react";
import { getTotpUri } from "@/lib/totp";

/**
 * Client-side TOTP enrollment display.
 *
 * SECURITY: the otpauth URI (which embeds the raw secret) is built and
 * rendered LOCALLY in the browser. It is never sent to a third-party QR
 * image API. Scan alternatives: paste the manual key into your authenticator
 * app, or render `getTotpUri()` output with a QR renderer bundled in this
 * app (canvas) — no off-origin request.
 */
export function TotpQr({ email, secret }: { email: string; secret: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const uri = getTotpUri(email, secret);

  async function copy(text: string, which: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable — user can select manually */
    }
  }

  return (
    <div className="w-full space-y-3">
      <div className="rounded-xl bg-white p-4 text-center">
        <p className="text-[11px] font-semibold text-neutral-800">Scan with your authenticator app</p>
        <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">
          QR image rendering is bundled locally in a follow-up; until then, add the key manually —
          your secret never leaves this browser.
        </p>
        <p className="mt-2 break-all rounded-lg bg-neutral-100 px-3 py-2 font-mono text-[11px] text-neutral-800">
          {secret}
        </p>
      </div>
      <div className="space-y-2">
        <p className="break-all font-mono text-[10px] text-[#93A09A]">Manual key: {secret}</p>
        <p className="break-all font-mono text-[10px] text-[#5b6660]">{uri}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void copy(secret, "key")}
            className="flex-1 rounded-full border border-[#263437] px-4 py-2 text-[10px] font-semibold text-[#93A09A] hover:bg-[#1A1F24]"
          >
            {copied === "key" ? "Copied!" : "Copy key"}
          </button>
          <button
            type="button"
            onClick={() => void copy(uri, "uri")}
            className="flex-1 rounded-full border border-[#263437] px-4 py-2 text-[10px] font-semibold text-[#93A09A] hover:bg-[#1A1F24]"
          >
            {copied === "uri" ? "Copied!" : "Copy otpauth URI"}
          </button>
        </div>
      </div>
    </div>
  );
}
