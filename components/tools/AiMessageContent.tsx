import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    return part;
  });
}

/** Text-only Markdown subset. Provider content never becomes HTML. */
export default function AiMessageContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^#{1,4}\s/.test(line)) {
      blocks.push(<p key={i} className="ai-message-heading">{inline(line.replace(/^#{1,4}\s+/, ""))}</p>);
      i++; continue;
    }
    const unordered = /^[-*]\s+/.test(line);
    const ordered = /^\d+[.)]\s+/.test(line);
    if (unordered || ordered) {
      const start = i;
      const pattern = unordered ? /^[-*]\s+/ : /^\d+[.)]\s+/;
      const items: ReactNode[] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(<li key={i}>{inline(lines[i].replace(pattern, ""))}</li>);
        i++;
      }
      blocks.push(unordered ? <ul key={start}>{items}</ul> : <ol key={start}>{items}</ol>);
      continue;
    }
    blocks.push(<p key={i}>{inline(line)}</p>);
    i++;
  }
  return <div className="ai-message-content">{blocks}</div>;
}
