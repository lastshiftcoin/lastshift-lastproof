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
import { parseGridParams, buildGridParams, defaultGridState } from "@/lib/grid/url-params";
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

/**
 * Top-level Grid client component. Owns filter / sort / drawer state.
 *
 * The URL is the source of truth — we serialize filter state to query
 * params on every change and re-read on mount. This makes Grid views
 * shareable, back-button-friendly, and refresh-stable.
 */
export default function OperatorsClient({ cards, ticker, categoryChips }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initial state from URL on first render. We don't re-derive from URL on
  // every render because the local state is what user interactions mutate.
  const [filters, setFilters] = useState<GridFilters>(() => {
    const sp = searchParams ? new URLSearchParams(searchParams.toString()) : new URLSearchParams();
    return parseGridParams(sp).filters;
  });
  const [sort, setSort] = useState<GridSort>(() => {
    const sp = searchParams ? new URLSearchParams(searchParams.toString()) : new URLSearchParams();
    return parseGridParams(sp).sort;
  });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // SHIFTBOT-driven URL state — read once on mount. The strip handles its
  // own navigation; this client just renders what the URL says.
  const shiftbot = useMemo(() => {
    const sp = searchParams
      ? new URLSearchParams(searchParams.toString())
      : new URLSearchParams();
    const parsed = parseGridParams(sp);
    return {
      query: parsed.query,
      ranked: parsed.ranked,
      fallback: parsed.fallback,
    };
  }, [searchParams]);

  // Push filter+sort to URL whenever local state changes. `replace` (not
  // push) so the back-button isn't a history of filter toggles.
  const syncUrl = useCallback(
    (nextFilters: GridFilters, nextSort: GridSort) => {
      const params = buildGridParams(nextFilters, nextSort);
      const qs = params.toString();
      const url = qs ? `/operators?${qs}` : "/operators";
      router.replace(url, { scroll: false });
    },
    [router],
  );

  // Sync URL on filter/sort change, debounced via effect (microtask)
  useEffect(() => {
    syncUrl(filters, sort);
    // Reset visible count when filters change so users see the top of the
    // newly-filtered set rather than scrolling through stale offsets.
    setVisibleCount(PAGE_SIZE);
  }, [filters, sort, syncUrl]);

  // ─── Derive visible cards ──────────────────────────────────────
  // SHIFTBOT Mode B (?ranked= present): restrict to those handles, in that
  // order. Drops the standard filter/sort engine entirely for these cards
  // — Groq decided the order, we honor it.
  const filtered = useMemo(() => {
    if (shiftbot.ranked.length > 0) {
      const cardByHandle = new Map(cards.map((c) => [c.handle, c]));
      return shiftbot.ranked
        .map((h) => cardByHandle.get(h))
        .filter((c): c is GridCardView => Boolean(c));
    }
    return applyFilters(cards, filters);
  }, [cards, filters, shiftbot.ranked]);

  // Skip sort if we're in ranked mode — Groq's order is the order.
  const sorted = useMemo(
    () =>
      shiftbot.ranked.length > 0 ? filtered : applySort(filtered, sort),
    [filtered, sort, shiftbot.ranked.length],
  );
  const visible = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);
  const totalCount = filtered.length;
  const chips = useMemo(() => activeFilterChips(filters), [filters]);
  const showActive = hasActiveFilters(filters);

  // SHIFTBOT banner mode for rendering
  const shiftbotMode: "filter" | "search" | "fallback" | null = shiftbot.query
    ? shiftbot.fallback
      ? "fallback"
      : shiftbot.ranked.length > 0
      ? "search"
      : "filter"
    : null;

  // ─── Handlers ──────────────────────────────────────────────────

  const onUpdateFilter = useCallback((patch: Partial<GridFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const onClearAll = useCallback(() => {
    setFilters({ ...EMPTY_FILTERS });
  }, []);

  const onSelectCategory = useCallback((slug: string) => {
    setFilters((prev) => ({ ...prev, category: slug }));
  }, []);

  const onChangeSort = useCallback((next: GridSort) => {
    setSort(next);
  }, []);

  const onRemoveChip = useCallback((chip: ActiveFilterChip) => {
    setFilters((prev) => {
      switch (chip.kind) {
        case "category":
          return { ...prev, category: "all" };
        case "tier":
          return { ...prev, tiers: prev.tiers.filter((t) => t !== chip.value) };
        case "fee":
          return { ...prev, fees: prev.fees.filter((f) => f !== chip.value) };
        case "language":
          return { ...prev, languages: prev.languages.filter((l) => l !== chip.value) };
        case "timezone":
          return { ...prev, timezones: prev.timezones.filter((t) => t !== chip.value) };
        case "minProofs":
          return { ...prev, minProofs: 0 };
        case "onlyDevProofs":
          return { ...prev, onlyDevProofs: false };
        case "onlyVerified":
          return { ...prev, onlyVerified: false };
        default:
          return prev;
      }
    });
  }, []);

  const onLoadMore = useCallback(() => {
    setVisibleCount((c) => c + PAGE_SIZE);
  }, []);

  // Active-filter count for the mobile filters button badge
  const activeCount = chips.length;

  return (
    <>
      <LiveTicker proofs={ticker} />
      <CategoryChipRow
        chips={categoryChips}
        active={filters.category}
        onSelect={onSelectCategory}
      />

      <div className="g-layout">
        <FilterSidebar
          filters={filters}
          hasActiveFilters={showActive}
          onUpdateFilter={onUpdateFilter}
          onClearAll={onClearAll}
        />

        <section className="g-feed">
          <div className="g-feed-top">
            <div className="left">
              <button
                type="button"
                className="g-filters-btn"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open filters"
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
              <SortDropdown active={sort} onChange={onChangeSort} />
            </div>
          </div>

          {shiftbotMode && shiftbot.query && (
            <ShiftbotBanner query={shiftbot.query} mode={shiftbotMode} />
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
      />
    </>
  );
}

// Suppress unused-import warning when default state is needed externally
void defaultGridState;
