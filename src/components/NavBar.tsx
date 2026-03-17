"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWallet } from "./ConnectWallet";

const NAV_LINKS = [
  { href: "/create", label: "create" },
  { href: "/dashboard/writer", label: "writer" },
  { href: "/dashboard/reader", label: "reader" },
  { href: "/chain", label: "chain" },
] as const;

export function NavBar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-1.5 transition-opacity hover:opacity-80"
        >
          <span className="text-accent text-sm font-bold tracking-tight">
            PlotLink
          </span>
          <span className="hidden text-[10px] text-muted sm:inline">
            on-chain stories
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`rounded px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "bg-accent-glow text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {active && (
                  <span className="mr-0.5 text-accent-dim">&gt;</span>
                )}
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right side: wallet + mobile toggle */}
        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <ConnectWallet />
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-muted hover:text-foreground p-1 text-sm transition-colors md:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <span aria-hidden="true">{mobileOpen ? "[x]" : "[=]"}</span>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--bg)] px-4 pb-3 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active =
                pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded px-2.5 py-2 text-xs transition-colors ${
                    active
                      ? "bg-accent-glow text-accent"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {active && (
                    <span className="text-accent-dim mr-0.5">&gt;</span>
                  )}
                  {label}
                </Link>
              );
            })}
          </div>
          <div className="mt-2 border-t border-[var(--border)] pt-2">
            <ConnectWallet />
          </div>
        </div>
      )}
    </nav>
  );
}
