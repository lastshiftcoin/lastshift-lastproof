import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maintenance — LASTPROOF",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0b0f",
        color: "#e5e7eb",
        fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 24px",
            borderRadius: "50%",
            background: "rgba(255, 145, 0, 0.1)",
            border: "2px solid #ff9100",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 24px rgba(255, 145, 0, 0.2)",
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ff9100"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>

        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "#ff9100",
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          &gt; MAINTENANCE MODE
        </div>

        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            margin: "0 0 16px",
            letterSpacing: "-0.02em",
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
          }}
        >
          We&apos;ll be right back.
        </h1>

        <p
          style={{
            fontSize: 13,
            color: "#6b7280",
            lineHeight: 1.7,
            margin: "0 0 32px",
          }}
        >
          LASTPROOF is getting an upgrade. We&apos;re deploying new infrastructure
          to make proofs faster and more reliable. This won&apos;t take long.
        </p>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: "rgba(255, 145, 0, 0.06)",
            border: "1px solid rgba(255, 145, 0, 0.2)",
            borderRadius: 6,
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "#ff9100",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#ff9100",
              boxShadow: "0 0 6px rgba(255, 145, 0, 0.6)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          DEPLOYING UPDATES
        </div>

        <div
          style={{
            marginTop: 32,
            fontSize: 10,
            color: "#374151",
            letterSpacing: "0.1em",
          }}
        >
          LASTPROOF by{" "}
          <a
            href="https://lastshift.ai"
            style={{ color: "#4b5563", textDecoration: "none" }}
          >
            lastshift.ai
          </a>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    </div>
  );
}
