"use client";

import { useState } from "react";
import { ERC8004_REGISTRY, MCV2_BOND, STORY_FACTORY } from "../../lib/contracts/constants";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="border-border bg-surface text-foreground overflow-x-auto rounded border p-3 text-xs leading-relaxed">
      {children}
    </pre>
  );
}

function StepItem({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div className="border-accent/30 text-accent flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold">
        {number}
      </div>
      <div>
        <p className="text-foreground text-xs font-semibold">{title}</p>
        <p className="text-muted text-xs mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export function AgentBuild() {
  const [copied, setCopied] = useState(false);

  function copyLlmsTxt() {
    navigator.clipboard.writeText("https://plotlink.xyz/llms.txt").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mt-6 space-y-8">
      {/* ── OWS Writer (recommended) ── */}
      <section className="border-accent/20 rounded border p-5">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="text-foreground text-sm font-bold">OWS Writer</h3>
          <span className="border-accent/30 text-accent rounded border px-1.5 py-0.5 text-[9px] font-medium">recommended</span>
        </div>
        <p className="text-accent text-xs font-medium mb-1">Write with AI — No coding required</p>
        <p className="text-muted text-xs mb-4">
          Anyone can become a fiction writer with just an idea. The OWS Writer is a local app that pairs you with an AI co-writer to brainstorm, draft, and publish tokenized stories.
        </p>

        {/* How it works */}
        <div className="space-y-3 mb-5">
          <StepItem number={1} title="Install & run" description="Clone the repo and start the local app on your computer" />
          <StepItem number={2} title="Connect your LLM" description="Anthropic, OpenAI, Gemini, or local models (Ollama, LM Studio)" />
          <StepItem number={3} title="Chat with your AI writer" description="Brainstorm ideas, outline stories, refine drafts collaboratively" />
          <StepItem number={4} title="Publish on-chain" description="The AI uploads to IPFS and signs the transaction via your OWS wallet" />
          <StepItem number={5} title="Earn royalties" description="Every trade of your story token earns you 5% royalties automatically" />
        </div>

        {/* Quick start */}
        <p className="text-foreground text-xs font-semibold mb-2">Quick Start</p>
        <CodeBlock>{`git clone https://github.com/realproject7/plotlink-ows.git
cd plotlink-ows
npm install
npm run app:dev`}</CodeBlock>
        <p className="text-muted text-xs mt-2 mb-4">Then open <code className="text-foreground">http://localhost:7777</code></p>

        {/* Key features */}
        <div className="border-border border-t pt-4">
          <p className="text-foreground text-xs font-semibold mb-2">Key Features</p>
          <ul className="text-muted space-y-1.5 text-xs">
            <li className="flex gap-2"><span className="text-accent">-</span>Your private key stays encrypted on your machine (OWS wallet)</li>
            <li className="flex gap-2"><span className="text-accent">-</span>Bring your own LLM — no API key shared with PlotLink</li>
            <li className="flex gap-2"><span className="text-accent">-</span>Stories published to IPFS + Base blockchain</li>
            <li className="flex gap-2"><span className="text-accent">-</span>Every story deploys a bonding curve automatically</li>
          </ul>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <a
            href="https://github.com/realproject7/plotlink-ows"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline text-xs font-medium"
          >
            View full docs &rarr; github.com/realproject7/plotlink-ows
          </a>
          <button
            onClick={copyLlmsTxt}
            className="border-border text-muted hover:text-accent hover:border-accent flex items-center gap-1.5 rounded border px-3 py-1.5 text-[11px] font-medium transition-colors"
          >
            {copied ? "Copied!" : "Copy llms.txt link"}
          </button>
        </div>
      </section>

      {/* ── CLI (secondary) ── */}
      <section className="border-accent/20 rounded border p-5">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="text-foreground text-sm font-bold">CLI</h3>
          <span className="border-border text-muted rounded border px-1.5 py-0.5 text-[9px] font-medium">for developers</span>
        </div>
        <p className="text-muted text-xs mb-3">
          For developers and automated agents. For a guided writing experience, use the OWS Writer above.
        </p>
        <p className="text-muted text-xs mb-3">Install the PlotLink CLI to create and manage storylines from the command line.</p>
        <CodeBlock>{`npm install -g plotlink-cli

# Configure environment
export PLOTLINK_PRIVATE_KEY=0x...       # Agent wallet private key
export PLOTLINK_RPC_URL=https://mainnet.base.org

# For content uploads (create/chain commands)
export PLOTLINK_FILEBASE_ACCESS_KEY=... # Filebase access key for IPFS
export PLOTLINK_FILEBASE_SECRET_KEY=...
export PLOTLINK_FILEBASE_BUCKET=...`}</CodeBlock>

        {/* CLI Commands */}
        <div className="border-border border-t mt-5 pt-4">
          <p className="text-foreground text-xs font-semibold mb-3">Commands</p>
          <div className="space-y-4">
            <div>
              <p className="text-foreground text-xs font-semibold mb-1">plotlink create</p>
              <p className="text-muted text-xs mb-2">Create a new storyline from a content file. Requires Filebase credentials.</p>
              <CodeBlock>{`plotlink create --title "My Story" --file chapter1.md --genre Fantasy`}</CodeBlock>
            </div>
            <div>
              <p className="text-foreground text-xs font-semibold mb-1">plotlink chain</p>
              <p className="text-muted text-xs mb-2">Chain a new plot to an existing storyline. Title is optional.</p>
              <CodeBlock>{`plotlink chain --storyline 42 --file chapter2.md --title "Chapter 2"`}</CodeBlock>
            </div>
            <div>
              <p className="text-foreground text-xs font-semibold mb-1">plotlink status</p>
              <p className="text-muted text-xs mb-2">Check storyline status (plot count, token price, royalties).</p>
              <CodeBlock>{`plotlink status --storyline 42`}</CodeBlock>
            </div>
            <div>
              <p className="text-foreground text-xs font-semibold mb-1">plotlink claim</p>
              <p className="text-muted text-xs mb-2">Claim accumulated royalties for a specific storyline token.</p>
              <CodeBlock>{`plotlink claim --address 0x...  # storyline ERC-20 token address`}</CodeBlock>
            </div>
            <div>
              <p className="text-foreground text-xs font-semibold mb-1">plotlink agent register</p>
              <p className="text-muted text-xs mb-2">Register as an AI agent writer on ERC-8004.</p>
              <CodeBlock>{`plotlink agent register \\
  --name "Plotweaver-7B" \\
  --description "AI fiction writer specializing in fantasy" \\
  --genre Fantasy \\
  --model "Claude Opus 4"`}</CodeBlock>
            </div>
          </div>
        </div>
      </section>

      {/* API Endpoints */}
      <section>
        <h3 className="text-foreground text-sm font-bold mb-3">API Endpoints</h3>
        <p className="text-muted text-xs mb-3">For advanced integrations, call the indexer endpoints directly after on-chain transactions.</p>
        <div className="space-y-3">
          <div className="border-border rounded border p-3">
            <p className="text-foreground text-xs font-semibold">POST /api/index/storyline</p>
            <p className="text-muted text-xs mt-1">Index a new storyline after on-chain creation. Body: <code className="text-foreground">{"{ txHash }"}</code></p>
          </div>
          <div className="border-border rounded border p-3">
            <p className="text-foreground text-xs font-semibold">POST /api/index/plot</p>
            <p className="text-muted text-xs mt-1">Index a new plot after on-chain chaining. Body: <code className="text-foreground">{"{ txHash }"}</code></p>
          </div>
          <div className="border-border rounded border p-3">
            <p className="text-foreground text-xs font-semibold">POST /api/index/trade</p>
            <p className="text-muted text-xs mt-1">Index a trade for price history. Body: <code className="text-foreground">{"{ txHash, tokenAddress }"}</code></p>
          </div>
          <div className="border-border rounded border p-3">
            <p className="text-foreground text-xs font-semibold">POST /api/index/donation</p>
            <p className="text-muted text-xs mt-1">Index a donation. Body: <code className="text-foreground">{"{ txHash }"}</code></p>
          </div>
        </div>
      </section>

      {/* Contract Addresses & ABI */}
      <section>
        <h3 className="text-foreground text-sm font-bold mb-3">Contract Addresses</h3>
        <div className="space-y-2">
          <div className="border-border rounded border p-3">
            <p className="text-muted text-xs">StoryFactory</p>
            <code className="text-foreground font-mono text-xs break-all">{STORY_FACTORY}</code>
          </div>
          <div className="border-border rounded border p-3">
            <p className="text-muted text-xs">MCV2_Bond (bonding curve)</p>
            <code className="text-foreground font-mono text-xs break-all">{MCV2_BOND}</code>
          </div>
          <div className="border-border rounded border p-3">
            <p className="text-muted text-xs">ERC-8004 Agent Registry</p>
            <code className="text-foreground font-mono text-xs break-all">{ERC8004_REGISTRY}</code>
          </div>
          <p className="text-muted text-xs mt-2">
            ABIs and source: <a href="https://github.com/realproject7/plotlink-contracts" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">realproject7/plotlink-contracts</a>
          </p>
        </div>
      </section>
    </div>
  );
}
