import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AI_MODELS, AI_MODES, modelDetails, type AiModelId, type AiMode } from "@/lib/ai/models";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";
import { LuCheck, LuChevronDown, LuSparkles, LuZap } from "react-icons/lu";

type Props = {
  model: AiModelId;
  mode: AiMode;
  disabled: boolean;
  onModel: (model: AiModelId) => void;
  onMode: (mode: AiMode) => void;
};

export default function AiModelControls({ model, mode, disabled, onModel, onMode }: Props) {
  const selectedModel = modelDetails(model);
  const mepModeActive = useLayoutDrawingStore(s => s.mepModeActive);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuBox, setMenuBox] = useState({ left: 8, top: 8, width: 275, height: 380 });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      const position = () => {
        const rect = dropdownRef.current?.getBoundingClientRect();
        if (!rect) return;
        const width = Math.min(300, window.innerWidth - 16);
        const availableAbove = rect.top - 16, availableBelow = window.innerHeight - rect.bottom - 16;
        const above = availableAbove >= availableBelow;
        const height = Math.min(380, Math.max(120, above ? availableAbove : availableBelow));
        setMenuBox({ left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)), top: Math.max(8, above ? rect.top - height - 8 : rect.bottom + 8), width, height });
      };
      position();
      window.addEventListener("resize", position);
      window.addEventListener("scroll", position, true);
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("resize", position);
        window.removeEventListener("scroll", position, true);
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  return (
    <div className="ai-composer-controls relative flex items-center justify-between gap-1.5 border-b px-2.5 py-1.5 transition-colors rounded-t-[17px]">
      {/* Mode pills: Build, Review, Guide in v-Yellow/v-Blue palette */}
      <div className="ai-mode-pills-container flex items-center gap-0.5 rounded-lg p-0.5 transition-colors" role="group" aria-label="Assistant mode">
        {AI_MODES.map(option => {
          const isActive = mode === option.id;
          return (
            <button
              type="button"
              key={option.id}
              disabled={disabled}
              aria-pressed={isActive}
              title={option.description}
              onClick={() => onMode(option.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                isActive
                  ? mepModeActive
                    ? "bg-[#38bdf8] text-[#09090b] shadow-[0_1px_8px_rgba(56,189,248,0.4)] font-extrabold"
                    : "bg-[#facc15] text-[#09090b] shadow-[0_1px_8px_rgba(250,204,21,0.4)] font-extrabold"
                  : "ai-mode-pill-inactive hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Custom Modern Liquid Glass Dropdown for AI Model */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setDropdownOpen(prev => !prev)}
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
          title={selectedModel.description}
          className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-bold tracking-tight transition-all border shadow-sm ${
            mepModeActive
              ? dropdownOpen
                ? "bg-[#38bdf8]/25 text-[#38bdf8] border-[#38bdf8] ring-2 ring-[#38bdf8]/30 shadow-[0_0_12px_rgba(56,189,248,0.3)]"
                : "bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 text-[#38bdf8] border-[#38bdf8]/30 hover:border-[#38bdf8]/60 shadow-[0_0_10px_rgba(56,189,248,0.15)]"
              : dropdownOpen
                ? "bg-amber-500/25 text-amber-600 dark:text-[#facc15] border-amber-500 dark:border-[#facc15] ring-2 ring-amber-500/30 shadow-[0_0_12px_rgba(250,204,21,0.3)]"
                : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-[#facc15] border-amber-500/30 dark:border-[#facc15]/30 hover:border-amber-500/60 dark:hover:border-[#facc15]/60 shadow-[0_0_10px_rgba(250,204,21,0.15)]"
          }`}
        >
          <span className="truncate max-w-[110px]">
            {selectedModel.label.replace("Gemini ", "")}
          </span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-black/10 dark:bg-white/10 opacity-80 uppercase tracking-wider font-semibold">
            {selectedModel.tier}
          </span>
          <LuChevronDown className={`size-3 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && createPortal(
          <div
            ref={menuRef}
            data-theme="light"
            style={{ position: "fixed", left: menuBox.left, top: menuBox.top, right: "auto", bottom: "auto", width: menuBox.width, maxHeight: menuBox.height, zIndex: 30000 }}
            role="listbox"
            aria-label="Select AI Model"
            className="ai-model-dropdown-menu animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted,#71717a)] flex items-center gap-1.5 border-b border-black/5 dark:border-white/10 mb-1">
              <LuSparkles className="size-3 text-amber-400" />
              <span>AI Intelligence Models</span>
            </div>
            <div className="space-y-1">
              {AI_MODELS.map(option => {
                const isSelected = option.id === model;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onModel(option.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-xl transition-all flex items-start justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? mepModeActive
                          ? "bg-[#38bdf8]/15 border border-[#38bdf8]/40 text-[#09090b] dark:text-[#f4f4f5] shadow-sm"
                          : "bg-[#facc15]/15 border border-[#facc15]/40 text-[#09090b] dark:text-[#f4f4f5] shadow-sm"
                        : "hover:bg-black/5 dark:hover:bg-white/5 border border-transparent text-[#18181b] dark:text-[#e4e4e7]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs">
                          {option.label}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                          isSelected
                            ? mepModeActive ? "bg-[#38bdf8] text-black font-extrabold" : "bg-[#facc15] text-black font-extrabold"
                            : "bg-black/10 dark:bg-white/10 text-[var(--text-muted)]"
                        }`}>
                          {option.tier}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-[var(--text-muted,#71717a)] mt-0.5 leading-snug line-clamp-2">
                        {option.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-muted)] opacity-75 font-mono">
                        <span className="flex items-center gap-0.5">
                          <LuZap className="size-2.5 text-amber-400" />
                          {option.maxOutputTokens.toLocaleString()} tokens
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <LuCheck className={`size-4 shrink-0 mt-0.5 ${mepModeActive ? "text-[#38bdf8]" : "text-amber-500 dark:text-[#facc15]"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>, document.body
        )}
      </div>
    </div>
  );
}

