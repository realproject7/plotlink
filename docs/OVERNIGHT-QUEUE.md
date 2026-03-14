# Assignment Queue — PlotLink (2026-03-14, Session 2)

> T1: Work through this queue top-to-bottom. Assign ONE ticket at a time to @t3.
> After each PR is merged, assign the next ticket immediately.
> STOP at any OPERATOR GATE.

---

## Completed (already merged)

### Phase 0–4 — All Done
- Phase 0 (Bootstrap), Phase 1 (Content Pipeline), Phase 2 (Contracts), Phase 3 (Write & Read), Phase 4 (Discovery & Dashboards) — fully merged.
- StoryFactory deployed to Base Sepolia: `0x05C4d59529807316D6fA09cdaA509adDfe85b474`
- Bug fixes #52, #55 merged.

### Operator Setup for Phase 5
- `constants.ts` updated with testnet/mainnet switching via `IS_TESTNET`
- PLOT_TOKEN = WETH (`0x4200000000000000000000000000000000000006`) on testnet
- MCV2_Bond = `0x5dfA75b0185efBaEF286E80B847ce84ff8a62C2d` on testnet
- MCV2_BondPeriphery = `0x20fBC8a650d75e4C2Dab8b7e85C27135f0D64e89` on testnet
- RLS public read policies applied to all 3 tables
- `backfill_cursor` table created

**P5-OP is DONE for testnet** — WETH serves as $PLOT stand-in.

---

## Tonight's Queue (assign in this exact order)

### 1. plotlink#67 — [BUG] Reader dashboard missing pagination

**Merge checklist:**
- [ ] Donation query has `.limit(50)` or similar
- [ ] Pagination indicator if more results exist
- [ ] Total donation aggregation handles limited results correctly
- [ ] `npm run lint` and `npm run typecheck` pass

### 2. plotlink#68 — [BUG] Writer and Reader dashboards missing error state

**Merge checklist:**
- [ ] Both dashboards render React Query `error` state with user-visible message
- [ ] `npm run lint` and `npm run typecheck` pass

---

### 3. Phase 5 — Token Trading (`realproject7/plotlink`)

**Key context for T3:**
- `IS_TESTNET` flag in `lib/contracts/constants.ts` auto-selects testnet addresses
- `PLOT_TOKEN` = WETH on testnet, $PLOT on mainnet
- `MCV2_BOND` = Base Sepolia address on testnet, Base mainnet on production
- Storyline tokens are bonding curve tokens created by StoryFactory via MCV2_Bond
- Import addresses from `lib/contracts/constants.ts`, do NOT hardcode

#### plotlink#23 — [P5-1] Token Price Display

**Merge checklist:**
- [ ] Price utility reads current token price and supply from MCV2_Bond
- [ ] Uses `getReserveForToken()` and/or `getRefundForTokens()` view functions
- [ ] Token price displayed on story page
- [ ] Total supply shown
- [ ] `npm run lint` and `npm run typecheck` pass

#### plotlink#24 — [P5-2] Trading Widget

**Merge checklist:**
- [ ] Buy (mint) and sell (burn) via MCV2_Bond
- [ ] Slippage protection (maxReserveAmount for buy, minRefund for sell)
- [ ] Token approval flow for reserve token before buy
- [ ] Balance display for both reserve and storyline tokens
- [ ] `npm run lint` and `npm run typecheck` pass

#### plotlink#25 — [P5-3] Price Chart

**Merge checklist:**
- [ ] Bonding curve visualization
- [ ] Current position marked on curve
- [ ] `npm run lint` and `npm run typecheck` pass

#### plotlink#26 — [P5-4] Donation Flow

**Merge checklist:**
- [ ] Donate button on story page
- [ ] Transfers PLOT_TOKEN (WETH on testnet) from donor to storyline
- [ ] Requires ERC-20 approval before transfer
- [ ] Triggers donation indexer after tx confirmation
- [ ] `npm run lint` and `npm run typecheck` pass

#### plotlink#27 — [P5-5] Royalty Claiming

**Merge checklist:**
- [ ] Claim button in writer dashboard
- [ ] Gated by `plot_count >= 2`
- [ ] Calls `MCV2_Bond.claimRoyalties(reserveToken)` with writer's address
- [ ] Shows claimable amount before claiming
- [ ] `npm run lint` and `npm run typecheck` pass

#### plotlink#28 — [P5-6] Trending & Rising Discovery Tabs

**Merge checklist:**
- [ ] Trending: composite ranking (donation volume + plot frequency + token activity)
- [ ] Rising: acceleration-based ranking (recent growth rate)
- [ ] Replaces placeholder queries from P4-2
- [ ] `npm run lint` and `npm run typecheck` pass

#### plotlink#29 — [P5-7] Dashboard Trading Stats

**Merge checklist:**
- [ ] Writer dashboard: earnings + volume stats
- [ ] Reader dashboard: holdings + portfolio value
- [ ] Reads from MCV2_Bond for live price data
- [ ] `npm run lint` and `npm run typecheck` pass

---

> **STOP HERE** — plotlink#30 [P5-9] Zap Frontend and contracts#8 [P5-8] ZapPlotLinkMCV2
> require real $PLOT token and multi-token routing. Skip for now.

---

## Rules

1. Assign ONE ticket at a time to @t3
2. Wait for @t2a AND @t2b to both approve before merging
3. After merge, immediately assign the next ticket
4. Use correct original issue numbers in PR titles (e.g., `[#23]` not `[#198]`)
5. Import contract addresses from `lib/contracts/constants.ts` — do NOT hardcode addresses
6. If T3 gets stuck after 2 review rounds, skip that ticket and note it for morning review
7. Do NOT push to main — only merge approved PRs
8. STOP at operator gates

## Reference

- Full roadmap: `plotlink/docs/ROADMAP.md`
- Full queue with all phases: `plotlink/docs/T1-ASSIGNMENT-QUEUE.md`
- Contract constants: `lib/contracts/constants.ts` (testnet/mainnet auto-switch via `IS_TESTNET`)
