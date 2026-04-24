# wireframes/_drafts

Work-in-progress wireframes live here. Cowork output, mid-iteration drafts, experiments — anything that isn't canon yet.

## Rules

- **Canonical (shipped) wireframes stay at the flat `wireframes/` root.** This is the historical convention and it hasn't moved — don't touch those files, they're referenced by path across `docs/`, `CLAUDE.md`, and multiple `WORKLOG.md` entries. Moving them breaks history.
- **New wireframes start in `_drafts/<surface>/`.** One subfolder per surface (grid, future new pages, etc.).
- **Promotion to canon = simple move.** When a draft is approved:
  ```
  mv wireframes/_drafts/grid/lastproof-grid.html wireframes/lastproof-grid.html
  ```
  That's the promotion. Update any references in handoff docs in the same commit.
- **External tools (Cowork, etc.) MUST be told exactly where to save.** Never assume they'll pick a sensible path — they won't. Always hand back output via chat and save manually to the drafts folder per the session brief.

## Current drafts

| Folder | Source | Status |
|---|---|---|
| `grid/` | Cowork wireframe iterations for `/grid` (launching 2026-05-08) | in progress |

## History

- `2026-04-23` — folder created. First occupant: `grid/` (see `docs/GRID-COWORK-BRIEF.md` for the brief Cowork is working from).
