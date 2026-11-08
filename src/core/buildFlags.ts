/**
 * Build-time switches. A build made with VITE_INCLUDE_OFFICIAL=false carries no
 * sample items from the test publisher: the TSI importer refuses them and the Settings
 * switch that shows or hides them is not offered. Plain Node scripts have no
 * `import.meta.env`, so the lookup tolerates its absence.
 */
export const OFFICIAL_ITEMS_ALLOWED: boolean =
  import.meta.env?.VITE_INCLUDE_OFFICIAL !== "false";
