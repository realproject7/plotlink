# Assignment Queue — PlotLink (2026-03-18)

> T1: Work through this queue top-to-bottom. Assign ONE ticket at a time to @t3.
> After each PR is merged, assign the next ticket immediately.
> STOP at any OPERATOR GATE.

---

## Completed

- Phase 0–4: All done
- Phase 5: All done (except #30 Zap — blocked on $PLOT)
- Bug fixes: #52, #55, #67, #68, #88–#95, #112–#117, #132–#137, #144: All done
- UI polish #104–#107: All done
- Phase 6 Agent Layer #33, #32, #35, #34: All done
- Phase 7 Farcaster #36, #37, #38, #39: All done
- P8-1 Content Moderation #40: All done
- P7/P8 review fixes (PR #151): All done
- QA-1 through QA-4: #127–#130: All done
- QA bug fixes batches 1–3: All done
- Batch 4 UX Polish: #192–#198: All done
- Batch 5 Bug Fixes + Home Page: #206–#211: All done
- Batch 6a Contract: #184: All done
- Batch 6b Phase 9 + Cleanup: #185–#190, #218–#220: All done
- Batch 7 Infra + Tech Debt: #233, #230, #231, #232: All done
- Batch 8 Bug Fixes: #238, #239, #240, #248, #250, #251, #252, #255, #257, #259: All done
- Batch 9 Bug Fixes + Genre/Language: #261, #262, #265, #269, #271, #272, #275: All done
- Batch 10 Design Overhaul: #277: Reverted (PR #281)
- Batch 11 Bug Fixes: #267, #268: All done

---

## Tonight's Queue — Bug Fixes (Batch 12)

### 1. plotlink#284 — Brittle wallet rejection detection leaves false recovery intents
**Priority: HIGH**
- `isUserRejection()` only matches a few patterns — non-standard wallets leave false intents in localStorage
- Expand rejection patterns or defer intent persistence until after wallet confirmation
- Branch: `task/284-wallet-rejection-detection`

### 2. plotlink#285 — Recovery retry fails permanently on IPFS upload errors
**Priority: HIGH**
- If IPFS upload fails, recovery banner appears but retry only re-hits indexer, not IPFS
- Either defer intent save until after IPFS success, or include IPFS re-upload in retry flow
- Branch: `task/285-ipfs-retry-recovery`

---

## Blocked (not in queue)

- **#30** Zap Frontend — blocked on $PLOT token creation (#31)
- **#31** P5-OP Operator Tasks — needs $PLOT token on Mint Club
- **#41** Mainnet Deployment — future

---

## Rules

1. Assign ONE ticket at a time to @t3
2. Wait for @t2a AND @t2b to both approve before merging
3. After merge, immediately assign the next ticket
4. Use correct original issue numbers in PR titles (e.g., `[#240]`)
5. **NEVER store keys/secrets in plain text without .gitignore protection**
6. **NEVER hardcode addresses, keys, or sensitive values**
7. **Communicate via AgentChattr MCP chat by tagging agents. Your terminal is NOT visible.**
8. If T3 gets stuck after 2 review rounds, skip that ticket and note it for morning review
9. Do NOT push to main — only merge approved PRs

## Reference

- Dev server: `npm run dev` (localhost:3000)
- Design tokens: `src/app/globals.css`
- Contract constants: `lib/contracts/constants.ts`
- Contract ABI: `lib/contracts/abi.ts`
- Supabase types: `lib/supabase.ts`
- Migrations: `supabase/migrations/`
- Admin auth: `src/app/api/admin/auth.ts`
- CLI status: `packages/cli/src/commands/status.ts`
- Home page: `src/app/page.tsx`
- Current contract: `0xfa5489b6710Ba2f8406b37fA8f8c3018e51FA229`
- Old contracts: `0x6B8d38af1773dd162Ebc6f4A8eb923F3c669605d`, `0x05C4d59529807316D6fA09cdaA509adDfe85b474`
