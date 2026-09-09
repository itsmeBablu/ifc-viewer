"use client";

import { useModifyStore } from "@/store/useModifyStore";
import { activateModifyTool } from "./ModifyTools";

export default function WallAttachControl({ className }: { className: string }) {
  const tool = useModifyStore((state) => state.tool);
  return <select
    aria-label="Attach wall"
    title="Attach wall top or bottom to a roof or floor"
    className={className}
    value={tool === "attachTop" || tool === "attachBase" ? tool : ""}
    onChange={(event) => activateModifyTool(event.target.value as "attachTop" | "attachBase")}
  >
    <option value="" disabled>Attach</option>
    <option value="attachTop">Attach Top</option>
    <option value="attachBase">Attach Bottom</option>
  </select>;
}
