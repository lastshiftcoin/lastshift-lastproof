import "./blog.css";

/**
 * Pass-through layout for /blog routes.
 *
 * Inherits the (marketing) shell above (Topbar, Footer, ShiftbotStrip,
 * WalletBoundary) and adds blog-only CSS scoped to this subtree.
 */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
