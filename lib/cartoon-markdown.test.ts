import { describe, it, expect } from "vitest";
import { generateCartoonMarkdown, type CartoonPanel } from "./cartoon-markdown";

describe("generateCartoonMarkdown", () => {
  it("generates markdown for a single panel", () => {
    const panels: CartoonPanel[] = [
      { cid: "Qm123", url: "https://ipfs.filebase.io/ipfs/Qm123", alt: "hero shot", label: "" },
    ];
    const md = generateCartoonMarkdown(panels);
    expect(md).toBe("![hero shot](https://ipfs.filebase.io/ipfs/Qm123)");
  });

  it("generates markdown for multiple panels with separators", () => {
    const panels: CartoonPanel[] = [
      { cid: "Qm1", url: "https://ipfs.filebase.io/ipfs/Qm1", alt: "panel 1", label: "" },
      { cid: "Qm2", url: "https://ipfs.filebase.io/ipfs/Qm2", alt: "panel 2", label: "" },
    ];
    const md = generateCartoonMarkdown(panels);
    expect(md).toContain("---");
    expect(md.split("---")).toHaveLength(2);
  });

  it("includes scene labels as bold text before image", () => {
    const panels: CartoonPanel[] = [
      { cid: "Qm1", url: "https://ipfs.filebase.io/ipfs/Qm1", alt: "scene", label: "Opening" },
    ];
    const md = generateCartoonMarkdown(panels);
    expect(md).toContain("**Opening**");
    expect(md.indexOf("**Opening**")).toBeLessThan(md.indexOf("!["));
  });

  it("uses default alt text when empty", () => {
    const panels: CartoonPanel[] = [
      { cid: "Qm1", url: "https://ipfs.filebase.io/ipfs/Qm1", alt: "", label: "" },
    ];
    const md = generateCartoonMarkdown(panels);
    expect(md).toBe("![Panel 1](https://ipfs.filebase.io/ipfs/Qm1)");
  });

  it("preserves panel ordering", () => {
    const panels: CartoonPanel[] = [
      { cid: "Qm1", url: "https://ipfs.filebase.io/ipfs/Qm1", alt: "first", label: "" },
      { cid: "Qm2", url: "https://ipfs.filebase.io/ipfs/Qm2", alt: "second", label: "" },
      { cid: "Qm3", url: "https://ipfs.filebase.io/ipfs/Qm3", alt: "third", label: "" },
    ];
    const md = generateCartoonMarkdown(panels);
    const firstIdx = md.indexOf("first");
    const secondIdx = md.indexOf("second");
    const thirdIdx = md.indexOf("third");
    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
  });

  it("stays within 10K character budget for 20 panels", () => {
    const panels: CartoonPanel[] = Array.from({ length: 20 }, (_, i) => ({
      cid: `QmFakeCid${i.toString().padStart(40, "0")}`,
      url: `https://ipfs.filebase.io/ipfs/QmFakeCid${i.toString().padStart(40, "0")}`,
      alt: `Panel ${i + 1}`,
      label: "",
    }));
    const md = generateCartoonMarkdown(panels);
    expect(md.length).toBeLessThan(10000);
  });
});
