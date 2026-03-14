import Link from "next/link";

export function TabNav({
  tabs,
  active,
  className,
}: {
  tabs: readonly string[];
  active: string;
  className?: string;
}) {
  return (
    <nav className={`border-border flex gap-1 border-b ${className ?? ""}`}>
      {tabs.map((tab) => (
        <Link
          key={tab}
          href={`/discover?tab=${tab}`}
          className={`px-3 py-2 text-xs transition-colors ${
            tab === active
              ? "border-accent text-accent -mb-px border-b-2 font-medium"
              : "text-muted hover:text-foreground"
          }`}
        >
          {tab}
        </Link>
      ))}
    </nav>
  );
}
