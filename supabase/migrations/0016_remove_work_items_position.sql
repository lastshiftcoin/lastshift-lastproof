-- Migration 0016: Remove unused work_items.position column
-- The drag-and-drop reorder feature was removed; both dashboard and public
-- profile now sort by date (Current first, then started_at descending).

ALTER TABLE work_items DROP COLUMN IF EXISTS position;
