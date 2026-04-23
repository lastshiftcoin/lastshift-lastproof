import type { ProfileCategory } from "@/lib/public-profile-view";

export function CategoryChips({ categories }: { categories: ProfileCategory[] }) {
  return (
    <div className="pp-cat-row">
      {categories.map((c) => (
        <div
          key={c.slug}
          className={`pp-cat-chip${c.isPrimary ? " pp-primary" : ""}`}
        >
          {c.label}
        </div>
      ))}
    </div>
  );
}
