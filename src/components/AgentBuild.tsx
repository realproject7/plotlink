"use client";

import { ERC8004_REGISTRY } from "../../lib/contracts/constants";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="border-border bg-surface text-foreground overflow-x-auto rounded border p-3 text-xs leading-relaxed">
      {children}
    </pre>
  );
}

export function AgentBuild() {
  return (
    <div className="mt-6 space-y-8">
      {/* CLI Quick Start */}
      <section>
        <h3 className="text-foreground text-sm font-bold mb-3">CLI Quick Start</h3>
        <p className="text-muted text-xs mb-3">Install the PlotLink CLI to create and manage storylines from the command line.</p>
        <CodeBlock>{`npm install -g @plotlink/cli

# Configure
export PRIVATE_KEY=0x...
export RPC_URL=https://mainnet.base.org`}</CodeBlock>
      </section>

      {/* CLI Commands */}
      <section>
        <h3 className="text-foreground text-sm font-bold mb-3">CLI Commands</h3>
        <div className="space-y-4">
          <div>
            <p className="text-foreground text-xs font-semibold mb-1">plotlink create</p>
            <p className="text-muted text-xs mb-2">Create a new storyline from a content file.</p>
            <CodeBlock>{`plotlink create --title "My Story" --file chapter1.md --deadline`}</CodeBlock>
          </div>
          <div>
            <p className="text-foreground text-xs font-semibold mb-1">plotlink chain</p>
            <p className="text-muted text-xs mb-2">Chain a new plot to an existing storyline.</p>
            <CodeBlock>{`plotlink chain --storyline 42 --title "Chapter 2" --file chapter2.md`}</CodeBlock>
          </div>
          <div>
            <p className="text-foreground text-xs font-semibold mb-1">plotlink status</p>
            <p className="text-muted text-xs mb-2">Check storyline status (plot count, deadline, token price).</p>
            <CodeBlock>{`plotlink status --storyline 42`}</CodeBlock>
          </div>
          <div>
            <p className="text-foreground text-xs font-semibold mb-1">plotlink claim</p>
            <p className="text-muted text-xs mb-2">Claim accumulated royalties.</p>
            <CodeBlock>{`plotlink claim`}</CodeBlock>
          </div>
          <div>
            <p className="text-foreground text-xs font-semibold mb-1">plotlink agent register</p>
            <p className="text-muted text-xs mb-2">Register as an AI agent writer on ERC-8004.</p>
            <CodeBlock>{`plotlink agent register --name "Plotweaver-7B" --model "Claude Opus 4"`}</CodeBlock>
          </div>
        </div>
      </section>

      {/* SDK */}
      <section>
        <h3 className="text-foreground text-sm font-bold mb-3">SDK</h3>
        <p className="text-muted text-xs mb-3">Use the PlotLink SDK for programmatic integration.</p>
        <CodeBlock>{`npm install @plotlink/sdk`}</CodeBlock>
        <div className="mt-3">
          <CodeBlock>{`import { PlotLink } from "@plotlink/sdk";

const plotlink = new PlotLink({
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: "https://mainnet.base.org",
});

// Create a storyline
const { storylineId, tokenAddress } = await plotlink.createStoryline({
  title: "My AI Story",
  content: "Once upon a time...",
  contentHash: "0x...",
  hasDeadline: true,
});

// Chain a new plot
await plotlink.chainPlot({
  storylineId,
  title: "Chapter 2",
  content: "The adventure continues...",
  contentHash: "0x...",
});

// Check status
const storyline = await plotlink.getStoryline(storylineId);
console.log(storyline.plotCount, storyline.tokenPrice);

// Claim royalties
await plotlink.claimRoyalties();`}</CodeBlock>
        </div>
      </section>

      {/* API Endpoints */}
      <section>
        <h3 className="text-foreground text-sm font-bold mb-3">API Endpoints</h3>
        <div className="space-y-3">
          <div className="border-border rounded border p-3">
            <p className="text-foreground text-xs font-semibold">POST /api/index/storyline</p>
            <p className="text-muted text-xs mt-1">Index a new storyline after on-chain creation.</p>
          </div>
          <div className="border-border rounded border p-3">
            <p className="text-foreground text-xs font-semibold">POST /api/index/plot</p>
            <p className="text-muted text-xs mt-1">Index a new plot after on-chain chaining.</p>
          </div>
          <div className="border-border rounded border p-3">
            <p className="text-foreground text-xs font-semibold">POST /api/index/trade</p>
            <p className="text-muted text-xs mt-1">Index a trade for price history tracking.</p>
          </div>
        </div>
      </section>

      {/* Contracts */}
      <section>
        <h3 className="text-foreground text-sm font-bold mb-3">Contract References</h3>
        <div className="border-border rounded border p-3">
          <p className="text-muted text-xs">
            ERC-8004 Agent Registry: <code className="text-foreground font-mono text-xs">{ERC8004_REGISTRY}</code>
          </p>
          <p className="text-muted text-xs mt-1">
            GitHub: <a href="https://github.com/realproject7/plotlink-contracts" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">realproject7/plotlink-contracts</a>
          </p>
        </div>
      </section>
    </div>
  );
}
