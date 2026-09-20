"use client";
import dynamic from "next/dynamic";
const MiniFusionTool = dynamic(
  () => import("./mini-fusion-tool").then((m) => m.MiniFusionTool),
  { ssr: false, loading: () => (
    <div className="h-48 rounded-2xl border border-primary/30 bg-primary/5 animate-pulse" />
  ) }
);
export { MiniFusionTool };
