"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import type { ShiftbotEndpointResult, ShiftbotResponse } from "@/lib/shiftbot/types";
import { buildGridParams } from "@/lib/grid/url-params";
import { EMPTY_FILTERS, type GridFilters } from "@/lib/grid/grid-view";

/**
 * Fixed-bottom SHIFTBOT command strip. Appears on every marketing page.
 * Hidden on /manage routes (those have their own terminal chrome).
 *
 * Two modes by pathname:
 *
 *   On /operators*:  functional — submit calls /api/shiftbot/search,
 *                    response navigates the user to filtered/ranked Grid
 *
 *   Off /operators:  canned — any submit shows the "enter the Grid" prompt
 *                    with a clickable SCAN GRID link to /grid (boot door).
 *                    No API call, no Groq cost, no rate-limit consumption.
 *
 * Spec: docs/SHIFTBOT-SECURITY-PLAN.md and docs/SHIFTBOT-JAILBREAK-CATALOG.md
 */

const CANNED_RESPONSE =
  "I am looking forward to helping you but I need you to enter the Grid.";

export default function ShiftbotStrip() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState<ReplyState>({ kind: "none" });
  const [submitting, setSubmitting] = useState(false);

  if (pathname.startsWith("/manage")) return null;

  const isFunctional = pathname.startsWith("/operators");

  const handleExpand = () => {
    setExpanded(true);
    setReply({ kind: "none" });
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCollapse = () => {
    setExpanded(false);
    setReply({ kind: "none" });
    setQuery("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || submitting) return;

    if (!isFunctional) {
      // Off-Grid pages: canned awareness response. No API call.
      setReply({ kind: "canned" });
      return;
    }

    // /operators*: real SHIFTBOT call
    setSubmitting(true);
    setReply({ kind: "loading" });
    try {
      const res = await fetch("/api/shiftbot/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const json: ShiftbotEndpointResult = await res.json().catch(() => ({
        ok: false,
        error: "service_unavailable" as const,
        message: "SHIFTBOT is temporarily unavailable.",
      }));

      if (!json.ok) {
        setReply({ kind: "error", message: json.message ?? "Something went wrong." });
        return;
      }

      // Dispatch on the Groq response shape (already validated server-side)
      const result = handleResponse(json.response, query.trim(), router);
      if (result.navigated) {
        setExpanded(false);
        setQuery("");
        setReply({ kind: "none" });
      } else {
        // Refusal — stay in strip, show inline message
        setReply(result.reply);
      }
    } catch (err) {
      console.error("[ShiftbotStrip] submit error:", err);
      setReply({ kind: "error", message: "SHIFTBOT couldn't reach the server. Try again." });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Collapsed state ────────────────────────────────────────────────
  if (!expanded) {
    return (
      <div className="shiftbot" onClick={handleExpand} style={{ cursor: "pointer" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="sb-mini-logo" />
        <div className="label">SHIFTBOT</div>
        <div className="cursor">&gt;</div>
        <div className="ph">
          ask anything — &ldquo;help me find a raider&rdquo;, &ldquo;who&rsquo;s the best X Spaces host?&rdquo;
        </div>
        <button type="button" className="expand">
          [ EXPAND ↑ ]
        </button>
      </div>
    );
  }

  // ─── Expanded state ─────────────────────────────────────────────────
  return (
    <div className="shiftbot shiftbot-expanded">
      <div className="sb-expanded-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/shiftbot-logo.png" alt="SHIFTBOT" className="sb-mini-logo" />
        <div className="label">SHIFTBOT</div>
        {!isFunctional && <span className="sb-status">PRE-LAUNCH</span>}
        <button type="button" className="expand" onClick={handleCollapse}>
          [ COLLAPSE ↓ ]
        </button>
      </div>

      {reply.kind === "canned" && (
        <div className="sb-reply">
          <div className="sb-reply-label">
            <span className="cursor">&gt;</span> SHIFTBOT
          </div>
          <p>
            {CANNED_RESPONSE}{" "}
            <Link href="/grid" className="sb-canned-cta">
              Click here &gt; SCAN GRID
            </Link>
          </p>
        </div>
      )}

      {reply.kind === "loading" && (
        <div className="sb-reply">
          <div className="sb-reply-label">
            <span className="cursor">&gt;</span> SHIFTBOT
          </div>
          <p>Thinking…</p>
        </div>
      )}

      {reply.kind === "error" && (
        <div className="sb-reply">
          <div className="sb-reply-label">
            <span className="cursor">&gt;</span> SHIFTBOT
          </div>
          <p>{reply.message}</p>
        </div>
      )}

      {reply.kind === "refuse" && (
        <div className="sb-reply">
          <div className="sb-reply-label">
            <span className="cursor">&gt;</span> SHIFTBOT
          </div>
          <p>{reply.message}</p>
        </div>
      )}

      <form className="sb-input-row" onSubmit={handleSubmit}>
        <span className="cursor">&gt;</span>
        <input
          ref={inputRef}
          className="sb-text-input"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (reply.kind !== "none" && reply.kind !== "loading") {
              setReply({ kind: "none" });
            }
          }}
          maxLength={200}
          placeholder={
            isFunctional
              ? "ask shiftbot about operators..."
              : "ask shiftbot anything..."
          }
          disabled={submitting}
        />
        <button type="submit" className="sb-send" disabled={submitting}>
          {submitting ? "…" : "ASK →"}
        </button>
      </form>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

type ReplyState =
  | { kind: "none" }
  | { kind: "canned" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "refuse"; message: string };

/**
 * Refusal copy shown inline in the expanded strip. Per the security plan,
 * `prompt_injection` shows the same message as `off_topic` — silent
 * treatment, don't acknowledge the injection attempt.
 */
const REFUSAL_COPY = {
  off_topic:
    "SHIFTBOT can only help you find operators on the Grid. Try asking about operators, categories, tiers, or fees.",
  prompt_injection:
    "SHIFTBOT can only help you find operators on the Grid. Try asking about operators, categories, tiers, or fees.",
} as const;

interface DispatchResult {
  navigated: boolean;
  reply: ReplyState;
}

/**
 * Translate a validated ShiftbotResponse into a navigation URL OR an
 * inline refusal. Returns whether navigation happened so the caller knows
 * whether to collapse the strip or stay open with the refusal visible.
 *
 *   filter      → navigate to /operators with filter URL params
 *   search      → navigate to /operators with ranked URL params
 *   refuse:no_match → navigate to /operators?q=...&fallback=1 (Grid shows notice)
 *   refuse:off_topic / prompt_injection → stay in strip, show inline refusal
 */
function handleResponse(
  response: ShiftbotResponse,
  rawQuery: string,
  router: ReturnType<typeof useRouter>,
): DispatchResult {
  const q = encodeURIComponent(rawQuery);

  if (response.type === "filter") {
    const merged: GridFilters = { ...EMPTY_FILTERS, ...response.filters };
    const params = buildGridParams(merged, "relevant");
    params.set("q", rawQuery);
    router.push(`/operators?${params.toString()}`);
    return { navigated: true, reply: { kind: "none" } };
  }

  if (response.type === "search") {
    if (response.ranked.length === 0) {
      router.push(`/operators?q=${q}&fallback=1`);
      return { navigated: true, reply: { kind: "none" } };
    }
    const ranked = response.ranked.join(",");
    router.push(`/operators?q=${q}&ranked=${encodeURIComponent(ranked)}`);
    return { navigated: true, reply: { kind: "none" } };
  }

  // refuse
  if (response.reason === "no_match") {
    router.push(`/operators?q=${q}&fallback=1`);
    return { navigated: true, reply: { kind: "none" } };
  }

  // off_topic or prompt_injection → stay inline
  return {
    navigated: false,
    reply: { kind: "refuse", message: REFUSAL_COPY[response.reason] },
  };
}
