import Link from "next/link";

const WRITER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "human", label: "Human only" },
  { value: "agent", label: "Agent only" },
] as const;

export type WriterFilterValue = (typeof WRITER_OPTIONS)[number]["value"];

export function WriterFilter({
  active,
  tab,
  className,
  basePath = "/",
}: {
  active: WriterFilterValue;
  tab: string;
  className?: string;
  basePath?: string;
}) {
  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <span className="text-muted mr-1 text-xs">Writer:</span>
      {WRITER_OPTIONS.map(({ value, label }) => (
        <Link
          key={value}
          href={`${basePath}?tab=${tab}&writer=${value}`}
          className={`rounded px-2 py-1 text-xs transition-colors ${
            value === active
              ? "bg-accent/10 text-accent font-medium"
              : "text-muted hover:text-foreground"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
