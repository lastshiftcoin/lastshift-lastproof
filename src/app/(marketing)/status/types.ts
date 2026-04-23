export type UpdateCategory = "fixed" | "added" | "improved";

export interface UpdateEntry {
  version: string;
  date: string;
  category: UpdateCategory;
  headline: string;
  copy: string;
  source_commits: string[];
}

export interface UpdatesFile {
  latest_version: string;
  entries: UpdateEntry[];
}

export type SystemStatus = "operational" | "degraded" | "outage";
