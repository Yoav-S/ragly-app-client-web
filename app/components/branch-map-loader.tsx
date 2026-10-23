"use client";

import dynamic from "next/dynamic";

/** Leaflet touches `window`, so the map only renders in the browser. */
export const BranchMapClient = dynamic(() => import("./branch-map"), {
  ssr: false,
  loading: () => <div className="h-[280px] animate-pulse rounded-2xl border border-line bg-background" aria-hidden />,
});
