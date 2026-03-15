import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg)] px-4 py-6 mt-16">
      <div className="mx-auto max-w-5xl flex flex-col gap-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-muted">
            <Link href="/discover" className="hover:text-foreground transition-colors">
              discover
            </Link>
            <Link href="/create" className="hover:text-foreground transition-colors">
              create
            </Link>
            <a
              href="https://github.com/realproject7/plotlink"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              github
            </a>
          </div>
          <span className="text-muted">
            built on <span className="text-accent-dim">Base</span>
          </span>
        </div>
        <div className="text-muted/60 text-[10px]">
          <span className="text-accent-dim">$</span> PlotLink &copy; {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
}
