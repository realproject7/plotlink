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
- P5-R1 through P5-R4: All done (#80, #78, #79, #81 — ABI update, ratings schema, rating API, rating UI)
- P5-6 and P5-7: All done (#28 trending/rising, #29 dashboard stats)

---

## Tonight's Queue — Bug Fixes (assign in this exact order)

> Ordered to avoid merge conflicts: tickets touching the same files are grouped sequentially.

### 1. plotlink#88 — [Bug] Rating API: use verifyMessage instead of recoverMessageAddress

**What's wrong:** `src/app/api/ratings/route.ts` uses `recoverMessageAddress()` which only works for EOA wallets. Smart contract wallets (Safe, Argent) cannot rate. The spec required `verifyMessage()` from viem which supports both EOA and EIP-1271.

**Fix:** Replace `recoverMessageAddress()` with `verifyMessage()` from viem.

**Merge checklist:**
- [ ] `recoverMessageAddress` replaced with `verifyMessage` in `src/app/api/ratings/route.ts`
- [ ] `npm run lint` and `npm run typecheck` pass

### 2. plotlink#92 — [Bug] Signed rating message does not bind comment

**What's wrong:** The signed message is `"Rate storyline ${storylineId} with rating ${rating}"` — the comment is not included. A valid signature can be replayed with a different comment.

**Fix:** Include the comment (or its hash) in the signed message. Update both the API verification (`src/app/api/ratings/route.ts`) and the frontend signing (`src/components/RatingWidget.tsx`).

**Merge checklist:**
- [ ] Comment included in signed message in `src/app/api/ratings/route.ts`
- [ ] Message construction updated in `src/components/RatingWidget.tsx`
- [ ] `npm run lint` and `npm run typecheck` pass

### 3. plotlink#94 — [Bug] No comment length limit, rate limiting, or pagination on ratings API

**What's wrong:** No max comment length (API or UI), no pagination on GET, no rate limiting on POST.

**Fix:**
- Add `maxLength` (e.g., 500) on textarea in `RatingWidget.tsx` and validate server-side
- Add `?limit=20&offset=0` pagination to GET endpoint
- Consider simple rate limiting

**Merge checklist:**
- [ ] Comment length validated in API + UI maxLength attribute
- [ ] GET endpoint supports pagination (`limit`, `offset` query params)
- [ ] `npm run lint` and `npm run typecheck` pass

### 4. plotlink#90 — [Bug] Dashboard hardcodes 18 decimals for reserve token

**What's wrong:** `WriterTradingStats` and `ReaderPortfolio` use `formatUnits(..., 18)` everywhere. Breaks with non-18-decimal reserve tokens (e.g., USDC = 6).

**Key context for T3:**
- `tokenBond()` returns `reserveToken` address — use it to call ERC-20 `decimals()`
- Add `decimals` to the `erc20Abi` in `lib/price.ts` if not already there
- Use actual decimals in all `formatUnits()` calls

**Merge checklist:**
- [ ] Reserve token decimals fetched via ERC-20 `decimals()` call
- [ ] Actual decimals used in `formatUnits()` in `WriterTradingStats.tsx` and `ReaderPortfolio.tsx`
- [ ] `npm run lint` and `npm run typecheck` pass

### 5. plotlink#93 — [Bug] ReaderPortfolio scans all storylines for balanceOf — N+1

**What's wrong:** `ReaderPortfolio.tsx` calls `balanceOf()` per storyline to find user holdings. Does not scale.

**Fix:** Use viem `multicall` to batch all `balanceOf` checks into a single RPC call.

**Merge checklist:**
- [ ] `balanceOf` calls batched using viem `multicall` in `ReaderPortfolio.tsx`
- [ ] `npm run lint` and `npm run typecheck` pass

### 6. plotlink#89 — [Bug] Discover page makes ~200 RPC calls per load

**What's wrong:** `lib/ranking.ts` calls `get24hPriceChange()` + `getTokenTVL()` per storyline (up to 50), each making 2 on-chain reads = ~200 RPC calls. No caching.

**Fix:**
- Add Next.js caching (`unstable_cache` or `revalidate`) to the discover page
- Consider viem `multicall` to batch on-chain reads
- Reasonable revalidation window (e.g., 60–300 seconds)

**Merge checklist:**
- [ ] Caching or ISR revalidation added to discover page
- [ ] On-chain reads batched where possible
- [ ] `npm run lint` and `npm run typecheck` pass

### 7. plotlink#91 — [Bug] Rising algorithm inflates scores for new storylines

**What's wrong:** New storylines with zero prior window activity get near-zero `priorScore`, causing `acceleration = recent / prior` to inflate to extreme values. They always dominate the rising tab.

**Fix:** Add a minimum prior activity threshold — exclude storylines from rising if they have insufficient prior window data (e.g., require at least 1 rating or plot in prior window, or cap the acceleration ratio).

**Merge checklist:**
- [ ] Minimum prior activity threshold added for rising candidates in `lib/ranking.ts`
- [ ] `npm run lint` and `npm run typecheck` pass

### 8. plotlink#95 — [Bug] No DB-level address normalization on ratings table

**What's wrong:** `rater_address` is `TEXT` with no CHECK constraint. Mixed-case addresses could bypass UNIQUE dedup.

**Fix:** Create migration `00006_ratings_address_check.sql` adding `CHECK (rater_address = lower(rater_address))`.

**Merge checklist:**
- [ ] Migration `00006_ratings_address_check.sql` created
- [ ] `npm run lint` and `npm run typecheck` pass

---

## Rules

1. Assign ONE ticket at a time to @t3
2. Wait for @t2a AND @t2b to both approve before merging
3. After merge, immediately assign the next ticket
4. Use correct original issue numbers in PR titles (e.g., `[#88]` not `[#300]`)
5. Import contract addresses from `lib/contracts/constants.ts` — do NOT hardcode
6. If T3 gets stuck after 2 review rounds, skip that ticket and note it for morning review
7. Do NOT push to main — only merge approved PRs
8. STOP at operator gates

## Reference

- Contract constants: `lib/contracts/constants.ts` (testnet/mainnet auto-switch via `IS_TESTNET`)
- Price utilities: `lib/price.ts` (priceForNextMint, tokenBond, get24hPriceChange, getTokenTVL)
- Ratings API: `src/app/api/ratings/route.ts`
- Rating UI: `src/components/RatingWidget.tsx`, `src/components/RatingSummary.tsx`
- Ranking: `lib/ranking.ts`
- Dashboard: `src/components/WriterTradingStats.tsx`, `src/components/ReaderPortfolio.tsx`
