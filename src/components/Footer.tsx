import Link from "next/link";

/** Universal LASTSHIFT footer — §4.4 + §12.6 */
export default function Footer() {
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
        <Link href="https://lastshift.app">TERMINAL</Link>
        <Link href="https://lastshiftcoin.com">LASTSHIFTCOIN.COM</Link>
      </div>
    </footer>
  );
}
