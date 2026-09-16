import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  return (
    <div className="ai-composer-controls relative flex items-center justify-between gap-1.5 border-b px-2.5 py-1.5 transition-colors">
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
          className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-bold tracking-tight transition-all border ${
            mepModeActive
              ? "bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 text-[#38bdf8] border-[#38bdf8]/30 hover:border-[#38bdf8]/60 shadow-[0_0_10px_rgba(56,189,248,0.15)]"
              : "bg-[#facc15]/10 hover:bg-[#facc15]/20 text-amber-500 dark:text-[#facc15] border-amber-500/30 dark:border-[#facc15]/30 hover:border-amber-500/60 dark:hover:border-[#facc15]/60 shadow-[0_0_10px_rgba(250,204,21,0.15)]"
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

        {dropdownOpen && (
          <div
            role="listbox"
            aria-label="Select AI Model"
            className="absolute right-0 bottom-full mb-1.5 z-[200] w-64 rounded-xl border border-[var(--panel-divider,rgba(255,255,255,0.12))] bg-[var(--surface-card,#13151f)]/95 backdrop-blur-2xl p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted,#71717a)] flex items-center gap-1">
              <LuSparkles className="size-3 text-amber-400" />
              <span>AI Intelligence Models</span>
            </div>
            <div className="space-y-1 mt-1">
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
                    className={`w-full text-left p-2 rounded-lg transition-all flex items-start justify-between gap-2 ${
                      isSelected
                        ? mepModeActive
                          ? "bg-[#38bdf8]/15 border border-[#38bdf8]/30 text-[#09090b] dark:text-[#f4f4f5]"
                          : "bg-[#facc15]/15 border border-[#facc15]/30 text-[#09090b] dark:text-[#f4f4f5]"
                        : "hover:bg-black/5 dark:hover:bg-white/5 border border-transparent text-[var(--text-strong,#18181b)] dark:text-[#e4e4e7]"
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
          </div>
        )}
      </div>
    </div>
  );
}


