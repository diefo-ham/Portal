/**
 * Active / inactive classification across the four exports, ported from the
 * Python preparation tool. Source IDs establish identity; there is no fuzzy
 * matching. Anything the files cannot prove stays "unknown".
 */
import type { SourceRecord } from "./segment.ts";

export type ActiveMode = "inclusive" | "active-only" | "unknown";
export type TestStatus = "active" | "inactive" | "unknown";

export interface PairComparison {
  both: number;
  inactiveFileOnly: number;
  activeFileOnly: number;
}

export interface Classification {
  statuses: Map<string, TestStatus>;
  comparison: Record<string, PairComparison>;
  conflicts: { section: string; reason: string }[];
}

export interface ExportPair {
  /** Group label, for example "math" or "read_write". */
  group: string;
  inactive: readonly SourceRecord[];
  active: readonly SourceRecord[];
}

export function classifyExports(
  pairs: readonly ExportPair[],
  mode: ActiveMode,
): Classification {
  const statuses = new Map<string, TestStatus>();
  const comparison: Record<string, PairComparison> = {};
  const conflicts: Classification["conflicts"] = [];
  for (const {
    group,
    inactive: inactiveRecords,
    active: activeRecords,
  } of pairs) {
    const inactive = new Set(inactiveRecords.map((record) => record.id));
    const active = new Set(activeRecords.map((record) => record.id));
    const both = [...inactive].filter((id) => active.has(id));
    const inactiveOnly = [...inactive].filter((id) => !active.has(id));
    const activeOnly = [...active].filter((id) => !inactive.has(id));
    comparison[group] = {
      both: both.length,
      inactiveFileOnly: inactiveOnly.length,
      activeFileOnly: activeOnly.length,
    };
    for (const id of new Set([...inactive, ...active]))
      statuses.set(
        id,
        inactive.has(id)
          ? "inactive"
          : mode !== "unknown"
            ? "active"
            : "unknown",
      );
    if (mode === "inclusive" && inactiveOnly.length) {
      // An inclusive/exclusive comparison is invalid when the claimed superset is incomplete.
      for (const id of activeOnly) statuses.set(id, "unknown");
      conflicts.push({
        section: group,
        reason:
          "Inactive export is not a subset of the claimed inclusive export. Inclusive-only IDs left unknown.",
      });
    }
    if (mode === "active-only")
      for (const id of both) statuses.set(id, "unknown");
  }
  return { statuses, comparison, conflicts };
}
