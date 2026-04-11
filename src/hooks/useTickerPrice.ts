"use client";

import { useState, useEffect } from "react";

interface TickerData {
  price: string;
  change: string | null;
  direction: "up" | "down" | null;
}

/** Polls /api/ticker every 60s. Returns formatted price + 24h change. */
export function useTickerPrice(): TickerData {
  const [data, setData] = useState<TickerData>({ price: "…", change: null, direction: null });

  useEffect(() => {
    let mounted = true;

    async function fetchPrice() {
      try {
        const res = await fetch("/api/ticker");
        if (!res.ok) return;
        const json = await res.json();
        if (!mounted) return;

        const usd = json.usd as number;
        const price = usd < 0.01
          ? `$${usd.toFixed(5)}`
          : usd < 1
            ? `$${usd.toFixed(4)}`
            : `$${usd.toFixed(2)}`;

        const change24h = json.change24h as number | null;
        let change: string | null = null;
        let direction: "up" | "down" | null = null;
        if (change24h != null) {
          const sign = change24h >= 0 ? "+" : "";
          change = `${sign}${change24h.toFixed(1)}%`;
          direction = change24h >= 0 ? "up" : "down";
        }

        setData({ price, change, direction });
      } catch {
        // keep last known data
      }
    }

    fetchPrice();
    const interval = setInterval(fetchPrice, 60_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return data;
}
