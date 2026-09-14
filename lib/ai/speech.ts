export type SpeechResultEvent = { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> };
export type SpeechRecognizer = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
export type SpeechScope = { SpeechRecognition?: new () => SpeechRecognizer; webkitSpeechRecognition?: new () => SpeechRecognizer };
export const speechConstructor = (scope: SpeechScope) => scope.SpeechRecognition ?? scope.webkitSpeechRecognition;

export function createDictation(scope: SpeechScope, language: string, onText: (text: string) => void, onError: (message: string) => void, onEnd: () => void) {
  const Constructor = speechConstructor(scope);
  if (!Constructor) throw new Error("Voice input is unavailable in this browser. Type your command instead.");
  const recognition = new Constructor();
  recognition.lang = language;
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = event => {
    const transcripts: string[] = [];
    for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) transcripts.push(event.results[i][0].transcript);
    const text = transcripts.join(" ").trim();
    if (text) onText(text);
  };
  recognition.onerror = event => {
    const messages: Record<string, string> = {
      "not-allowed": "Microphone permission was denied. Allow it in browser settings or type your command.",
      "service-not-allowed": "Speech recognition is disabled by this browser. Type your command instead.",
      "audio-capture": "No microphone is available. Type your command instead.",
      "no-speech": "No speech was detected. Try again or type your command.",
      network: "Speech recognition could not connect. Try again or type your command.",
      "language-not-supported": "This dictation language is unavailable. Choose another language or type your command.",
    };
    if (event.error !== "aborted") onError(messages[event.error] ?? "Voice input failed. You can still type your command.");
    onEnd();
  };
  recognition.onend = onEnd;
  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    dispose: () => { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.abort(); },
  };
}
