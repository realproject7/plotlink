# Assignment Queue — PlotLink (2026-03-15)

> T1: Work through this queue top-to-bottom. Assign ONE ticket at a time to @t3.
> After each PR is merged, assign the next ticket immediately.
> STOP at any OPERATOR GATE.

---

## Completed

- Phase 0–4: All done
- Phase 5: All done (except #30 Zap — blocked on $PLOT)
- Bug fixes #52, #55, #67, #68, #88–#95, #112–#117: All done
- UI polish #104–#107: All done
- Phase 6 Agent Layer #33, #32, #35, #34: All done

---

## Tonight's Queue — Phase 6 Bug Fixes (assign in this exact order)

> Ordered to avoid merge conflicts on shared files (config.ts, claim.ts).

### 1. plotlink#132 — [Bug] .plotlinkrc warning in CLI config

`.plotlinkrc` is already in `.gitignore` (done by operator). But `packages/cli/src/config.ts` needs a runtime warning when loading keys from file.

**Fix:** When config is loaded from `.plotlinkrc`, log to stderr: `"WARNING: Loading keys from .plotlinkrc — ensure this file is in .gitignore and never committed."`

**Merge checklist:**
- [ ] Warning logged to stderr when `.plotlinkrc` is loaded
- [ ] `npm run lint` and `npm run typecheck` pass

### 2. plotlink#137 — [Bug] Silent .plotlinkrc JSON parse errors

Same file `packages/cli/src/config.ts`. JSON parse errors are silently swallowed — users get confusing "Missing private key" instead of a parse error.

**Fix:** Catch JSON parse errors explicitly, log: `"Error parsing .plotlinkrc: <message>. Check your JSON syntax."` Then fall back to env vars.

**Merge checklist:**
- [ ] JSON parse errors logged with helpful message
- [ ] Falls back to env vars after parse failure
- [ ] `npm run lint` and `npm run typecheck` pass

### 3. plotlink#133 — [Bug] CLI: no address validation

`claim` and `agent register` commands cast user input directly to `Address` without validation. Invalid addresses cause confusing RPC errors.

**Fix:** Validate with viem `isAddress()` before casting. Show: `"Invalid address: <input>"`

**Affected:** `packages/cli/src/commands/claim.ts`, `packages/cli/src/commands/agent-register.ts`

**Merge checklist:**
- [ ] `isAddress()` validation in claim and agent-register commands
- [ ] Clear error message for invalid input
- [ ] `npm run lint` and `npm run typecheck` pass

### 4. plotlink#134 — [Bug] CLI: claim shows raw bigint

`packages/cli/src/commands/claim.ts` displays unclaimed amount as raw bigint instead of formatted value.

**Fix:** Use `formatUnits(info.unclaimed, decimals)`. Fetch reserve token decimals same pattern as status command.

**Merge checklist:**
- [ ] Unclaimed amount formatted with `formatUnits()`
- [ ] `npm run lint` and `npm run typecheck` pass

### 5. plotlink#136 — [Bug] CLI: hardcoded "ETH" label and 18 decimals

`packages/cli/src/commands/status.ts` hardcodes "ETH" and 18 decimals. Wrong for USDC or mainnet $PLOT.

**Fix:** Fetch reserve token `symbol()` and `decimals()` via ERC-20 calls. Display actual symbol.

**Merge checklist:**
- [ ] Reserve token symbol and decimals fetched dynamically
- [ ] No hardcoded "ETH" or "18"
- [ ] `npm run lint` and `npm run typecheck` pass

### 6. plotlink#135 — [Bug] Discover page hardcodes genre="fiction"

`src/app/discover/page.tsx` and `src/app/page.tsx` pass `genre="fiction"` to every `StoryCard`. Misleading — no genre field exists in DB.

**Fix:** Remove hardcoded `genre="fiction"` prop. StoryCard should handle missing genre gracefully (don't display it).

**Merge checklist:**
- [ ] Hardcoded genre removed from discover page and home page
- [ ] StoryCard handles missing/undefined genre
- [ ] `npm run lint` and `npm run typecheck` pass

---

## Rules

1. Assign ONE ticket at a time to @t3
2. Wait for @t2a AND @t2b to both approve before merging
3. After merge, immediately assign the next ticket
4. Use correct original issue numbers in PR titles (e.g., `[#132]` not `[#300]`)
5. **NEVER store keys/secrets in plain text without .gitignore protection**
6. **NEVER hardcode addresses, keys, or sensitive values**
7. **Communicate via AgentChattr MCP chat by tagging agents. Your terminal is NOT visible.**
8. If T3 gets stuck after 2 review rounds, skip that ticket and note it for morning review
9. Do NOT push to main — only merge approved PRs

## Reference

- CLI config: `packages/cli/src/config.ts`
- CLI commands: `packages/cli/src/commands/`
- SDK: `packages/sdk/src/`
- Discover page: `src/app/discover/page.tsx`
- Home page: `src/app/page.tsx`
- StoryCard: `src/components/StoryCard.tsx`
