"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    "p",
    "strong",
    "em",
    "del",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "hr",
    "ul",
    "ol",
    "li",
    "br",
    "code",
    "pre",
    "a",
    "img",
  ],
  attributes: {
    a: ["href", "title"],
    img: ["src", "alt", "title"],
  },
};

export function StoryContent({ content }: { content: string }) {
  return (
    <div className="story-markdown font-prose text-foreground leading-7">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function WritePreviewToggle({
  activeTab,
  onTabChange,
}: {
  activeTab: "write" | "preview";
  onTabChange: (tab: "write" | "preview") => void;
}) {
  return (
    <div className="mb-2 flex gap-1 border-b border-border pb-1">
      <button
        type="button"
        onClick={() => onTabChange("write")}
        className={`rounded-t px-3 py-1 text-xs font-medium transition-colors ${
          activeTab === "write"
            ? "bg-accent/15 text-accent"
            : "text-muted hover:text-foreground"
        }`}
      >
        Write
      </button>
      <button
        type="button"
        onClick={() => onTabChange("preview")}
        className={`rounded-t px-3 py-1 text-xs font-medium transition-colors ${
          activeTab === "preview"
            ? "bg-accent/15 text-accent"
            : "text-muted hover:text-foreground"
        }`}
      >
        Preview
      </button>
    </div>
  );
}

export function ContentPreview({ content }: { content: string }) {
  if (!content.trim()) {
    return (
      <div className="text-muted min-h-[336px] text-sm italic p-6">
        Nothing to preview
      </div>
    );
  }
  return (
    <div className="min-h-[336px] p-6">
      <StoryContent content={content} />
    </div>
  );
}
