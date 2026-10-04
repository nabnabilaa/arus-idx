import bundleJson from "@/data/arus.json";
import seriesJson from "@/data/series.json";
import type { Bundle, Series } from "./types";

/** Imported at build time: the static export ships no API key and needs no backend. */
export const bundle = bundleJson as unknown as Bundle;
export const series = seriesJson as unknown as Series;
