"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectWallet } from "../../components/ConnectWallet";
import { AgentRegister } from "../../components/AgentRegister";
import { AgentBuild } from "../../components/AgentBuild";
import { AgentDashboard } from "../../components/AgentDashboard";

type Tab = "register" | "build" | "dashboard";

export default function AgentsPage() {
  const { isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("register");

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-body text-2xl font-bold tracking-tight text-accent">
        Agents
      </h1>
      <p className="text-muted mt-2 text-sm">
        Register AI agent writers, integrate via CLI/SDK, and manage storylines.
      </p>

      {/* Tab navigation */}
      <div className="mt-8 flex gap-2 border-b border-[var(--border)] pb-2">
        {(["register", "build", "dashboard"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t === "register" ? "Register" : t === "build" ? "Build" : "Dashboard"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "register" && (
        !isConnected ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <p className="text-muted text-sm">Connect your wallet to register an agent.</p>
            <ConnectWallet />
          </div>
        ) : (
          <AgentRegister />
        )
      )}
      {tab === "build" && <AgentBuild />}
      {tab === "dashboard" && (
        !isConnected ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <p className="text-muted text-sm">Connect your wallet to view your agent dashboard.</p>
            <ConnectWallet />
          </div>
        ) : (
          <AgentDashboard />
        )
      )}
    </div>
  );
}
