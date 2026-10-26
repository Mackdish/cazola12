/**
 * Tiny, dependency-free, XSS-safe formatter for blog article bodies.
 *
 * Admins write simple Markdown in the blog editor; this turns it into a typed
 * tree that React renders as real elements. Nothing here ever produces raw HTML
 * (React escapes all text), and links/images are limited to safe URL schemes, so
 * pasted HTML or `javascript:` links can't run anything on the public blog.
 *
 * Supported:
 *   # / ## / ### / ####  headings (the page title is the h1, so # renders as h2)
 *   blank-line separated paragraphs (single line breaks join into one paragraph)
 *   - or * bullet lists, 1. numbered lists, > quotes, --- rules, ``` code blocks
 *   ![alt](https://image-url) on its own line
 *   **bold**, *italic* / _italic_, `code`, [text](url)
 */

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: InlineNode[] };

export type BlockNode =
  | { type: "heading"; level: 2 | 3 | 4; children: InlineNode[] }
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "quote"; children: InlineNode[] }
  | { type: "code"; value: string }
  | { type: "rule" }
  | { type: "image"; src: string; alt: string };

/** Returns the URL only if it is safe to put in an href/src, otherwise null. */
export function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s]/.test(url)) return null;
  if (/^https?:\/\//i.test(url)) {
    try {
      new URL(url);
      return url;
    } catch {
      return null;
    }
  }
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(url)) return url;
  if (url.startsWith("#")) return url;
  // site-relative only: reject protocol-relative "//host" and "/\host"
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) return url;
  return null;
}

/** Index of the ")" that closes a "(" whose content starts at `from` (handles nested parens). */
function findClosingParen(src: string, from: number): number {
  let depth = 1;
  for (let j = from; j < src.length; j++) {
    if (src[j] === "\\") {
      j++;
      continue;
    }
    if (src[j] === "(") depth++;
    else if (src[j] === ")" && --depth === 0) return j;
  }
  return -1;
}

const ESCAPABLE = /[\\`*_[\]()#>!-]/;
const isWordChar = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);

function findItalicEnd(src: string, marker: "*" | "_", from: number): number {
  for (let j = from; j < src.length; j++) {
    if (src[j] === "\\") {
      j++;
      continue;
    }
    if (src[j] !== marker) continue;
    if (src[j + 1] === marker) {
      j++; // skip a "**" pair inside the italic span
      continue;
    }
    if (src[j - 1] === " ") continue; // closing marker can't follow a space
    if (marker === "_" && isWordChar(src[j + 1])) continue;
    return j;
  }
  return -1;
}

export function parseInline(src: string): InlineNode[] {
  const out: InlineNode[] = [];
  let buf = "";
  const flush = () => {
    if (buf) {
      out.push({ type: "text", value: buf });
      buf = "";
    }
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;

    if (ch === "\\" && i + 1 < src.length && ESCAPABLE.test(src[i + 1]!)) {
      buf += src[i + 1];
      i += 2;
      continue;
    }

    if (ch === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ type: "code", value: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (ch === "*" && src[i + 1] === "*") {
      const end = src.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ type: "strong", children: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if ((ch === "*" || ch === "_") && src[i + 1] !== ch && src[i + 1] !== " " && src[i + 1] !== undefined) {
      const opensOk = ch === "*" || !isWordChar(src[i - 1]); // snake_case stays plain text
      if (opensOk) {
        const end = findItalicEnd(src, ch, i + 1);
        if (end > i + 1) {
          flush();
          out.push({ type: "em", children: parseInline(src.slice(i + 1, end)) });
          i = end + 1;
          continue;
        }
      }
    }

    if (ch === "[") {
      const close = src.indexOf("]", i + 1);
      if (close > i && src[close + 1] === "(") {
        const paren = findClosingParen(src, close + 2);
        if (paren > close + 1) {
          const label = src.slice(i + 1, close);
          const target = src.slice(close + 2, paren).trim().split(/\s+/)[0] ?? "";
          const href = safeUrl(target);
          flush();
          const children = parseInline(label);
          if (href) out.push({ type: "link", href, children });
          else out.push(...children); // unsafe/invalid URL: keep the text, drop the link
          i = paren + 1;
          continue;
        }
      }
    }

    buf += ch;
    i++;
  }
  flush();
  return out;
}

/** `![alt](url)` occupying the whole line. src is null when the URL isn't safe. */
function parseImageLine(line: string): { alt: string; src: string | null } | null {
  if (!line.startsWith("![")) return null;
  const close = line.indexOf("](");
  if (close < 2) return null;
  const end = findClosingParen(line, close + 2);
  if (end !== line.length - 1) return null;
  const target = line.slice(close + 2, end).trim().split(/\s+/)[0] ?? "";
  return { alt: line.slice(2, close).trim(), src: safeUrl(target) };
}

export function parseBlocks(markdown: string): BlockNode[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: BlockNode[] = [];

  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];

  const flushPara = () => {
    if (para.length) blocks.push({ type: "paragraph", children: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    }
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) blocks.push({ type: "quote", children: parseInline(quote.join(" ")) });
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]!.trim();

    if (line.startsWith("```")) {
      flushAll();
      const code: string[] = [];
      n++;
      while (n < lines.length && !lines[n]!.trim().startsWith("```")) {
        code.push(lines[n]!);
        n++;
      }
      blocks.push({ type: "code", value: code.join("\n") });
      continue;
    }

    if (!line) {
      flushAll();
      continue;
    }

    const heading = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flushAll();
      const hashes = heading[1]!.length;
      blocks.push({
        type: "heading",
        level: hashes <= 2 ? 2 : hashes === 3 ? 3 : 4,
        children: parseInline(heading[2]!),
      });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushAll();
      blocks.push({ type: "rule" });
      continue;
    }

    const image = parseImageLine(line);
    if (image) {
      flushAll();
      if (image.src) blocks.push({ type: "image", src: image.src, alt: image.alt });
      continue; // an unsafe image URL is dropped rather than shown as stray text
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      flushQuote();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]!);
      continue;
    }

    if (line.startsWith(">")) {
      flushPara();
      flushList();
      quote.push(line.replace(/^>\s?/, ""));
      continue;
    }

    flushList();
    flushQuote();
    para.push(line);
  }
  flushAll();
  return blocks;
}

function flattenInline(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text" || node.type === "code") return node.value;
      return flattenInline(node.children);
    })
    .join("");
}

/** Plain-text excerpt from the first paragraph, for listings and meta descriptions. */
export function makeExcerpt(markdown: string, max = 180): string {
  const first = parseBlocks(markdown).find((b) => b.type === "paragraph");
  const text = first && first.type === "paragraph" ? flattenInline(first.children).trim() : "";
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)).trimEnd()}…`;
}

/** "N min read" at ~200 words per minute (never less than 1). */
export function estimateReadTime(markdown: string): string {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}
