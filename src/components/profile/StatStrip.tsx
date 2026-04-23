import type { PublicProfileView } from "@/lib/public-profile-view";

interface Props {
  proofsConfirmed: PublicProfileView["proofsConfirmed"];
  devProofsConfirmed: PublicProfileView["devProofsConfirmed"];
  projectsCount: PublicProfileView["projectsCount"];
  feeRange: PublicProfileView["feeRange"];
}

export function StatStrip({ proofsConfirmed, devProofsConfirmed, projectsCount, feeRange }: Props) {
  return (
    <section className="pp-stats">
      <div className="pp-stat" data-tip="Total verified work submissions">
        <div className="pp-num pp-accent">{proofsConfirmed}</div>
        <div className="pp-label">PROOFS</div>
      </div>
      <div className="pp-stat" data-tip="Proofs verified by project devs">
        <div className="pp-num pp-green">{devProofsConfirmed}</div>
        <div className="pp-label">
          DEV PROOFS <span className="pp-dev-icon">DEV</span>
        </div>
      </div>
      <div className="pp-stat" data-tip="Distinct projects worked on">
        <div className="pp-num">{projectsCount}</div>
        <div className="pp-label">PROJECTS</div>
      </div>
      <div className="pp-stat" data-tip="Typical engagement fee range">
        <div className="pp-num pp-accent">{feeRange}</div>
        <div className="pp-label">FEE RANGE</div>
      </div>
    </section>
  );
}
