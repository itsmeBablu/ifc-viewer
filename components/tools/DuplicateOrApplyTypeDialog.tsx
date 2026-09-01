"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { LuLayers, LuCopy, LuCheck, LuX } from "react-icons/lu";

export type DuplicateOrApplyTypeDialogProps = {
  isOpen: boolean;
  typeName: string;
  matchingCount: number;
  materialName?: string;
  onApplyToAll: () => void;
  onDuplicate: () => void;
  onCancel: () => void;
};

export default function DuplicateOrApplyTypeDialog({
  isOpen,
  typeName,
  matchingCount,
  materialName,
  onApplyToAll,
  onDuplicate,
  onCancel,
}: DuplicateOrApplyTypeDialogProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    gsap.fromTo(
      modalRef.current,
      { opacity: 0, scale: 0.94, y: 12 },
      { opacity: 1, scale: 1, y: 0, duration: 0.28, ease: "power3.out" },
    );
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-md">
      <div
        ref={modalRef}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-zinc-900/90 p-6 text-zinc-100 shadow-2xl backdrop-blur-xl"
        style={{
          boxShadow: "0 24px 60px -12px rgba(0,0,0,0.7), 0 0 40px rgba(250,204,21,0.12)",
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LuX className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-yellow-400/40 bg-yellow-400/15 text-yellow-400 shadow-inner">
            <LuLayers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Update Wall Type Material
            </h3>
            <p className="text-xs text-zinc-400">
              Type: <span className="font-semibold text-yellow-400">{typeName}</span>
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-zinc-300">
          This wall shares its definition with{" "}
          <strong className="text-yellow-300">{matchingCount} walls</strong> in your project.
          {materialName ? (
            <>
              {" "}Changing material to <strong className="text-white">{materialName}</strong>:
            </>
          ) : (
            " How would you like to apply this material change?"
          )}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onApplyToAll}
            className="group flex items-center justify-between rounded-xl border border-yellow-400/40 bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-3 text-left font-bold text-zinc-950 shadow-lg shadow-yellow-400/20 transition-all hover:brightness-110 active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5">
              <LuCheck className="h-4 w-4 shrink-0" />
              <div>
                <div className="text-xs font-black">
                  Apply to All ({matchingCount} Walls)
                </div>
                <div className="text-[10px] font-medium opacity-80">
                  Updates type &quot;{typeName}&quot; across entire model
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onDuplicate}
            className="group flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left font-medium text-white transition-all hover:border-yellow-400/40 hover:bg-white/10 active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5">
              <LuCopy className="h-4 w-4 shrink-0 text-yellow-400" />
              <div>
                <div className="text-xs font-bold text-zinc-100">
                  Duplicate Type &amp; Apply to This Wall Only
                </div>
                <div className="text-[10px] text-zinc-400">
                  Creates &quot;{typeName} (Custom)&quot; for this single wall
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="mt-1 w-full rounded-xl py-2 text-center text-xs font-semibold text-zinc-400 transition-colors hover:text-zinc-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
