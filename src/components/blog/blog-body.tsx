import { Fragment, useMemo, type ReactNode } from "react";

import { parseBlocks, type BlockNode, type InlineNode } from "@/lib/blog-content";
import type { BlogPost, BlogSection } from "@/lib/blog";

function renderInline(nodes: InlineNode[]): ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return <Fragment key={index}>{node.value}</Fragment>;
      case "strong":
        return (
          <strong key={index} className="font-semibold text-foreground">
            {renderInline(node.children)}
          </strong>
        );
      case "em":
        return <em key={index}>{renderInline(node.children)}</em>;
      case "code":
        return (
          <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
            {node.value}
          </code>
        );
      case "link": {
        const external = /^https?:\/\//i.test(node.href);
        return (
          <a
            key={index}
            href={node.href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="font-medium text-primary underline underline-offset-4 hover:no-underline"
          >
            {renderInline(node.children)}
          </a>
        );
      }
    }
  });
}

function renderBlock(block: BlockNode, index: number): ReactNode {
  switch (block.type) {
    case "heading": {
      const common = "scroll-mt-24 font-semibold tracking-tight text-foreground";
      if (block.level === 2) {
        return (
          <h2 key={index} className={`${common} mt-10 text-2xl`}>
            {renderInline(block.children)}
          </h2>
        );
      }
      if (block.level === 3) {
        return (
          <h3 key={index} className={`${common} mt-8 text-xl`}>
            {renderInline(block.children)}
          </h3>
        );
      }
      return (
        <h4 key={index} className={`${common} mt-6 text-lg`}>
          {renderInline(block.children)}
        </h4>
      );
    }
    case "paragraph":
      return (
        <p key={index} className="mt-4 text-base leading-8 text-muted-foreground">
          {renderInline(block.children)}
        </p>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          key={index}
          className={`mt-4 space-y-2 pl-6 text-muted-foreground ${block.ordered ? "list-decimal" : "list-disc"}`}
        >
          {block.items.map((item, i) => (
            <li key={i} className="leading-7">
              {renderInline(item)}
            </li>
          ))}
        </Tag>
      );
    }
    case "quote":
      return (
        <blockquote key={index} className="mt-6 border-l-4 border-primary/40 pl-4 italic text-muted-foreground">
          {renderInline(block.children)}
        </blockquote>
      );
    case "code":
      return (
        <pre key={index} className="mt-6 overflow-x-auto rounded-lg bg-muted p-4 text-sm text-foreground">
          <code>{block.value}</code>
        </pre>
      );
    case "rule":
      return <hr key={index} className="my-10 border-border" />;
    case "image":
      return (
        <figure key={index} className="mt-6">
          <img
            src={block.src}
            alt={block.alt}
            loading="lazy"
            decoding="async"
            className="w-full rounded-xl border border-border"
          />
          {block.alt ? (
            <figcaption className="mt-2 text-center text-sm text-muted-foreground">{block.alt}</figcaption>
          ) : null}
        </figure>
      );
  }
}

/** Article written in the admin editor (Markdown body). */
export function MarkdownBody({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => parseBlocks(markdown), [markdown]);
  return <div className="[&>*:first-child]:mt-0">{blocks.map(renderBlock)}</div>;
}

/** Built-in articles, which are stored as structured sections. */
function SectionsBody({ sections }: { sections: BlogSection[] }) {
  return (
    <div>
      {sections.map((section, sectionIndex) => (
        <section key={sectionIndex} className="mb-10">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{section.heading}</h2>
          {section.paragraphs.map((paragraph, i) => (
            <p key={i} className="mt-4 text-base leading-8 text-muted-foreground">
              {paragraph}
            </p>
          ))}
          {section.bullets ? (
            <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
              {section.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}

/** The full text of any article, built-in or created in the admin editor. */
export function BlogBody({ post }: { post: Pick<BlogPost, "body" | "sections"> }) {
  if (post.body !== undefined) return <MarkdownBody markdown={post.body} />;
  return <SectionsBody sections={post.sections} />;
}
