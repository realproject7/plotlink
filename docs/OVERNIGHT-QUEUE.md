# Assignment Queue — PlotLink (2026-03-31)

> T1: Work through this queue top-to-bottom. Assign ONE ticket at a time to @t3.
> After each PR is merged, assign the next ticket immediately.
> All tickets are autonomous — no operator gates.

---

## Completed

- Phase 0–8, Bug fix batches 1–12, UX Polish: All done
- Batch 13–24: Farcaster, Notifications, Profile, Share, Trending, Users Table
- Batch 25–27: Non-FID Users, Markdown, Draft Auto-save, Profile Credibility, Reading Mode, Vercel Analytics
- Batch 28–29: Header Alignment, Reputation Trending, ERC-8004 Overhaul, LLM Models, Agent Profile, Agent DB Cache
- Batch 30–31: RPC Fix, Version Bump, Share Embed, Reading Mode Button, Create Notices, Token Page, Miniapp Padding v2, Duplicate Genesis
- Batch 32–33: Zap Trade Fix, Mobile Zoom, Connected Wallet, Nav Close, Page Flip, EIP-712 Fix, Agent Success Messages, Trading History, Page Flip v2
- Batch 34–37: MAX Button, Neynar DB-first, Connect Race, URI Validation, Upsert Race, Agent Cache Reliability, Profile Dedup, Indexer Auth, Price Consistency, Page Flip v3, SDK Removal, Hero Section, llms.txt, User Scoring
- Batch 38: CLI E2E Verification — 4 bugs found
- Batch 39: CLI Build Fix #663, Create Fee #660, Chain-Aware Addresses #661, Status Pagination #662

---

## Completed — Batch 40

- Batch 40: CLI E2E re-test #668 — all 5 commands pass ✅

---

## Tonight's Queue — Batch 41: Wallet + CLI

### 1. plotlink#669 — Add RainbowKit multi-wallet support
- Install RainbowKit, add 5 wallets: MetaMask, Base Account, Trust, Rainbow, WalletConnect
- Farcaster auto-connect preserved (first connector)
- PlotLink-themed modal (cream/monospace/minimal)
- `modalSize="compact"` for mobile-first
- Update providers.tsx, wagmi.ts, ConnectWallet.tsx
- Benchmark from `~/Projects/dropcast/lib/wagmi.ts`
- Requires `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` env var
- Branch: `task/669-rainbowkit-wallets`

### 2. plotlink#670 — Add content/title validation to CLI
- CLI has no length limits — can create 1-char stories or 1000-char titles
- Add: title ≤ 60 chars, content 500–10,000 chars (match frontend)
- Clear error messages on violation
- Branch: `task/670-cli-content-validation`

---

## Rules

1. Assign ONE ticket at a time to @t3
2. Wait for @t2a AND @t2b to both approve before merging
3. After merge, immediately assign the next ticket
4. Use correct original issue numbers in PR titles (e.g., `[#668]`)
5. **NEVER store keys/secrets in plain text without .gitignore protection**
6. **Communicate via AgentChattr MCP chat by tagging agents. Your terminal is NOT visible.**
7. Do NOT push to main — only merge approved PRs
8. **Versioning**: T3 bumps patch (3rd digit) in package.json per PR
9. **Self-verify** each ticket using the checklist in the issue before requesting review
10. T3 has access to: Playwright, Chrome MCP, deployer wallet, donor wallet

## Reference

- StoryFactory v4b: `0x9D2AE1E99D0A6300bfcCF41A82260374e38744Cf`
- ZapPlotLinkV2: `0xAe50C9444DA2Ac80B209dC8B416d1B4A7D3939B0`
- PLOT: `0x4F567DACBF9D15A6acBe4A47FC2Ade0719Fb63C4`
- ERC-8004: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Domain: `plotlink.xyz`
- Dropcast CLI reference: `~/Projects/dropcast-cli`
- Contract repo: `~/Projects/plotlink-contracts`
