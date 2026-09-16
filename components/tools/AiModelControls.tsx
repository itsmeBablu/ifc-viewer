import { AI_MODELS, AI_MODES, isAiModelId, modelDetails, type AiModelId, type AiMode } from "@/lib/ai/models";
import { LuChevronDown } from "react-icons/lu";

type Props = {
  model: AiModelId;
  mode: AiMode;
  disabled: boolean;
  onModel: (model: AiModelId) => void;
  onMode: (mode: AiMode) => void;
};

export default function AiModelControls({ model, mode, disabled, onModel, onMode }: Props) {
  const selectedModel = modelDetails(model);

  return (
    <div className="ai-composer-controls flex items-center justify-between gap-1.5 border-b border-[var(--panel-divider)]/40 bg-[var(--surface-muted)]/50 px-2.5 py-1.5">
      {/* Mode pills: Build, Review, Guide */}
      <div className="flex items-center gap-1 rounded-lg border border-[var(--panel-divider)]/50 bg-[var(--surface-card)]/70 p-0.5" role="group" aria-label="Assistant mode">
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
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                isActive
                  ? "bg-[var(--surface-card)] text-[var(--ai-accent-ink,#facc15)] shadow-sm font-bold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Model selector dropdown */}
      <div className="relative flex items-center" title={selectedModel.description}>
        <select
          id="ai-model"
          aria-label="AI Model"
          value={model}
          disabled={disabled}
          onChange={event => {
            if (isAiModelId(event.target.value)) onModel(event.target.value);
          }}
          className="h-6.5 cursor-pointer appearance-none rounded-lg border border-[var(--panel-divider)]/50 bg-[var(--surface-card)]/70 pl-2 pr-5 text-[11px] font-medium text-[var(--text-strong)] hover:border-amber-400/50 focus:outline-none transition-colors"
        >
          {AI_MODELS.map(option => (
            <option key={option.id} value={option.id}>
              {option.label.replace("Gemini ", "")} ({option.tier})
            </option>
          ))}
        </select>
        <LuChevronDown className="pointer-events-none absolute right-1.5 size-3 text-[var(--text-muted)]" />
      </div>
    </div>
  );
}
