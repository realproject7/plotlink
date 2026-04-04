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

## Completed — Batch 41

- Batch 41: RainbowKit multi-wallet #669

---

## Completed — Batch 42

- Batch 42: Nav wallet UX #675, Hero mobile #671, Dashboard USD #672, CLI validation #670, Scoring fix #674

---

## Completed — Batch 43

- Batch 43: CJK overflow #686, Nav redesign #681, Writer merge #683, Reader merge #684, Nav cleanup #685 (-380 lines)

---

## Completed — Batch 44

- Batch 44: Nav alignment #692, Wallet PLOT balance #693, USD everywhere #694

---

## Completed — Batch 45

- Batch 45: Nav wallet address #698, Agent registration simplify #702, Agents hero #701, Stories tab #699, Portfolio tab #700

---

## Completed — Batch 46

- Batch 46: Username overflow #708, Cursor #712, Agent cleanup #713, CJK v2 #711, Stories Moleskine #709, Portfolio v2 #710

---

## Completed — Batch 47

- Batch 47: Stories v3 #720, Portfolio v3 #721

---

## Completed — Batch 48

- Batch 48: Stories v4 #724, Portfolio v4 #725

---

## Completed — Batch 49

- Batch 49: Stories + Portfolio v5 polish #728

---

## Completed — Batch 50

- Batch 50: Writer tab v6 #730, Reader tab v6 #731

---

## Completed — Batch 51

- Batch 51: Moleskine polish #734

---

## Completed — Batch 52

- Batch 52: Writer + Reader v8 #736

---

## Completed — Batch 53

- Batch 53: Writer v9 #738, Plot count bug #739

---

## Completed — Batch 54

- Batch 54: Writer + Reader v10 #742

---

## Completed — Batch 55

- Batch 55: Farcaster wallet #744, CSP headers #745 (broke miniapp — needs revert)

---

## Completed — Batch 56

- Batch 56: CSP revert #748, Reader/Activity cleanup #749, Writer Stats labels #750

---

## Completed — Batch 57

- Batch 57: Farcaster wallet #758, TVL separator #759, Reader holdings grid #760, USD emphasis #761

---

## Completed — Batch 58

- Batch 58: Reader mobile overflow #765, Plot count dedupe #766, Nav close outside #767, Farcaster auto-connect #770

---

## Completed — Batch 59

- Batch 59: Reader grid fullwidth #777, Reader simplify #778, MCap USD #779, Deadline layout #780, Header redesign #781, USD chart #787

---

## Completed — Batch 60

- Batch 60: Zap nonce fix #790, Trading format #791, MCap+Deadline grid #792, MCap+Supply mobile #793, Moleskine header #794, Reader trades style #795

---

## Completed — Batch 61

- Batch 61: DonateWidget format #799, RatingSummary dedup #800, Stats overflow guard #801

---

## Completed — Batch 62

- Batch 62: Stats boxes #805, Mobile left-align #806, Deadline enforcement #807

---

## Completed — Batch 63

- Batch 63: Deadline has_deadline fix #810, DeadlineCountdown style fix #811

---

## Completed — Batch 64

- Batch 64: Hide countdown #814, 3-zone header redesign #815

---

## Completed — Batch 65

- Batch 65: Hide countdown #814 (via #812), Unified header #817 (via #816)

---

## Completed — Batch 66

- Batch 66: Stats next to cover #819 (via #818)

---

## Completed — Batch 67

- Batch 67: Mobile restore + spacing #821 (via #820)

---

## Completed — Batch 68

- Batch 68: Header single-render #822, Cover width mobile #823, Writer active badge #824

---

## Completed — Batch 69 (partial)

- Batch 69: App scaffold #11 (PR #16), LLM + wallet UI #12 (PR #17), Chat + AI writer #13 (PR #18), Publish via OWS #14 (PR #19), Dashboard #15 (PR #20), Design fix #21 (PR #22), /agents Build tab plotlink#837 (PR #838)

---

## Tonight's Queue — Batch 70: CLI Wizard

> Work happens in `realproject7/plotlink-ows` (public repo).
>
> **Reference repos** (read, don't modify):
> - `claw-on-chain` — OWS onboarding flow (`scripts/onboard.ts`), passphrase → .env → wallet creation
> - `quadwork` — CLI packaging pattern (`bin/quadwork.js`), zero-dep, PID management

### 1. plotlink-ows#23 — CLI Wizard: npx plotlink-ows init + start
- Package as npm CLI with interactive setup wizard (zero external deps, Node builtins only)
- Follow `quadwork` CLI pattern (`~/Projects/quadwork/bin/quadwork.js`)
- Follow `claw-on-chain` OWS onboarding (`~/Projects/claw-on-chain/scripts/onboard.ts`)
- **Seamless 4-step onboarding via `npx plotlink-ows init`**:
  1. OWS wallet: passphrase (masked) + confirmation (must match) → write to .env → create wallet → show address + security warning
  2. LLM: choose provider → API key (masked) or local URL → test connection → save to agent.config.json
  3. AI writer: name, genre, style → save writer profile to config
  4. Summary: wallet address, LLM, writer info, "run npx plotlink-ows to start"
- `npx plotlink-ows` — start server + auto-open browser (skip Web UI setup if wizard done)
- `npx plotlink-ows stop` — clean shutdown via PID file
- `npx plotlink-ows status` — show config, wallet address, LLM provider, writer profile
- Config: `~/.plotlink-ows/config.json`, passphrase in `.env` as `OWS_PASSPHRASE`
- Update package.json: `bin`, `files` fields
- Update README with `npx plotlink-ows init` as primary install flow
- **Repo**: `realproject7/plotlink-ows`
- **Branch**: `task/23-cli-wizard`
- **PR closes**: `Fixes #23`

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
