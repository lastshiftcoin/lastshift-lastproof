/**
 * Dashboard footer — wireframe: lastproof-dashboard.html `.footer`
 */
export function DashboardFooter() {
  return (
    <footer className="footer" style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 24px",
      borderTop: "1px solid var(--border)",
      fontFamily: "var(--mono)",
      fontSize: "9px",
      color: "var(--text-dim)",
      letterSpacing: "1px",
    }}>
      <span>lastshift.ai, a company of vibe coders</span>
      <span style={{ display: "flex", gap: 16 }}>
        <a href="/blog">
          Blog
        </a>
        <a href="/help">
          Help
        </a>
        <a href="https://lastproof.app/status" target="_blank" rel="noopener noreferrer">
          Status
        </a>
        <a href="https://lastshiftcoin.com" target="_blank" rel="noopener noreferrer">
          lastshiftcoin.com
        </a>
        <a href="https://lastshift.app" target="_blank" rel="noopener noreferrer">
          Terminal
        </a>
      </span>
    </footer>
  );
}
