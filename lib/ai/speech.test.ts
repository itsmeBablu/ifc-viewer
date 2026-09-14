import { describe, expect, it, vi } from "vitest";
import { createDictation, speechConstructor, type SpeechRecognizer } from "./speech";

describe("voice dictation adapter", () => {
  it("supports prefixed Safari recognition, only accepts final results, and disposes the microphone", () => {
    const instances: SpeechRecognizer[] = [];
    class FakeRecognition implements SpeechRecognizer {
      lang = ""; continuous = true; interimResults = true;
      onresult: SpeechRecognizer["onresult"] = null; onerror: SpeechRecognizer["onerror"] = null; onend: SpeechRecognizer["onend"] = null;
      start = vi.fn(); stop = vi.fn(); abort = vi.fn();
      constructor() { instances.push(this); }
    }
    const text = vi.fn(), error = vi.fn(), end = vi.fn();
    const dictation = createDictation({ webkitSpeechRecognition: FakeRecognition }, "de-DE", text, error, end);
    const instance = instances[0];
    dictation.start();
    expect(instance!.lang).toBe("de-DE");
    instance!.onresult!({ resultIndex: 1, results: [{ isFinal: true, 0: { transcript: "old" } }, { isFinal: false, 0: { transcript: "draft" } }, { isFinal: true, 0: { transcript: "Create a wall" } }] });
    expect(text).toHaveBeenCalledExactlyOnceWith("Create a wall");
    instance!.onerror!({ error: "not-allowed" });
    expect(error).toHaveBeenCalledWith(expect.stringContaining("permission"));
    expect(end).toHaveBeenCalled();
    dictation.dispose();
    expect(instance!.abort).toHaveBeenCalled();
    expect(instance!.onresult).toBeNull();
  });
  it("keeps unsupported browsers on the text fallback", () => {
    expect(speechConstructor({})).toBeUndefined();
    expect(() => createDictation({}, "en-US", vi.fn(), vi.fn(), vi.fn())).toThrow(/Type/);
  });
});
