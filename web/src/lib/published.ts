import published from "@/data/published.json";
import type { Horizon } from "./types";

/**
 * Horizons that passed out-of-sample validation; a model that fails is withheld, not shown with a caveat.
 * A tiny file of its own so client components never pull in the full data bundle.
 */
export const PUBLISHED: Horizon[] = (published.horizons as number[]).filter((h): h is Horizon => h === 1 || h === 20);
export const DEFAULT_HORIZON: Horizon = PUBLISHED[0] ?? 1;
