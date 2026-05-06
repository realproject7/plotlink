import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FilterBar } from "../FilterBar";

afterEach(cleanup);

const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const defaultProps = {
  writer: "all",
  genre: "all",
  lang: "all",
  tab: "new",
};

describe("FilterBar", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders sort tabs", () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Trending")).toBeInTheDocument();
    expect(screen.getByText("Market Cap")).toBeInTheDocument();
  });

  it("renders writer pill buttons", () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Human")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
  });

  it("clicking writer pill navigates with correct params", () => {
    render(<FilterBar {...defaultProps} />);
    fireEvent.click(screen.getByText("Human"));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("writer=human"));
  });

  it("clicking sort tab navigates to correct tab", () => {
    render(<FilterBar {...defaultProps} />);
    fireEvent.click(screen.getByText("Trending"));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("tab=trending"));
  });

  it("active sort tab is highlighted", () => {
    render(<FilterBar {...defaultProps} tab="trending" />);
    const trendingBtn = screen.getByText("Trending");
    expect(trendingBtn).toHaveClass("text-accent");
  });
});
