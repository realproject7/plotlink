import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StoryCard } from "../StoryCard";
import type { Storyline } from "../../../lib/supabase";

afterEach(cleanup);

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("../WriterIdentityClient", () => ({
  WriterIdentityClient: ({ address }: { address: string }) => (
    <span data-testid="writer">{address.slice(0, 8)}</span>
  ),
}));

vi.mock("../AgentBadge", () => ({
  AgentBadge: () => <span data-testid="agent-badge">AI</span>,
}));

vi.mock("../StoryCardStats", () => ({
  StoryCardTVL: () => <span data-testid="tvl">TVL</span>,
  StoryCardPrice: () => <span data-testid="price">Price</span>,
}));

function makeStoryline(overrides: Partial<Storyline> = {}): Storyline {
  return {
    id: 1,
    storyline_id: 42,
    title: "Test Story Title",
    writer_address: "0x1234567890123456789012345678901234567890",
    writer_type: 0,
    plot_count: 5,
    token_address: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
    genre: "Fiction",
    language: "English",
    sunset: false,
    last_plot_time: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Storyline;
}

describe("StoryCard", () => {
  it("renders title correctly", () => {
    render(<StoryCard storyline={makeStoryline()} />);
    // Title appears in the cover h3
    const titles = screen.getAllByText("Test Story Title");
    expect(titles.length).toBeGreaterThan(0);
  });

  it("renders genre badge", () => {
    render(<StoryCard storyline={makeStoryline()} />);
    const genres = screen.getAllByText("Fiction");
    expect(genres.length).toBeGreaterThan(0);
  });

  it("renders author via WriterIdentityClient", () => {
    render(<StoryCard storyline={makeStoryline()} />);
    const writers = screen.getAllByTestId("writer");
    expect(writers.length).toBeGreaterThan(0);
  });

  it("links to correct story page", () => {
    render(<StoryCard storyline={makeStoryline({ storyline_id: 42 })} />);
    const link = screen.getAllByText("Test Story Title")[0].closest("a");
    expect(link).toHaveAttribute("href", "/story/42");
  });

  it("wraps card in a link with group class", () => {
    render(<StoryCard storyline={makeStoryline()} />);
    const link = screen.getAllByText("Test Story Title")[0].closest("a");
    expect(link).toHaveClass("group");
  });

  it("shows TVL when token_address is present", () => {
    render(<StoryCard storyline={makeStoryline()} />);
    expect(screen.getByTestId("tvl")).toBeInTheDocument();
  });

  it("displays genre prop when provided", () => {
    render(<StoryCard storyline={makeStoryline({ genre: "Fantasy" })} genre="Sci-Fi" />);
    expect(screen.getAllByText("Sci-Fi").length).toBeGreaterThan(0);
  });

  it("shows AI Writer badge for AI writers", () => {
    render(<StoryCard storyline={makeStoryline({ writer_type: 1 })} />);
    expect(screen.getByText("AI Writer")).toBeInTheDocument();
  });
});
