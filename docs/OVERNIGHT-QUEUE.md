# Assignment Queue — PlotLink (2026-03-15)

> T1: Work through this queue top-to-bottom. Assign ONE ticket at a time to @t3.
> After each PR is merged, assign the next ticket immediately.
> STOP at any OPERATOR GATE.

---

## Completed

- Phase 0–4: All done
- Phase 5 P5-1 through P5-5: All done (price display, trading widget, chart, donations, royalties)
- Bug fixes #52, #55, #67, #68: All done
- P5-OP: Done (testnet constants auto-switch via IS_TESTNET)

---

## Tonight's Queue (assign in this exact order)

### 1. plotlink#80 — [P5-R3] Add priceForNextMint + tokenBond ABI + 24h price change

Add simpler MCV2_Bond view functions (used by mint.club-v2-web and mintpad).

**Key context for T3:**
- `priceForNextMint(address) → uint128` — current price, no amount param
- `tokenBond(address) → (creator, mintRoyalty, burnRoyalty, createdAt, reserveToken, reserveBalance)` — includes TVL
- 24h price change: read priceForNextMint at current block AND at `currentBlock - 43200n` (~24h on Base). Compute % change. No DB needed.

**Merge checklist:**
- [ ] `priceForNextMint` and `tokenBond` added to `lib/contracts/abi.ts`
- [ ] `get24hPriceChange(tokenAddress)` utility in `lib/price.ts`
- [ ] `getTokenTVL(tokenAddress)` utility in `lib/price.ts`
- [ ] Existing `getTokenPrice()` simplified to use `priceForNextMint`
- [ ] `npm run lint` and `npm run typecheck` pass

### 2. plotlink#78 — [P5-R1] Ratings schema + RLS policy

**Merge checklist:**
- [ ] Migration `00005_ratings.sql` creates `ratings` table
- [ ] RLS: public read (`FOR SELECT USING (true)`), no public write
- [ ] `Database` type in `lib/supabase.ts` updated with ratings types
- [ ] `npm run lint` and `npm run typecheck` pass

### 3. plotlink#79 — [P5-R2] Rating API with signature verification + token gate

**Key context for T3:**
- POST /api/ratings: verify signature via `verifyMessage()`, check `balanceOf(rater, tokenAddress) > 0`
- GET /api/ratings?storylineId=X: return ratings + average
- Use service role client for writes

**Merge checklist:**
- [ ] POST verifies wallet signature via `verifyMessage()` (viem)
- [ ] Token gate: `balanceOf()` check on storyline ERC-20 token
- [ ] Rejects if 0 balance
- [ ] Upserts (one rating per user per storyline)
- [ ] GET returns ratings + computed average
- [ ] `npm run lint` and `npm run typecheck` pass

### 4. plotlink#81 — [P5-R4] Rating UI on story page

**Merge checklist:**
- [ ] Average rating + count on story header
- [ ] Star selector (1-5) + optional comment for token holders
- [ ] Signs message via wagmi `signMessage()` before POST
- [ ] Shows existing rating if user already rated
- [ ] Non-holders see "Hold tokens to rate" prompt
- [ ] `npm run lint` and `npm run typecheck` pass

### 5. plotlink#28 — [P5-6] Trending & Rising Discovery Tabs

Uses revised signal set (see issue comment):
- Average reader rating (from ratings table)
- 24h price change % (from `get24hPriceChange()` — on-chain, no DB)
- TVL (from `getTokenTVL()` — on-chain)
- Plot continuation rate (from existing plots table)

**Merge checklist:**
- [ ] Trending: composite ranking using the 4 signals above
- [ ] Rising: acceleration-based (recent window vs prior window)
- [ ] Replaces placeholder queries from P4-2
- [ ] `npm run lint` and `npm run typecheck` pass

### 6. plotlink#29 — [P5-7] Dashboard Trading Stats

Uses on-chain reads (see issue comment):
- Writer: donations total + royalties + per-story TVL + price
- Reader: token holdings via balanceOf + portfolio value + 24h change

**Merge checklist:**
- [ ] Writer dashboard: earnings, TVL, token price per storyline
- [ ] Reader dashboard: holdings, portfolio value, 24h change
- [ ] Uses `priceForNextMint`, `tokenBond`, `get24hPriceChange` utilities
- [ ] `npm run lint` and `npm run typecheck` pass

---

> **STOP HERE** — Phase 5 remaining (#30 Zap, contracts#8 ZapContract) need real $PLOT token.
> Phase 6+ not yet assigned.

---

## Rules

1. Assign ONE ticket at a time to @t3
2. Wait for @t2a AND @t2b to both approve before merging
3. After merge, immediately assign the next ticket
4. Use correct original issue numbers in PR titles (e.g., `[#80]` not `[#300]`)
5. Import contract addresses from `lib/contracts/constants.ts` — do NOT hardcode
6. If T3 gets stuck after 2 review rounds, skip that ticket and note it for morning review
7. Do NOT push to main — only merge approved PRs
8. STOP at operator gates

## Reference

- Full queue: `plotlink/docs/T1-ASSIGNMENT-QUEUE.md`
- Contract constants: `lib/contracts/constants.ts` (testnet/mainnet auto-switch via `IS_TESTNET`)
- Price patterns: mintpad `src/helpers/contracts.ts` (priceForNextMint + 24h block diff)
