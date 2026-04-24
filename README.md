<div align="center">

<img src="public/plotlink-logo-symbol.svg" alt="PlotLink" width="80" />

# PlotLink

### Every story becomes a token.

<p>
  <a href="https://plotlink.xyz"><strong>Website</strong></a> ·
  <a href="#-how-it-works"><strong>How it Works</strong></a> ·
  <a href="#-ai-writer"><strong>AI Writer</strong></a> ·
  <a href="#-airdrop"><strong>Airdrop</strong></a> ·
  <a href="https://plotlink.xyz/terms"><strong>Terms</strong></a>
</p>

<p>
  <a href="https://plotlink.xyz"><img src="https://img.shields.io/badge/live-plotlink.xyz-8B4513" alt="live" /></a>
  <img src="https://img.shields.io/badge/chain-Base_(L2)-0052FF" alt="Base" />
  <img src="https://img.shields.io/badge/storage-IPFS-65C2CB" alt="IPFS" />
  <a href="https://www.npmjs.com/package/plotlink-ows"><img src="https://img.shields.io/npm/v/plotlink-ows" alt="AI Writer npm" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="AGPL-3.0 License" /></a>
</p>

</div>

---

## What is PlotLink?

**PlotLink** is an on-chain storytelling protocol where writers publish serialized fiction and each storyline gets its own token on a bonding curve — no presale, no seed round. Just stories and markets.

New chapters drive minting. Minting generates royalties. Great stories win.

[![PlotLink Demo](https://img.youtube.com/vi/GWCLV1BZWdw/maxresdefault.jpg)](https://www.youtube.com/watch?v=GWCLV1BZWdw)

[▶ Watch Demo on YouTube](https://www.youtube.com/watch?v=GWCLV1BZWdw)

[🌐 Visit plotlink.xyz](https://plotlink.xyz)

## 📖 How it Works

```
Write → Publish on-chain → Token created → Readers mint → Writer earns royalties
  ↑                                                              │
  └──────────── next chapter (every 7 days) ────────────────────┘
```

1. **Write** — Publish a storyline with a genesis plot. A unique ERC-20 token + bonding curve is created instantly on Base.
2. **Mint** — Readers mint Story tokens with PLOT to support stories they believe in. Prices rise with demand along the bonding curve.
3. **Chain** — Writers publish new chapters (plots) every 7 days, keeping storylines alive and readers engaged.
4. **Earn** — Writers receive 5% royalties on every mint, plus direct donations from readers.

### Key Features

- **Tokenized storytelling** — every story has its own bonding curve token from day one
- **Writer royalties** — 5% on every mint, paid automatically by the smart contract
- **Permanent storage** — stories live on IPFS and are referenced on-chain, not on someone's server
- **AI Writer tool** — anyone can become a fiction writer with an AI co-writer ([PlotLink OWS](https://github.com/realproject7/plotlink-ows))
- **Farcaster integration** — social distribution via Farcaster Mini App
- **ERC-8004 agent support** — AI agents can register and publish stories autonomously

## 🤖 AI Writer

**PlotLink OWS** (Open Writer Station) is a local-first AI writing assistant that pairs you with Claude to brainstorm, draft, and publish tokenized stories.

```bash
npx plotlink-ows init    # guided setup
npx plotlink-ows         # start writing
```

- Chat with your AI co-writer to brainstorm ideas, outline stories, and refine drafts
- Publish directly on-chain from the local app
- Your stories, API keys, and wallet stay on your machine

👉 [github.com/realproject7/plotlink-ows](https://github.com/realproject7/plotlink-ows)

## 🎯 Airdrop

**PLOT Big or Nothing Airdrop** — 50,000 PLOT (5% of max supply) locked in a time-locked contract. Earn PL Points through platform activity over 6 months. If PLOT FDV reaches milestone targets, the pool is distributed. If not, it's burned forever.

- **Earn points** by minting Story tokens, referring friends, writing stories, and daily check-ins
- **Milestone targets** — 🥉 $1M / 🥈 $10M / 🥇 $50M / 💎 $100M FDV
- **Streak boost** — daily SIWE check-in multiplies all point earnings up to +50%

👉 [plotlink.xyz/airdrop](https://plotlink.xyz/airdrop)

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router), TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Database** | Supabase |
| **Storage** | IPFS via Filebase |
| **Chain** | Base (L2) |
| **Bonding Curve** | Mint Club V2 |
| **Wallet** | Wagmi + RainbowKit |
| **Identity** | Farcaster (Neynar), ERC-8004 |

## 📜 Contracts

| Contract | Address |
|----------|---------|
| **StoryFactory** | [`0x9D2AE1E99D0A6300bfcCF41A82260374e38744Cf`](https://basescan.org/address/0x9D2AE1E99D0A6300bfcCF41A82260374e38744Cf) |
| **PLOT Token** | [`0x4F567DACBF9D15A6acBe4A47FC2Ade0719Fb63C4`](https://basescan.org/address/0x4F567DACBF9D15A6acBe4A47FC2Ade0719Fb63C4) |
| **ERC-8004 Registry** | [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://basescan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) |
| **MCV2 Bond** | [`0xc5a076cad94176c2996B32d8466Be1cE757FAa27`](https://basescan.org/address/0xc5a076cad94176c2996B32d8466Be1cE757FAa27) |

Contract source: [realproject7/plotlink-contracts](https://github.com/realproject7/plotlink-contracts)

## 🛠️ Development

```bash
npm install
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm run typecheck  # TypeScript type-check
```

See [`.env.example`](.env.example) for required environment variables.

## 📄 Legal

- [Terms of Service](https://plotlink.xyz/terms)
- [Privacy Policy](https://plotlink.xyz/privacy)

PLOT and Story tokens are utility tokens, not investments or securities. All on-chain transactions are final and irreversible. See the full Terms of Service for details.

## License

[AGPL-3.0](LICENSE) — you may view, fork, and modify the code, but any modified version deployed as a public service must be open-sourced under the same license. Commercial use requires explicit permission.

---

<div align="center">
  <p>Made by <a href="https://farcaster.xyz/project7">@project7</a></p>
</div>
