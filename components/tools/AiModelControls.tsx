import { AI_MODELS, AI_MODES, isAiModelId, modelDetails, type AiModelId, type AiMode } from "@/lib/ai/models";

type Props = { model: AiModelId; mode: AiMode; disabled: boolean; onModel: (model: AiModelId) => void; onMode: (mode: AiMode) => void };

export default function AiModelControls({ model, mode, disabled, onModel, onMode }: Props) {
  const selected = modelDetails(model);
  return <div className="ai-model-controls">
    <div className="ai-model-row">
      <label htmlFor="ai-model">Model</label>
      <select id="ai-model" aria-describedby="ai-model-description" value={model} disabled={disabled} onChange={event => { if (isAiModelId(event.target.value)) onModel(event.target.value); }}>
        {AI_MODELS.map(option => <option key={option.id} value={option.id}>{option.label} · {option.tier}</option>)}
      </select>
    </div>
    <p id="ai-model-description" className="ai-model-description">{selected.description}</p>
    <div className="ai-mode-switch" role="group" aria-label="Assistant mode">
      {AI_MODES.map(option => <button type="button" key={option.id} disabled={disabled} aria-pressed={mode === option.id} onClick={() => onMode(option.id)}>{option.label}</button>)}
    </div>
    <p className="ai-model-description">{AI_MODES.find(option => option.id === mode)!.description}</p>
    <details className="ai-access-note"><summary>Google AI Pro & model access</summary><p>Google sign-in identifies you. This assistant uses the site’s Gemini API key and quota. Your Google AI Pro subscription does not select a model here. Flash and Pro can cost more and require access on the site’s API project.</p></details>
  </div>;
}
