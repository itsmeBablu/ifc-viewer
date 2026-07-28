"use client";

import Image from "next/image";
import GlassPanel from "./GlassPanel";

/** Top-left brand mark only. */
export default function AppHeader() {
  return (
    <div
      data-app-header
      className="pointer-events-none fixed top-3 left-4 z-[45]"
    >
      <div className="pointer-events-auto">
        <GlassPanel variant="panel" zIndex={45}>
          <div className="flex items-center px-2 py-1 sm:px-2.5 sm:py-1">
            <Image
              src="/ibv_logo.svg"
              alt="IBV logo"
              width={32}
              height={32}
              className="h-5 w-auto object-contain sm:h-6"
              priority
            />
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
