export const DISCIPLINE_OPTIONS = [
  { id: "fire", label: "Brann" },
  { id: "power", label: "Sterkstrøm" },
  { id: "low_voltage", label: "Svakstrøm" },
] as const;

export const DISCIPLINE_STYLE: Record<string, string> = {
  fire: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  power: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  low_voltage: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
};
