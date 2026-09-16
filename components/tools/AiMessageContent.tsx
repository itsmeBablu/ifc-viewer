import { useState, type ReactNode } from "react";
import { LuCheck, LuCopy } from "react-icons/lu";

function InlineCodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="ai-code-block my-2 rounded-xl overflow-hidden border border-[var(--panel-divider,rgba(255,255,255,0.1))] bg-black/40 text-xs shadow-inner">
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/30 border-b border-white/5 text-[11px] text-[var(--text-muted,#a1a1aa)] font-mono">
        <span className="uppercase tracking-wider font-semibold text-[10px] opacity-80">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors px-1.5 py-0.5 rounded hover:bg-white/10"
          title="Copy code"
        >
          {copied ? (
            <>
              <LuCheck className="size-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <LuCopy className="size-3" />
              <span className="text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto font-mono text-[12px] leading-relaxed text-zinc-200 selection:bg-amber-400/30">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function inline(text: string): ReactNode[] {
  // Matches: **bold**, *italic*, _italic_, `code`, [label](url), ~~strike~~
  const tokenRegex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, i) => {
    if (!part) return null;
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={i} className="font-bold text-[var(--text-strong)]">{part.slice(2, -2)}</strong>;
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={i} className="italic opacity-95">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="font-mono text-[0.88em] px-1.5 py-0.5 rounded-md bg-black/15 dark:bg-white/10 text-amber-500 dark:text-amber-300 border border-black/5 dark:border-white/5"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("~~") && part.endsWith("~~")) {
      return <del key={i} className="opacity-70 line-through">{part.slice(2, -2)}</del>;
    }
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      return (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-500 dark:text-amber-400 underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          {label}
        </a>
      );
    }
    return part;
  });
}

/** Comprehensive Markdown parser for AI messages with full rendering of complete text */
export default function AiMessageContent({ text }: { text: string }) {
  if (!text || !text.trim()) {
    return <div className="ai-message-content" />;
  }

  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code blocks (```language ... ```)
    if (line.trim().startsWith("```")) {
      const match = line.trim().match(/^```([a-zA-Z0-9_-]*)/);
      const language = match ? match[1] : "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      blocks.push(
        <InlineCodeBlock key={`code-${i}`} code={codeLines.join("\n")} language={language} />
      );
      continue;
    }

    // 2. Empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // 3. Headings (# H1, ## H2, ### H3, #### H4)
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const headingClass =
        level === 1
          ? "text-[15px] font-bold mt-3 mb-1 text-[var(--text-strong)]"
          : level === 2
          ? "text-[14px] font-bold mt-2.5 mb-1 text-[var(--text-strong)]"
          : "text-[13px] font-semibold mt-2 mb-0.5 text-[var(--text-strong)]";

      blocks.push(
        <div key={`h-${i}`} className={headingClass}>
          {inline(content)}
        </div>
      );
      i++;
      continue;
    }

    // 4. Blockquotes (> quote)
    if (line.trim().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-2 border-[var(--ai-accent,#facc15)] pl-3 my-2 text-xs italic text-[var(--text-muted)] bg-black/5 dark:bg-white/5 py-1 pr-2 rounded-r"
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx}>{inline(ql)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // 5. Lists (unordered - / * or ordered 1. / 1) )
    const unordered = /^[-*•]\s+/.test(line.trim());
    const ordered = /^\d+[.)]\s+/.test(line.trim());
    if (unordered || ordered) {
      const start = i;
      const isUnordered = unordered;
      const items: ReactNode[] = [];
      const pattern = isUnordered ? /^[-*•]\s+/ : /^\d+[.)]\s+/;

      while (i < lines.length && (pattern.test(lines[i].trim()) || (lines[i].startsWith("   ") && items.length > 0))) {
        const rawLine = lines[i].trim();
        if (pattern.test(rawLine)) {
          items.push(
            <li key={`li-${i}`} className="leading-snug">
              {inline(rawLine.replace(pattern, ""))}
            </li>
          );
        } else if (items.length > 0) {
          // Continuation line of previous list item
          items.push(
            <div key={`li-sub-${i}`} className="pl-2 pt-0.5 opacity-90 text-[12.5px]">
              {inline(rawLine)}
            </div>
          );
        }
        i++;
      }

      blocks.push(
        isUnordered ? (
          <ul key={`ul-${start}`} className="my-1.5 pl-4 list-disc space-y-1 text-[13px]">
            {items}
          </ul>
        ) : (
          <ol key={`ol-${start}`} className="my-1.5 pl-4 list-decimal space-y-1 text-[13px]">
            {items}
          </ol>
        )
      );
      continue;
    }

    // 6. Regular paragraphs: group consecutive non-empty lines smoothly
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith(">") &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !/^\d+[.)]\s+/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }

    if (paragraphLines.length > 0) {
      blocks.push(
        <p key={`p-${i}`} className="my-1.5 text-[13px] leading-relaxed whitespace-pre-wrap">
          {inline(paragraphLines.join("\n"))}
        </p>
      );
    }
  }

  return <div className="ai-message-content space-y-1">{blocks}</div>;
}
