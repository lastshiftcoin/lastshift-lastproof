"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { GridCardView } from "@/lib/grid/grid-view";
import type { GridFilters, GridSort } from "@/lib/grid/grid-view";
import type { TickerProof } from "@/lib/grid/recent-proofs";
import type { CategoryChip } from "@/lib/grid/category-chips";
import { applyFilters, hasActiveFilters, activeFilterChips } from "@/lib/grid/filter";
import type { ActiveFilterChip } from "@/lib/grid/filter";
import { applySort } from "@/lib/grid/sort";
import { parseGridParams, buildGridParams } from "@/lib/grid/url-params";
import { EMPTY_FILTERS } from "@/lib/grid/grid-view";

import LiveTicker from "@/components/grid/LiveTicker";
import CategoryChipRow from "@/components/grid/CategoryChipRow";
import SortDropdown from "@/components/grid/SortDropdown";
import FilterSidebar from "@/components/grid/FilterSidebar";
import FilterDrawer from "@/components/grid/FilterDrawer";
import GridCard from "@/components/grid/GridCard";
import ActiveFilterChips from "@/components/grid/ActiveFilterChips";
import EmptyState from "@/components/grid/EmptyState";
import ShiftbotBanner from "@/components/grid/ShiftbotBanner";

interface Props {
  cards: GridCardView[];
  ticker: TickerProof[];
  categoryChips: CategoryChip[];
}

const PAGE_SIZE = 30;

type ParsedParams = ReturnType<typeof parseGridParams>;

type UrlPatch = {
  filters?: GridFilters;
  sort?: GridSort;
  /** undefined preserves current URL value, null clears, string sets */
  q?: string | null;
  /** undefined preserves, null clears, array sets */
  ranked?: string[] | null;
  /** undefined preserves, null/false clears, true sets */
  fallback?: boolean | null;
};

type UrlTransform = (current: ParsedParams) => UrlPatch;

/**
 * Top-level Grid client component.
 *
 * URL-as-truth architecture: filter / sort / SHIFTBOT state is NOT
 * mirrored in React state. It's parsed fresh from the URL on every
 * render via useMemo([searchParams]). All user interactions update the
 * URL via router.replace / router.push; the URL change feeds the next
 * render and state automatically follows. State and URL cannot drift.
 *
 * Genuine UI state — visibleCount, drawerOpen — stays in useState
 * because it doesn't belong in the URL.
 *
 * Why this matters: ShiftbotStrip navigates with router.push from
 * outside this component, browser back/forward navigates without our
 * knowledge, deep links land users mid-flow. With useState mirrors of
 * the URL these all caused state drift. With this pattern, every URL
 * source is the same source: the URL.
 *
 * Race safety: updateUrl reads window.location.search inside the
 * callback (not from a render-snapshot of useSearchParams) so two rapid
 * clicks compose against the truly-current URL — the second click sees
 * the first click's effect.
 */
export default function OperatorsClient({ cards, ticker, categoryChips }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ─── Derive everything from URL (single source of truth) ─────────
  const parsed = useMemo<ParsedParams>(() => {
    const sp = searchParams
      ? new URLSearchParams(searchParams.toString())
      : new URLSearchParams();
    return parseGridParams(sp);
  }, [searchParams]);

  const { filters, sort } = parsed;
  const shiftbot = {
    query: parsed.query,
    ranked: parsed.ranked,
    fallback: parsed.fallback,
  };

  // ─── Genuine UI state (not URL-worthy) ───────────────────────────
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Reset paging whenever the URL (and therefore the result set) changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchParams]);

  // ─── URL update primitive ────────────────────────────────────────
  // Reads window.location.search at call time (not searchParams from
  // a render snapshot) so rapid handlers compose correctly. The
  // transform receives the truly-current parsed URL and returns the
  // patch to apply.
  const updateUrl = useCallback(
    (transform: UrlTransform, method: "replace" | "push" = "replace") => {
      const sp = new URLSearchParams(window.location.search);
      const current = parseGridParams(sp);
      const patch = transform(current);

      const nextFilters = patch.filters ?? current.filters;
      const nextSort = patch.sort ?? current.sort;

      const params = buildGridParams(nextFilters, nextSort);

      // SHIFTBOT params: undefined preserves, null clears, value sets.
      const q = patch.q !== undefined ? patch.q : current.query;
      if (q) params.set("q", q);

      const ranked = patch.ranked !== undefined ? patch.ranked : current.ranked;
      if (ranked && ranked.length > 0) params.set("ranked", ranked.join(","));

      const fb = patch.fallback !== undefined ? patch.fallback : current.fallback;
      if (fb) params.set("fallback", "1");

      const qs = params.toString();
      const url = qs ? `/operators?${qs}` : "/operators";

      if (method === "push") {
        router.push(url, { scroll: false });
      } else {
        router.replace(url, { scroll: false });
      }
    },
    [router],
  );

  // ─── Derive visible cards ────────────────────────────────────────
  // SHIFTBOT Mode B (?ranked= present): restrict to those handles in
  // that order. Drops the standard filter/sort engine — Groq decided
  // the order, we honor it. The sidebar is locked in this mode.
  const filtered = useMemo(() => {
    if (shiftbot.ranked.length > 0) {
      const cardByHandle = new Map(cards.map((c) => [c.handle, c]));
      return shiftbot.ranked
        .map((h) => cardByHandle.get(h))
        .filter((c): c is GridCardView => Boolean(c));
    }
    return applyFilters(cards, filters);
  }, [cards, filters, shiftbot.ranked]);

  const sorted = useMemo(
    () => (shiftbot.ranked.length > 0 ? filtered : applySort(filtered, sort)),
    [filtered, sort, shiftbot.ranked.length],
  );
  const visible = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);
  const totalCount = filtered.length;
  const chips = useMemo(() => activeFilterChips(filters), [filters]);
  const showActive = hasActiveFilters(filters);

  const shiftbotMode: "filter" | "search" | "fallback" | null = shiftbot.query
    ? shiftbot.fallback
      ? "fallback"
      : shiftbot.ranked.length > 0
      ? "search"
      : "filter"
    : null;

  // Filter / sort / category UI is locked when Groq has picked specific
  // operators (Mode B / "search"). In filter and fallback modes the
  // sidebar is still useful — user can refine SHIFTBOT's filter result
  // or browse the default-ordered fallback.
  const locked = shiftbotMode === "search";

  // ─── Handlers ────────────────────────────────────────────────────
  // All handlers compose via updateUrl(transform). The transform
  // receives the truly-current parsed URL (not a stale render snapshot)
  // so rapid clicks compose correctly.

  const onUpdateFilter = useCallback(
    (patch: Partial<GridFilters>) => {
      updateUrl((current) => ({ filters: { ...current.filters, ...patch } }));
    },
    [updateUrl],
  );

  // Sidebar / EmptyState "Clear all" — clears filters, keeps sort,
  // keeps SHIFTBOT params. SHIFTBOT context is independent; user
  // resets it via the banner [Reset], not the sidebar.
  const onClearAll = useCallback(() => {
    updateUrl(() => ({ filters: { ...EMPTY_FILTERS } }));
  }, [updateUrl]);

  const onSelectCategory = useCallback(
    (slug: string) => {
      updateUrl((current) => ({
        filters: { ...current.filters, category: slug },
      }));
    },
    [updateUrl],
  );

  const onChangeSort = useCallback(
    (next: GridSort) => {
      updateUrl(() => ({ sort: next }));
    },
    [updateUrl],
  );

  const onRemoveChip = useCallback(
    (chip: ActiveFilterChip) => {
      updateUrl((current) => {
        const next: GridFilters = { ...current.filters };
        switch (chip.kind) {
          case "category":
            next.category = "all";
            break;
          case "tier":
            next.tiers = next.tiers.filter((t) => t !== chip.value);
            break;
          case "fee":
            next.fees = next.fees.filter((f) => f !== chip.value);
            break;
          case "language":
            next.languages = next.languages.filter((l) => l !== chip.value);
            break;
          case "timezone":
            next.timezones = next.timezones.filter((t) => t !== chip.value);
            break;
          case "minProofs":
            next.minProofs = 0;
            break;
          case "onlyDevProofs":
            next.onlyDevProofs = false;
            break;
          case "onlyVerified":
            next.onlyVerified = false;
            break;
        }
        return { filters: next };
      });
    },
    [updateUrl],
  );

  // Banner [Reset] — full clean slate. Filters, sort, AND SHIFTBOT
  // params all cleared. Push (not replace) so back button returns to
  // the SHIFTBOT-driven view.
  const onShiftbotReset = useCallback(() => {
    router.push("/operators");
  }, [router]);

  const onLoadMore = useCallback(() => {
    setVisibleCount((c) => c + PAGE_SIZE);
  }, []);

  const activeCount = chips.length;

  return (
    <>
      <LiveTicker proofs={ticker} />
      <CategoryChipRow
        chips={categoryChips}
        active={filters.category}
        onSelect={onSelectCategory}
        locked={locked}
      />

      <div className="g-layout">
        <FilterSidebar
          filters={filters}
          hasActiveFilters={showActive}
          onUpdateFilter={onUpdateFilter}
          onClearAll={onClearAll}
          locked={locked}
        />

        <section className="g-feed">
          <div className="g-feed-top">
            <div className="left">
              <button
                type="button"
                className="g-filters-btn"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open filters"
                disabled={locked}
              >
                Filters
                {activeCount > 0 && <span className="ct">{activeCount}</span>}
              </button>
              <ActiveFilterChips chips={chips} onRemove={onRemoveChip} />
            </div>
            <div className="right">
              <span className="g-result-count">
                <b>{totalCount}</b> Profiles
              </span>
              <SortDropdown active={sort} onChange={onChangeSort} locked={locked} />
            </div>
          </div>

          {shiftbotMode && shiftbot.query && (
            <ShiftbotBanner
              query={shiftbot.query}
              mode={shiftbotMode}
              onReset={onShiftbotReset}
            />
          )}

          {visible.length === 0 ? (
            <EmptyState onReset={onClearAll} />
          ) : (
            <div className="g-cardlist">
              {visible.map((card) => (
                <GridCard key={card.handle} card={card} />
              ))}
            </div>
          )}

          {visible.length < sorted.length && (
            <button
              type="button"
              className="g-loadmore"
              onClick={onLoadMore}
              aria-label="Load more operators"
            >
              <span className="spin">↓</span> Load more
            </button>
          )}
        </section>
      </div>

      <FilterDrawer
        open={drawerOpen}
        filters={filters}
        resultCount={totalCount}
        onClose={() => setDrawerOpen(false)}
        onUpdateFilter={onUpdateFilter}
        onClearAll={onClearAll}
        locked={locked}
      />
    </>
  );
}
