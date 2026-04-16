import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { readSession } from "@/lib/session";
import { getProfileByOperatorId } from "@/lib/db/profiles-adapter";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { DashboardFooter } from "@/components/dashboard/DashboardFooter";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

import "./dashboard.css";

export const metadata: Metadata = {
  title: "Dashboard -- LASTPROOF",
};

/**
 * /manage/profile — the operator dashboard.
 *
 * Server component entry point:
 *   1. Read session cookie — redirect to /manage if missing
 *   2. Look up profile by operator — if none, DashboardShell shows onboarding
 *   3. If profile exists, DashboardShell shows the full editor
 *
 * Wireframes: lastproof-dashboard.html, lastproof-dashboard-fresh.html,
 *             lastproof-onboarding.html
 */
export default async function DashboardPage() {
  const session = await readSession();
  if (!session) redirect("/manage");

  // Look up operator by wallet to find profile
  // The operators table uses terminal_wallet, and profiles reference operator_id
  const { supabaseService } = await import("@/lib/db/client");
  const { data: operator } = await supabaseService()
    .from("operators")
    .select("id")
    .eq("terminal_wallet", session.walletAddress)
    .maybeSingle();

  let profile = null;
  let primaryCategory: string | null = null;
  let additionalCategories: string[] = [];
  let workItems: Array<{
    id: string; ticker: string | null; role: string; description: string | null;
    startedAt: string | null; endedAt: string | null; minted: boolean;
    proofCount: number; hasDevProof: boolean;
  }> = [];
  let screenshots: Array<{
    id: string; imageUrl: string; linkedUrl: string | null; position: number;
  }> = [];
  let links: Array<{
    id: string; label: string; url: string; platform: string; pinned: boolean; position: number;
  }> = [];
  let proofs: Array<{
    id: string; voucherWallet: string; ticker: string | null;
    kind: "proof" | "dev_verification"; note: string | null;
    txSignature: string | null; createdAt: string;
  }> = [];
  let previousHandles: string[] = [];

  if (operator) {
    profile = await getProfileByOperatorId(operator.id);

    if (profile) {
      const sb = supabaseService();

      // Fetch categories
      const { data: cats } = await sb
        .from("profile_categories")
        .select("category_slug")
        .eq("profile_id", profile.id);
      primaryCategory = cats?.[0]?.category_slug ?? null;
      additionalCategories = (cats ?? []).slice(1).map((c: { category_slug: string }) => c.category_slug);

      // Fetch work items with proof counts
      // Order by started_at desc; client-side sorts Current (no end date) first.
      const { data: rawItems } = await sb
        .from("work_items")
        .select("id, ticker, role, description, started_at, ended_at, minted")
        .eq("profile_id", profile.id)
        .order("started_at", { ascending: false, nullsFirst: false });

      if (rawItems) {
        // Batch-fetch proof counts for all work items
        const itemIds = rawItems.map((wi: { id: string }) => wi.id);
        const { data: proofCounts } = await sb
          .from("proofs")
          .select("work_item_id, kind")
          .in("work_item_id", itemIds.length > 0 ? itemIds : ["__none__"]);

        const countMap = new Map<string, { total: number; hasDev: boolean }>();
        for (const p of proofCounts ?? []) {
          const existing = countMap.get(p.work_item_id) ?? { total: 0, hasDev: false };
          existing.total++;
          if (p.kind === "dev_verification") existing.hasDev = true;
          countMap.set(p.work_item_id, existing);
        }

        workItems = rawItems.map((wi: Record<string, unknown>) => ({
          id: wi.id as string,
          ticker: (wi.ticker as string | null) ?? null,
          role: wi.role as string,
          description: (wi.description as string | null) ?? null,
          startedAt: (wi.started_at as string | null) ?? null,
          endedAt: (wi.ended_at as string | null) ?? null,
          minted: (wi.minted as boolean) ?? false,
          proofCount: countMap.get(wi.id as string)?.total ?? 0,
          hasDevProof: countMap.get(wi.id as string)?.hasDev ?? false,
        }));
      }

      // Fetch screenshots
      const { data: rawShots } = await sb
        .from("screenshots")
        .select("id, image_url, linked_url, position")
        .eq("profile_id", profile.id)
        .order("position", { ascending: true });

      if (rawShots) {
        screenshots = rawShots.map((s: Record<string, unknown>) => ({
          id: s.id as string,
          imageUrl: s.image_url as string,
          linkedUrl: (s.linked_url as string | null) ?? null,
          position: s.position as number,
        }));
      }

      // Fetch links
      const { data: rawLinks } = await sb
        .from("profile_links")
        .select("id, label, url, platform, pinned, position")
        .eq("profile_id", profile.id)
        .order("position", { ascending: true });

      if (rawLinks) {
        links = rawLinks.map((l: Record<string, unknown>) => ({
          id: l.id as string,
          label: l.label as string,
          url: l.url as string,
          platform: (l.platform as string) ?? "web",
          pinned: (l.pinned as boolean) ?? false,
          position: l.position as number,
        }));
      }

      // Fetch proofs (joined with work_items for ticker)
      const { data: rawProofs } = await sb
        .from("proofs")
        .select("id, voucher_wallet, payer_wallet, kind, note, tx_signature, created_at, work_item_id, work_items(ticker)")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false });

      if (rawProofs) {
        proofs = rawProofs.map((p: Record<string, unknown>) => {
          const wi = p.work_items as { ticker: string | null } | null;
          return {
            id: p.id as string,
            voucherWallet: (p.payer_wallet as string) ?? (p.voucher_wallet as string) ?? "unknown",
            ticker: wi?.ticker ?? null,
            kind: (p.kind as "proof" | "dev_verification") ?? "proof",
            note: (p.note as string | null) ?? null,
            txSignature: (p.tx_signature as string | null) ?? null,
            createdAt: p.created_at as string,
          };
        });
      }

      // Fetch "Previously Known As" aliases (cosmetic, user-managed)
      const { data: aliasRows } = await sb
        .from("profile_aliases")
        .select("alias")
        .eq("profile_id", profile.id)
        .order("position", { ascending: true });
      if (aliasRows) {
        previousHandles = aliasRows.map((r: { alias: string }) => r.alias);
      }
    }
  }

  return (
    <div className="db-page">
      <div className="db-topbar-wrap">
        <DashboardTopbar session={session} />
      </div>
      <main className="main">
        <DashboardShell
          session={session}
          initialProfile={profile}
          operatorId={operator?.id ?? null}
          primaryCategory={primaryCategory}
          additionalCategories={additionalCategories}
          workItems={workItems}
          screenshots={screenshots}
          links={links}
          proofs={proofs}
          previousHandles={previousHandles}
        />
      </main>
      <DashboardFooter />
    </div>
  );
}
