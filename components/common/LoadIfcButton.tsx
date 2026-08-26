"use client";

/**
 * LoadIfcButton — file-picker button for loading a local .ifc model.
 *
 * Hides a native file input and proxies clicks to it; wraps the visible
 * button in GlassPanel. `variant` switches between the primary amber CTA
 * style and a plain glass-inset style; `iconOnly` collapses it to an
 * icon-only circular button.
 */

import { useRef } from "react";
import GlassPanel from "./GlassPanel";
import { IconUpload } from "./ui";
import { motion, radius } from "@/lib/designTokens";

type Props = {
  onFile: (file: File) => void;
  disabled?: boolean;
  label?: string;
  variant?: "default" | "primary";
  className?: string;
  iconOnly?: boolean;
};

export default function LoadIfcButton({
  onFile,
  disabled,
  label = "Load IFC",
  variant = "primary",
  className = "",
  iconOnly = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const primary = variant === "primary";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".ifc,.frag,application/x-step,application/octet-stream,.IFC,.FRAG"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <GlassPanel variant="control" zIndex={2} wrapperClassName="inline-flex">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={`${motion.base} ${iconOnly ? "rounded-full h-10 w-10 p-0" : radius.control} inline-flex ${iconOnly ? "" : "min-w-[168px] px-6 py-2.5 text-sm"} items-center justify-center gap-2 font-semibold active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${
            primary
              ? "btn-v-yellow btn-liquid-hover text-[#09090b]"
              : "glass-inset text-zinc-800 hover:bg-white/15 dark:text-zinc-100"
          } ${className}`}
          aria-label={label}
        >
          <IconUpload />
          {!iconOnly && label}
        </button>
      </GlassPanel>
    </>
  );
}
