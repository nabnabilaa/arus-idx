import bundleJson from "@/data/arus.json";
import seriesJson from "@/data/series.json";
import type { Bundle, Horizon, Series } from "./types";

/** Imported at build time: the static export ships no API key and needs no backend. */
export const bundle = bundleJson as unknown as Bundle;
export const series = seriesJson as unknown as Series;

/** Only horizons that passed out-of-sample validation are published; a model that fails is withheld, not shown with a caveat. */
export const PUBLISHED: Horizon[] = ([1, 20] as Horizon[]).filter((h) => bundle.models[String(h) as "1" | "20"].metrics.proven !== false);
export const DEFAULT_HORIZON: Horizon = PUBLISHED[0] ?? 1;
