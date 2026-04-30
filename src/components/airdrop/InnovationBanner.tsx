const COLUMNS = [
  {
    title: "TYPICAL AIRDROP",
    rows: ["Fixed amount", "Dumps on day 1", "No skin in game"],
    highlighted: false,
  },
  {
    title: "THIS AIRDROP",
    rows: ["Pool grows with MCap", "Burned if no growth", "Everyone wins together"],
    highlighted: true,
  },
] as const;

export function InnovationBanner() {
  return (
    <div className="border-border rounded border p-5 space-y-4">
      <div className="text-muted text-[10px] font-bold uppercase tracking-widest text-center font-mono">
        ── How is this different? ──
      </div>

      {/* Two-column comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {COLUMNS.map((col) => (
          <div
            key={col.title}
            className={`rounded border px-4 py-3 space-y-2 ${
              col.highlighted
                ? "border-accent text-foreground"
                : "border-border text-muted opacity-50"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider font-mono text-center">
              {col.title}
            </div>
            <div className="space-y-1.5">
              {col.rows.map((row) => (
                <div key={row} className="text-xs text-center font-mono">
                  {row}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <p className="text-muted text-xs leading-relaxed max-w-xl mx-auto text-center font-mono">
        The pool isn&apos;t pre-valued — it&apos;s valued <span className="text-foreground font-medium">by the market</span>.
        At $100M MCap, 50,000 PLOT = $5M distributed.
        At $0 growth, 50,000 PLOT = burned forever.
        Everyone — team, holders, earners — wins only if PLOT grows.
      </p>
    </div>
  );
}
