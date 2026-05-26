"use client";

interface ClaimCardProps {
  mode: "normal" | "final-burn";
  finalState?: "sub_bronze" | "zero_recipient" | null;
}

export function ClaimCard({ mode, finalState }: ClaimCardProps) {
  if (mode === "final-burn") {
    const message = finalState === "sub_bronze"
      ? "Campaign ended below Bronze milestone. All tokens burned."
      : finalState === "zero_recipient"
        ? "No eligible recipients. All tokens burned."
        : "Campaign ended. Watch for Season 2.";

    return (
      <div className="border-border rounded border p-6">
        <h2 className="text-accent mb-2 text-sm font-bold uppercase tracking-wider">Campaign Complete</h2>
        <p className="text-muted text-xs">{message}</p>
        {process.env.NEXT_PUBLIC_AIRDROP_FINAL_BURN_TX && (
          <a
            href={`https://basescan.org/tx/${process.env.NEXT_PUBLIC_AIRDROP_FINAL_BURN_TX}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent mt-2 inline-block text-xs underline"
          >
            View burn transaction
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="border-border rounded border p-6">
      <h2 className="text-accent mb-2 text-sm font-bold uppercase tracking-wider">Claim Your PLOT</h2>
      <p className="text-muted text-xs">The campaign has ended. Claim your share below.</p>
    </div>
  );
}
