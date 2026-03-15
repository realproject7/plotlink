# Assignment Queue — PlotLink (2026-03-15)

> T1: Work through this queue top-to-bottom. Assign ONE ticket at a time to @t3.
> After each PR is merged, assign the next ticket immediately.
> STOP at any OPERATOR GATE.

---

## Completed

- Phase 0–4: All done
- Phase 5: All done (except #30 Zap — blocked on $PLOT)
- Bug fixes: #52, #55, #67, #68, #88–#95, #112–#117, #132–#137: All done
- UI polish #104–#107: All done
- Phase 6 Agent Layer #33, #32, #35, #34: All done

---

## Tonight's Queue — Bug Fix + Phase 7 + P8-1 (assign in this exact order)

### 1. plotlink#144 — [Bug] CLI: royalty formatting uses storyline token decimals instead of reserve token

`claim.ts` and `status.ts` fetch `decimals()` from the storyline token, but royalties are denominated in the **reserve token**.

**Fix:** Use `tokenBond()` to get `reserveToken` address, then fetch `decimals()` and `symbol()` from the reserve token.

**Affected:** `packages/cli/src/commands/claim.ts`, `packages/cli/src/commands/status.ts`

**Merge checklist:**
- [ ] Both commands read decimals/symbol from reserve token via `tokenBond()`
- [ ] `npm run lint` and `npm run typecheck` pass

### 2. plotlink#36 — [P7-1] Mini App Manifest & SDK Setup

Set up PlotLink as a Farcaster mini app.

**Requirements:**
- Install `@farcaster/miniapp-sdk` and `@farcaster/miniapp-wagmi-connector`
- Create manifest at `public/.well-known/farcaster.json` with `homeUrl`
- Add mini app detection — check if running inside Farcaster client
- Call `sdk.actions.ready()` on mount when in mini app context

**Reference docs:** https://miniapps.farcaster.xyz/llms-full.txt

**Merge checklist:**
- [ ] `@farcaster/miniapp-sdk` installed
- [ ] Manifest at `public/.well-known/farcaster.json`
- [ ] Mini app detection + `sdk.actions.ready()` call
- [ ] `npm run lint` and `npm run typecheck` pass

### 3. plotlink#37 — [P7-2] Farcaster Wallet Integration

Add Farcaster wallet connector alongside existing wallets.

**Requirements:**
- Add Farcaster wagmi connector from `@farcaster/miniapp-wagmi-connector`
- Auto-detect context: use Farcaster provider when in mini app, regular wallets otherwise
- Integrate into existing wallet setup in `src/app/providers.tsx`

**Depends on:** #36 (miniapp SDK installed)

**Merge checklist:**
- [ ] Farcaster wagmi connector added to providers
- [ ] Auto-detection works (Farcaster context vs standalone)
- [ ] Existing wallet connection still works outside Farcaster
- [ ] `npm run lint` and `npm run typecheck` pass

### 4. plotlink#38 — [P7-3] Social Sharing & Embed Meta Tags

Share stories to Farcaster + rich embed previews.

**Requirements:**
- "Share to Farcaster" button on story pages — calls `sdk.actions.composeCast()` with story URL
- `fc:miniapp` meta tags on story pages via Next.js metadata API
- Meta tags: title, description, image (3:2 ratio showing story title, writer, plot count)
- Dynamic OG image generation for story pages

**T3: Use `/frontend-design` skill for the share button.**

**Depends on:** #36 (miniapp SDK)

**Merge checklist:**
- [ ] Share button on story page calls `composeCast()`
- [ ] `fc:miniapp` meta tags on story pages
- [ ] OG image with story metadata
- [ ] `npm run lint` and `npm run typecheck` pass

### 5. plotlink#39 — [P7-4] Farcaster Identity Display

Show Farcaster profile data (username, avatar) for writers.

**Requirements:**
- Detect Farcaster FID from connected wallet
- Fetch profile data (username, avatar) from Farcaster API
- Display on story pages and dashboards where writer address is shown
- Graceful fallback: if no FID found, show truncated address as before
- Not required for functionality — display only

**Merge checklist:**
- [ ] FID detection from wallet address
- [ ] Profile fetch (username, avatar)
- [ ] Displayed on story pages and writer dashboard
- [ ] Fallback to truncated address when no Farcaster identity
- [ ] `npm run lint` and `npm run typecheck` pass

### 6. plotlink#40 — [P8-1] Content Moderation (MVP)

Admin API for hiding content + audit frontend queries.

**Requirements:**
- `POST /api/admin/hide` — toggle `hidden = true` on storylines or plots
- `POST /api/admin/unhide` — toggle `hidden = false`
- Protect with admin API key check (read from `ADMIN_API_KEY` env var)
- Use service role client for writes (bypasses RLS)
- Audit all frontend Supabase queries to ensure they filter `hidden = true`

**Merge checklist:**
- [ ] Admin hide/unhide API routes created
- [ ] Protected by API key check
- [ ] Uses service role client
- [ ] All frontend queries confirmed to filter `hidden = true`
- [ ] `npm run lint` and `npm run typecheck` pass

---

## Rules

1. Assign ONE ticket at a time to @t3
2. Wait for @t2a AND @t2b to both approve before merging
3. After merge, immediately assign the next ticket
4. Use correct original issue numbers in PR titles (e.g., `[#144]` not `[#300]`)
5. **NEVER store keys/secrets in plain text without .gitignore protection**
6. **NEVER hardcode addresses, keys, or sensitive values**
7. **Communicate via AgentChattr MCP chat by tagging agents. Your terminal is NOT visible.**
8. If T3 gets stuck after 2 review rounds, skip that ticket and note it for morning review
9. Do NOT push to main — only merge approved PRs

## Reference

- CLI commands: `packages/cli/src/commands/`
- SDK: `packages/sdk/src/`
- Providers: `src/app/providers.tsx`
- Story page: `src/app/story/[storylineId]/page.tsx`
- Design tokens: `src/app/globals.css`
- Farcaster mini app docs: https://miniapps.farcaster.xyz/llms-full.txt
