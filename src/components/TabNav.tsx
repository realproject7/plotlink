import Link from "next/link";

export function TabNav({
  tabs,
  active,
  className,
  extraParams,
}: {
  tabs: readonly string[];
  active: string;
  className?: string;
  extraParams?: Record<string, string>;
}) {
  function buildHref(tab: string) {
    const params = new URLSearchParams({ tab });
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        params.set(k, v);
      }
    }
    return `/discover?${params.toString()}`;
  }

  return (
    <nav className={`border-border flex gap-1 border-b ${className ?? ""}`}>
      {tabs.map((tab) => (
        <Link
          key={tab}
          href={buildHref(tab)}
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
