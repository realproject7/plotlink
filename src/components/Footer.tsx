import Link from "next/link";
import { STORY_FACTORY, EXPLORER_URL } from "../../lib/contracts/constants";

const CONTRACT_URL = `${EXPLORER_URL}/address/${STORY_FACTORY}`;
const GITHUB_URL = "https://github.com/realproject7/plotlink-contracts";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg)] px-4 py-6 mt-16">
      <div className="mx-auto max-w-5xl flex flex-col gap-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-muted">
            <a
              href={CONTRACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
              title={STORY_FACTORY}
            >
              contract: {STORY_FACTORY.slice(0, 6)}...{STORY_FACTORY.slice(-4)}
            </a>
            <Link href="/token" className="hover:text-foreground transition-colors">
              $PLOT
            </Link>
            <a
              href={GITHUB_URL}
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
        <div className="text-muted text-xs">
          PlotLink &copy; {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
}
