import { describe, expect, it } from "vitest";

import {
  estimateReadTime,
  makeExcerpt,
  parseBlocks,
  parseInline,
  safeUrl,
} from "@/lib/blog-content";

const text = (value: string) => ({ type: "text", value });

describe("safeUrl", () => {
  it("allows http(s), mailto, anchors and site-relative paths", () => {
    expect(safeUrl("https://trademall.co.ke/pricing")).toBe("https://trademall.co.ke/pricing");
    expect(safeUrl("http://example.com")).toBe("http://example.com");
    expect(safeUrl("mailto:hello@trademall.co.ke")).toBe("mailto:hello@trademall.co.ke");
    expect(safeUrl("#section")).toBe("#section");
    expect(safeUrl("/auth")).toBe("/auth");
  });

  it("rejects script-capable and ambiguous URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(safeUrl("vbscript:x")).toBeNull();
    expect(safeUrl("//evil.com")).toBeNull();
    expect(safeUrl("/\\evil.com")).toBeNull();
    expect(safeUrl("https://exa mple.com")).toBeNull();
    expect(safeUrl("java\nscript:alert(1)")).toBeNull();
    expect(safeUrl("")).toBeNull();
  });
});

describe("parseInline", () => {
  it("handles bold, italic, code and combinations", () => {
    expect(parseInline("a **b** c")).toEqual([
      text("a "),
      { type: "strong", children: [text("b")] },
      text(" c"),
    ]);
    expect(parseInline("*x* and _y_")).toEqual([
      { type: "em", children: [text("x")] },
      text(" and "),
      { type: "em", children: [text("y")] },
    ]);
    expect(parseInline("use `npm i`")).toEqual([text("use "), { type: "code", value: "npm i" }]);
    expect(parseInline("**bold *and italic***")[0]).toMatchObject({ type: "strong" });
  });

  it("does not italicise snake_case or stray asterisks", () => {
    expect(parseInline("my_variable_name")).toEqual([text("my_variable_name")]);
    expect(parseInline("2 * 3 = 6")).toEqual([text("2 * 3 = 6")]);
  });

  it("turns safe links into links and keeps only the text of unsafe ones", () => {
    expect(parseInline("[Join](https://trademall.co.ke/auth)")).toEqual([
      { type: "link", href: "https://trademall.co.ke/auth", children: [text("Join")] },
    ]);
    expect(parseInline("[click](javascript:alert(1))")).toEqual([text("click")]);
  });

  it("supports backslash escapes", () => {
    expect(parseInline("\\*not italic\\*")).toEqual([text("*not italic*")]);
  });

  it("leaves raw HTML as plain text (React escapes it on render)", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([text("<script>alert(1)</script>")]);
    expect(parseInline('<img src=x onerror="alert(1)">')).toEqual([
      text('<img src=x onerror="alert(1)">'),
    ]);
  });
});

describe("parseBlocks", () => {
  it("splits paragraphs on blank lines and joins soft-wrapped lines", () => {
    const blocks = parseBlocks("First line\nsecond line\n\nNext paragraph");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: "paragraph", children: [text("First line second line")] });
  });

  it("parses headings (# renders as h2 because the page title is the h1)", () => {
    expect(parseBlocks("# A\n## B\n### C\n#### D").map((b) => b.type === "heading" && b.level)).toEqual([2, 2, 3, 4]);
    expect(parseBlocks("## Trailing hashes ##")[0]).toMatchObject({ type: "heading", level: 2, children: [text("Trailing hashes")] });
  });

  it("parses bullet and numbered lists separately", () => {
    const blocks = parseBlocks("- one\n- two\n\n1. first\n2. second");
    expect(blocks).toMatchObject([
      { type: "list", ordered: false, items: [[text("one")], [text("two")]] },
      { type: "list", ordered: true, items: [[text("first")], [text("second")]] },
    ]);
    expect(parseBlocks("* star item")[0]).toMatchObject({ type: "list", ordered: false });
  });

  it("keeps **bold** at the start of a line as a paragraph, not a list", () => {
    expect(parseBlocks("**Note:** read this")[0]?.type).toBe("paragraph");
  });

  it("parses quotes, rules and fenced code (code is not formatted)", () => {
    expect(parseBlocks("> wise words")[0]).toMatchObject({ type: "quote" });
    expect(parseBlocks("---")[0]).toEqual({ type: "rule" });
    expect(parseBlocks("```\n**not bold**\n# not heading\n```")[0]).toEqual({
      type: "code",
      value: "**not bold**\n# not heading",
    });
  });

  it("accepts safe images and silently drops unsafe ones", () => {
    expect(parseBlocks("![Dashboard](https://cdn.example.com/a.png)")[0]).toEqual({
      type: "image",
      src: "https://cdn.example.com/a.png",
      alt: "Dashboard",
    });
    expect(parseBlocks("![x](javascript:alert(1))")).toEqual([]);
  });

  it("returns nothing for empty input and tolerates Windows line endings", () => {
    expect(parseBlocks("")).toEqual([]);
    expect(parseBlocks("a\r\n\r\nb")).toHaveLength(2);
  });
});

describe("makeExcerpt / estimateReadTime", () => {
  it("builds a plain-text excerpt from the first paragraph", () => {
    expect(makeExcerpt("## Title\n\nHello **world**, welcome to [TradeMall](https://trademall.co.ke).")).toBe(
      "Hello world, welcome to TradeMall.",
    );
  });

  it("truncates long excerpts at a word boundary with an ellipsis", () => {
    const out = makeExcerpt(`${"word ".repeat(100)}`, 60);
    expect(out.length).toBeLessThanOrEqual(61);
    expect(out.endsWith("…")).toBe(true);
  });

  it("estimates read time at ~200 words per minute, minimum 1", () => {
    expect(estimateReadTime("short")).toBe("1 min read");
    expect(estimateReadTime("word ".repeat(450))).toBe("3 min read");
  });
});
