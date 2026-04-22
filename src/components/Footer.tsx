"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Universal LASTSHIFT footer — §4.4 + §12.6 */
export default function Footer() {
  const pathname = usePathname() || "";
  if (pathname.startsWith("/manage")) return null;

  return (
    <footer className="lp-footer">
      <div>
        <a
          href="https://lastshift.ai"
          target="_blank"
          rel="noreferrer"
          style={{ color: "inherit", textDecoration: "none" }}
        >
          lastshift.ai
        </a>
        , a company of vibe coders
      </div>
      <div className="right">
        <Link href="/blog">BLOG</Link>
        <Link href="/help">HELP</Link>
        <a href="https://lastproof.app/status" target="_blank" rel="noreferrer">STATUS</a>
        <Link href="https://lastshift.app">TERMINAL</Link>
        <Link href="https://lastshiftcoin.com">LASTSHIFTCOIN.COM</Link>
      </div>
    </footer>
  );
}
