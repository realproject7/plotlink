import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-[var(--bg)] px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-muted">
            <Link
              href="/"
              className="transition-colors hover:text-foreground"
            >
              stories
            </Link>
            <Link
              href="/create"
              className="transition-colors hover:text-foreground"
            >
              create
            </Link>
            <a
              href="https://github.com/realproject7/plotlink"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              github
            </a>
          </div>
          <span className="text-muted">
            built on <span className="text-accent-dim">Base</span>
          </span>
        </div>
        <div className="text-xs text-neutral-500">
          <span className="text-accent-dim">$</span> PlotLink &copy;{" "}
          {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
}
