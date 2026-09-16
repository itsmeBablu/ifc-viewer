import { AI_MODELS, AI_MODES, isAiModelId, modelDetails, type AiModelId, type AiMode } from "@/lib/ai/models";
import { useLayoutDrawingStore } from "@/store/useLayoutDrawingStore";

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

  return (
    <div className="ai-composer-controls flex items-center justify-between gap-1.5 border-b border-white/10 bg-[#0c0e14]/70 px-2.5 py-1.5">
      {/* Mode pills: Build, Review, Guide in v-Yellow/v-Blue gray black palette */}
      <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#12141d]/90 p-0.5" role="group" aria-label="Assistant mode">
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
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Model selector dropdown styled with popup vYellow / vBlue */}
      <div className="relative flex items-center" title={selectedModel.description}>
        <select
          id="ai-model"
          aria-label="AI Model"
          value={model}
          disabled={disabled}
          onChange={event => {
            if (isAiModelId(event.target.value)) onModel(event.target.value);
          }}
          className={`ai-model-select h-7 cursor-pointer rounded-lg px-2.5 pr-7 text-[11px] font-bold tracking-tight outline-none transition-all ${
            mepModeActive
              ? "border border-sky-400/60 bg-[#141824] text-sky-200 hover:border-sky-300 hover:bg-[#1a2030] focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
              : "border border-amber-400/60 bg-[#1a1a24] text-amber-200 hover:border-amber-300 hover:bg-[#222230] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
          }`}
        >
          {AI_MODELS.map(option => (
            <option key={option.id} value={option.id} className="bg-[#12131a] text-zinc-100 font-semibold py-1">
              {option.label.replace("Gemini ", "")} ({option.tier})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

