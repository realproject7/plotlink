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
- Bug fixes #88–#95: All done
- UI polish #104, #107, #105, #106: All done (nav bar, footer, home page, story page)

---

## Tonight's Queue — UI Bug Fixes (assign in this exact order)

> Ordered to avoid merge conflicts on shared files.

### 1. plotlink#116 — [Bug] Extract truncateAddress to shared utility

Duplicated in `ConnectWallet.tsx`, `StoryCard.tsx`, and `story/[storylineId]/page.tsx`. Extract to `lib/utils.ts` and import from all three.

**Merge checklist:**
- [ ] `truncateAddress` in shared `lib/utils.ts`
- [ ] All 3 components import from shared location
- [ ] `npm run lint` and `npm run typecheck` pass

### 2. plotlink#115 — [Bug] Missing aria-expanded on mobile nav toggle

Add `aria-expanded={mobileOpen}` to the hamburger button in `NavBar.tsx`. Add `aria-hidden="true"` to the `[=]`/`[x]` text spans.

**Merge checklist:**
- [ ] `aria-expanded` added to hamburger button
- [ ] `npm run lint` and `npm run typecheck` pass

### 3. plotlink#114 — [Bug] Footer copyright text below WCAG AA contrast

`text-[10px]` with `text-muted/60` is too faint. Increase to at least `text-xs` and use `text-muted` without opacity modifier.

**Merge checklist:**
- [ ] Copyright text meets WCAG AA contrast (4.5:1)
- [ ] `npm run lint` and `npm run typecheck` pass

### 4. plotlink#117 — [Bug] min-h-screen double-nesting causes 44px scroll

Root layout has `min-h-screen` + `pt-11`. Pages also use `min-h-screen` causing overflow. Remove from individual pages or use `min-h-[calc(100vh-2.75rem)]`.

**Affected:** `create`, `chain`, `dashboard/reader`, `dashboard/writer`, `discover` pages.

**Merge checklist:**
- [ ] No double `min-h-screen` nesting
- [ ] Empty/error states still center vertically
- [ ] `npm run lint` and `npm run typecheck` pass

### 5. plotlink#112 — [Bug] ConnectWallet dead ends on pages

Pages show "Connect your wallet to..." but no inline button since PR #108 moved it to nav. Add back inline `<ConnectWallet />` next to each prompt.

**Affected:** `create`, `chain`, `dashboard/reader`, `dashboard/writer` pages.

**Merge checklist:**
- [ ] All "Connect your wallet" prompts have an actionable inline button
- [ ] `npm run lint` and `npm run typecheck` pass

### 6. plotlink#113 — [Bug] Mobile story page — widgets buried below content

On mobile, sidebar widgets stack below all story content. Users must scroll past the entire story to trade/rate.

**Fix:** Add a sticky action bar on mobile OR reorder key widgets with `order-first lg:order-none`. T3: Use `/frontend-design` skill for this ticket.

**Merge checklist:**
- [ ] Mobile users can access trading/rating without scrolling past full story
- [ ] Desktop layout unchanged
- [ ] `npm run lint` and `npm run typecheck` pass

---

## Rules

1. Assign ONE ticket at a time to @t3
2. Wait for @t2a AND @t2b to both approve before merging
3. After merge, immediately assign the next ticket
4. Use correct original issue numbers in PR titles (e.g., `[#116]` not `[#300]`)
5. If T3 gets stuck after 2 review rounds, skip that ticket and note it for morning review
6. Do NOT push to main — only merge approved PRs
7. STOP at operator gates

## Reference

- Design tokens: `src/app/globals.css`
- Root layout: `src/app/layout.tsx`
- Nav bar: `src/components/NavBar.tsx`
- Footer: `src/components/Footer.tsx`
- Story page: `src/app/story/[storylineId]/page.tsx`
