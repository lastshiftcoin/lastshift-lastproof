import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import ShiftbotStrip from "@/components/ShiftbotStrip";

/**
 * Marketing shell. Wraps every public-facing page that uses the standard
 * topbar + footer + pinned SHIFTBOT strip. Boot-screen pages like /grid live
 * outside this group so they can render their own terminal chrome.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="wrap">
        <Topbar />
        {children}
        <Footer />
      </div>
      <ShiftbotStrip />
    </>
  );
}
