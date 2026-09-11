"use client";

import { useEffect, useRef, useState } from "react";
import { useToolMarkupStore } from "@/store/useToolMarkupStore";

export default function PendingNoteCard() {
  const pendingNote = useToolMarkupStore((s) => s.pendingNote);
  const commitPendingNote = useToolMarkupStore((s) => s.commitPendingNote);
  const cancelPendingNote = useToolMarkupStore((s) => s.cancelPendingNote);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (pendingNote) {
      setText("");
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [pendingNote]);

  if (!pendingNote) return null;

  const handleSave = () => {
    const trimmed = text.trim();
    if (trimmed) {
      void commitPendingNote(trimmed);
    }
  };

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-84 max-w-[90vw] rounded-2xl border border-yellow-400/40 bg-[#16181f]/95 p-3.5 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">
            {pendingNote.elementName ? `Note on ${pendingNote.elementName}` : "New Note"}
          </span>
        </div>
        <button
          type="button"
          onClick={cancelPendingNote}
          className="text-xs text-white/50 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSave();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancelPendingNote();
          }
        }}
        placeholder="Type note content... (Enter to save, Esc to cancel)"
        rows={3}
        className="w-full resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white placeholder-white/40 outline-none focus:border-yellow-400/80 transition-colors"
      />
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
        <span className="text-[10px] text-white/40">Press ↵ Enter to save</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cancelPendingNote}
            className="rounded-lg px-2.5 py-1 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!text.trim()}
            onClick={handleSave}
            className="rounded-lg bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 text-xs font-semibold text-black transition-colors shadow-sm"
          >
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}
