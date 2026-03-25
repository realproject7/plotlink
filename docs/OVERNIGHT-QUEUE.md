# Assignment Queue — PlotLink (2026-03-25)

> T1: Work through this queue top-to-bottom. Assign ONE ticket at a time to @t3.
> After each PR is merged, assign the next ticket immediately.
> STOP at any OPERATOR GATE.

---

## Completed

- Phase 0–8: All done
- Bug fix batches 1–12: All done
- UX Polish batches: All done
- Contract: StoryFactory + ZapPlotLinkV2 deployed on mainnet
- Font system, Token page, Agent page, Branding, NavBar: All done
- Vercel production deploy + CI/CD: All done
- Farcaster manifest + account association + embed preview: All done
- Base.dev registration + Builder Code: All done
- Operator gate (#480), Launch master (#475): All done
- Batch 13 Farcaster + Mobile Polish: #487–#492 — All done
- Batch 14 Notifications + Profile Page: #499, #501–#504 — All done
- Batch 15 Share Polish + Mobile Fix: #510–#512 — All done
- Batch 16 UX + Infrastructure: #516–#521 — All done
- Batch 17 Story Card + Share Fixes: #529–#531 — All done
- Hotfixes: #500, #528

---

## Tonight's Queue — PLOT Token Launch + Contract Redeploy (Batch 18)

### 1. plotlink#536 — Redeploy StoryFactory with J-curve + real PLOT (T3)
**Priority: CRITICAL**
- Update `DeployBase.s.sol` to use exact prices from `story-token-curve.txt` (J-curve)
- Deploy to Base mainnet with real PLOT token address (provided by T1)
- `DEPLOYER_PRIVATE_KEY` and `BASESCAN_API_KEY` in `plotlink-contracts/.env`
- Set `initialStorylineCount` to skip past existing symbols
- Record new StoryFactory address
- Branch: `task/536-storyfactory-jcurve`

### 2. plotlink#537 — Call setPlotToken() on ZapPlotLinkV2 (T3)
**Priority: CRITICAL**
- Call `setPlotToken(newPlotAddress)` on Zap at `0xAe50C9444DA2Ac80B209dC8B416d1B4A7D3939B0`
- Use `DEPLOYER_PRIVATE_KEY` from `plotlink-contracts/.env`
- Use `cast send` or Foundry script
- Branch: `task/537-set-plot-token`

### 3. plotlink#538 — Update all PL_TEST → PLOT references in plotlink codebase (T3)
**Priority: HIGH**
- Replace PL_TEST address with real PLOT in `lib/contracts/constants.ts` and all references
- Update `RESERVE_LABEL` from `PL_TEST` to `PLOT`
- Update `lib/usd-price.ts` to point to new token
- Branch: `task/538-plot-token-refs`

### 4. plotlink#539 — Update all StoryFactory references to new contract (T3)
**Priority: HIGH**
- Replace old factory address in `lib/contracts/constants.ts`, SDK, env
- Update `DEPLOYMENT_BLOCK` to new deploy block
- Branch: `task/539-factory-address-update`

### 5. plotlink#540 — Verify contracts on Basescan (T3)
**Priority: HIGH**
- Run `forge verify-contract` for new StoryFactory and ZapPlotLinkV2
- `BASESCAN_API_KEY` in `plotlink-contracts/.env`
- Branch: `task/540-basescan-verify`

### --- OPERATOR GATE (after all PRs merged) ---
**T1: Post-deploy verification:**
- Initialize `backfill_cursor` in Supabase with new StoryFactory deployment block
- Create a test storyline on the new contract and verify full flow
- Verify Basescan shows verified source for both contracts

---

## Blocked (not in queue)

- **#340** — Production infrastructure checklist (long-term)

---

## Rules

1. Assign ONE ticket at a time to @t3
2. Wait for @t2a AND @t2b to both approve before merging
3. After merge, immediately assign the next ticket
4. Use correct original issue numbers in PR titles (e.g., `[#536]`)
5. **NEVER store keys/secrets in plain text without .gitignore protection**
6. **NEVER hardcode addresses, keys, or sensitive values**
7. **Communicate via AgentChattr MCP chat by tagging agents. Your terminal is NOT visible.**
8. If T3 gets stuck after 2 review rounds, skip that ticket and note it for morning review
9. Do NOT push to main — only merge approved PRs
10. **Versioning**: T3 bumps patch (3rd digit) in package.json per PR. Minor/major bumps require T1 permission.
11. **Contract keys**: `DEPLOYER_PRIVATE_KEY` and `BASESCAN_API_KEY` are in `plotlink-contracts/.env`

## Reference

- Dev server: `npm run dev` (localhost:3000)
- Contract constants: `lib/contracts/constants.ts`
- Current StoryFactory: `0x337c5b96f03fB335b433291695A4171fd5dED8B0` (to be replaced)
- ZapPlotLinkV2: `0xAe50C9444DA2Ac80B209dC8B416d1B4A7D3939B0` (no redeploy)
- Current PL_TEST: `0xF8A2C39111FCEB9C950aAf28A9E34EBaD99b85C1` (to be replaced by PLOT)
- New PLOT: `0x4F567DACBF9D15A6acBe4A47FC2Ade0719Fb63C4`
- Uniswap V4 PLOT/ETH Pool: `0xd9088610ecda3503edafbfe1dce6807c0736abbe4661032096e116d4985f6538` (1% fee, tick spacing 200)
- Curve data: `~/Library/CloudStorage/Dropbox/Mac/Downloads/plotlink/story-token-curve.txt`
- Contract repo: `~/Projects/plotlink-contracts`
- Domain: `plotlink.xyz`
