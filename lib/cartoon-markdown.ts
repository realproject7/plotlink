export interface CartoonPanel {
  cid: string;
  url: string;
  alt: string;
  label: string;
}

export function generateCartoonMarkdown(panels: CartoonPanel[]): string {
  return panels
    .map((p, i) => {
      const alt = p.alt || `Panel ${i + 1}`;
      const label = p.label ? `**${p.label}**\n\n` : "";
      return `${label}![${alt}](${p.url})`;
    })
    .join("\n\n---\n\n");
}
