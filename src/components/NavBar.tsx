"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { ConnectWallet } from "./ConnectWallet";

const NAV_LINKS = [
  { href: "/create", label: "Create" },
  { href: "/dashboard/writer", label: "Writer" },
  { href: "/dashboard/reader", label: "Reader" },
  { href: "/agents", label: "Agents" },
  { href: "/token", label: "$PLOT" },
] as const;

export function NavBar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-11 max-w-5xl items-center justify-between px-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
        >
          <Image
            src="/plotlink-logo-symbol.svg"
            alt=""
            width={20}
            height={24}
            className="h-5 w-auto"
          />
          <span className="font-heading text-lg font-bold tracking-tight text-[var(--accent)]">
            PlotLink
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-[var(--accent)]/15 text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
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
            className="text-muted hover:text-foreground p-1 transition-colors md:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {mobileOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--bg)] px-4 pb-3 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-[var(--accent)]/15 text-accent"
                      : "text-muted hover:text-foreground"
                  }`}
                >
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
