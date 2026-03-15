# Assignment Queue — PlotLink (2026-03-15)

> T1: Work through this queue top-to-bottom. Assign ONE ticket at a time to @t3.
> After each PR is merged, assign the next ticket immediately.
> STOP at any OPERATOR GATE.

---

## Completed

- Phase 0–4: All done
- Phase 5: All done (except #30 Zap — blocked on $PLOT token)
- Bug fixes #52, #55, #67, #68, #88–#95: All done
- UI polish #104–#107, bug fixes #112–#117: All done

---

## Tonight's Queue — Phase 6: Agent Layer (assign in this exact order)

### 1. plotlink#33 — [P6-2] Writer Type Filter & Agent Badge

**Requirements:**
- Add writer type filter to discover page: "All" (default), "Human only", "Agent only"
- Filter the Supabase query by `writer_type` column (0 = human, 1 = agent)
- Create an agent badge component — show on StoryCard and story page for `writer_type = 1`
- Pass filter as query param (e.g., `?tab=new&writer=agent`)

**Context:** `writer_type` is already stored in the `storylines` table and set by the indexer via `detectWriterType()` in `lib/contracts/erc8004.ts`.

**Merge checklist:**
- [ ] Writer type filter on discover page (All / Human / Agent)
- [ ] Agent badge component on StoryCard and story page
- [ ] `npm run lint` and `npm run typecheck` pass

### 2. plotlink#32 — [P6-1] Agent Registration Wizard (Web)

3-step wizard for registering an AI agent identity via ERC-8004.

**Key context for T3:**
- ERC-8004 registry address: import from `lib/contracts/constants.ts` (`ERC8004_REGISTRY`)
- Existing ABI helper: `lib/contracts/erc8004.ts` (has `agentOf` — will need `register` and `setAgentWallet` added)
- Step 1: Agent profile form (name, description, genre, LLM model) → generate agentURI JSON metadata
- Step 2: Call `register(agentURI)` on registry → returns agentId (NFT)
- Step 3: Agent wallet links via EIP-712 typed data → call `setAgentWallet(agentId, newWallet, signature, deadline)`
- Redirect to create storyline flow on completion

**T3: Use `/frontend-design` skill for the wizard UI.**

**Merge checklist:**
- [ ] 3-step wizard at `/register-agent` route
- [ ] `register` and `setAgentWallet` ABI entries added to `lib/contracts/erc8004.ts`
- [ ] Step 1: profile form generates agentURI metadata JSON
- [ ] Step 2: calls `register()` and shows agentId
- [ ] Step 3: EIP-712 typed data + `setAgentWallet()`
- [ ] Redirects to create flow on completion
- [ ] `npm run lint` and `npm run typecheck` pass

### 3. plotlink#35 — [P6-4] SDK — @plotlink/sdk

TypeScript SDK wrapping all PlotLink operations for programmatic access.

**Requirements:**
- Scaffold as separate package in repo (e.g., `packages/sdk/`)
- Constructor: `new PlotLink({ privateKey, rpcUrl })`
- Core methods: `createStoryline()`, `chainPlot()`, `getStoryline()`, `getPlots()`
- Agent methods: `registerAgent()` wrapping ERC-8004 registration
- Royalty method: `claimRoyalties(tokenAddress)`
- Uses existing ABIs from `lib/contracts/` and Filebase upload from `lib/filebase.ts`
- Bundle with tsup, proper package.json exports

**Merge checklist:**
- [ ] `packages/sdk/` scaffolded with tsup + TypeScript
- [ ] Core methods: createStoryline, chainPlot, getStoryline, getPlots
- [ ] Agent method: registerAgent
- [ ] Royalty method: claimRoyalties
- [ ] `npm run lint` and `npm run typecheck` pass

### 4. plotlink#34 — [P6-3] CLI — plotlink-cli

CLI for agent operators and human writers.

**Requirements:**
- Scaffold as separate package (e.g., `packages/cli/`)
- Commands: `plotlink create`, `plotlink chain`, `plotlink status`, `plotlink claim`, `plotlink agent register`
- Use commander.js or similar for command parsing
- Reads private key + RPC from env vars or config file
- Can use `@plotlink/sdk` if SDK (#35) is merged, otherwise wrap contract calls directly

**Depends on:** #35 (SDK — merged by then)

**Merge checklist:**
- [ ] `packages/cli/` scaffolded with commander.js
- [ ] `plotlink create` — upload to IPFS + createStoryline tx
- [ ] `plotlink chain` — upload to IPFS + chainPlot tx
- [ ] `plotlink status` — query storyline data + token price
- [ ] `plotlink claim` — claimRoyalties tx
- [ ] `plotlink agent register` — ERC-8004 register + setAgentWallet
- [ ] `npm run lint` and `npm run typecheck` pass

---

## Rules

1. Assign ONE ticket at a time to @t3
2. Wait for @t2a AND @t2b to both approve before merging
3. After merge, immediately assign the next ticket
4. Use correct original issue numbers in PR titles (e.g., `[#33]` not `[#300]`)
5. Import contract addresses from `lib/contracts/constants.ts` — do NOT hardcode
6. If T3 gets stuck after 2 review rounds, skip that ticket and note it for morning review
7. Do NOT push to main — only merge approved PRs
8. STOP at operator gates

## Reference

- ERC-8004 registry: `lib/contracts/constants.ts` → `ERC8004_REGISTRY`
- ERC-8004 ABI + detectWriterType: `lib/contracts/erc8004.ts`
- Filebase upload: `lib/filebase.ts`
- Contract ABIs: `lib/contracts/abi.ts`
- Design tokens: `src/app/globals.css`
- Existing components: `src/components/`
