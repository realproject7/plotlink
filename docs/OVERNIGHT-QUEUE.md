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
- Bug fixes #88–#95: All done (verifyMessage, comment binding, pagination, decimals, multicall, ISR cache, rising threshold, address CHECK)

---

## Tonight's Queue — UI Polish (assign in this exact order)

> T3: Use `/frontend-design` skill for ALL tickets in this batch. Design quality is critical.
> Design direction: Terminal/hacker aesthetic — dark background (#0a0a0a), monospace font (Geist Mono), green accent (#00ff88). Design tokens in `src/app/globals.css`.

### 1. plotlink#104 — [P4.5-1] Global navigation bar

Add a persistent nav bar to the root layout so users can navigate between pages from anywhere.

**Requirements:**
- Fixed/sticky top nav bar with terminal aesthetic
- Logo "PlotLink" (links to home)
- Nav links: Discover, Create, Writer Dashboard, Reader Dashboard
- Wallet connect button — move `<ConnectWallet />` from individual pages into nav
- Remove duplicate `<ConnectWallet />` from `page.tsx`, `discover/page.tsx`, etc.
- Mobile responsive (hamburger or compact layout)
- Active page indicator, clean hover states

**Implementation:**
- Create `src/components/NavBar.tsx`
- Add to `src/app/layout.tsx`
- Remove `<ConnectWallet />` from all individual pages that currently render it

**Merge checklist:**
- [ ] `NavBar` component created with all nav links
- [ ] Added to root `layout.tsx`
- [ ] `ConnectWallet` moved into nav, removed from individual pages
- [ ] Mobile responsive
- [ ] `npm run lint` and `npm run typecheck` pass

### 2. plotlink#107 — [P4.5-4] Footer component

Add a minimal footer to the app layout.

**Requirements:**
- Terminal-styled footer, minimal and not heavy
- Links: Discover, Create, GitHub repo
- "Built on Base" text
- Copyright / project name
- Applied in `src/app/layout.tsx` (below `{children}`)

**Implementation:**
- Create `src/components/Footer.tsx`
- Add to `src/app/layout.tsx`

**Merge checklist:**
- [ ] `Footer` component created
- [ ] Added to root layout
- [ ] `npm run lint` and `npm run typecheck` pass

### 3. plotlink#105 — [P4.5-2] Home page — compact hero + storyline feed

Replace the placeholder home page with a content-first design.

**Design intent (from operator):**
> I want users to see the storylines that are created with just a compact hero area on the top so that they won't need to read to understand what PlotLink is. Via visiting the home page, they can instantly feel/understand what this is about.

**Requirements:**
- **Compact hero** (max ~120px height): PlotLink title + one-line tagline. NOT a full-screen splash.
- **Storyline feed below the hero**: Show recent/active storylines immediately — reuse `StoryCard` component
- Feed should show newest storylines first, with a "Trending" section if data exists
- Each card links to `/story/[storylineId]`
- "View all" link to `/discover`
- If no storylines exist yet, show a compelling empty state with CTA to create the first story
- Content-first: the storyline cards ARE the page, hero is just context

**Implementation:**
- Rewrite `src/app/page.tsx`
- Fetch storylines server-side (same pattern as `discover/page.tsx`)
- Reuse existing `StoryCard` component

**Depends on:** #104 (NavBar merged, so no duplicate ConnectWallet)

**Merge checklist:**
- [ ] Compact hero section (title + tagline, not full-screen)
- [ ] Recent storylines feed using `StoryCard`
- [ ] "View all" link to `/discover`
- [ ] Empty state with CTA to create
- [ ] `npm run lint` and `npm run typecheck` pass

### 4. plotlink#106 — [P4.5-3] Story page layout polish

Polish the story reading page for a cohesive experience now that all widgets exist.

**Requirements:**
- Story content is the primary focus — reading experience first
- Logical widget layout: trading widget, price chart, ratings, donations organized in sidebar or below-content area
- Story metadata header: title, writer address, plot count, token price, average rating
- Mobile responsive — widgets stack vertically on small screens
- Consistent spacing and terminal aesthetic

**Merge checklist:**
- [ ] Story content is the primary focus area
- [ ] Widgets organized logically (not just stacked randomly)
- [ ] Mobile responsive layout
- [ ] `npm run lint` and `npm run typecheck` pass

---

## Rules

1. Assign ONE ticket at a time to @t3
2. Wait for @t2a AND @t2b to both approve before merging
3. After merge, immediately assign the next ticket
4. Use correct original issue numbers in PR titles (e.g., `[#104]` not `[#300]`)
5. T3: Use `/frontend-design` skill for all tickets in this batch
6. If T3 gets stuck after 2 review rounds, skip that ticket and note it for morning review
7. Do NOT push to main — only merge approved PRs
8. STOP at operator gates

## Reference

- Design tokens: `src/app/globals.css` (CSS custom properties)
- Root layout: `src/app/layout.tsx`
- Home page: `src/app/page.tsx`
- Discover page: `src/app/discover/page.tsx`
- Story page: `src/app/story/[storylineId]/page.tsx`
- Existing components: `src/components/` (StoryCard, TabNav, ConnectWallet, etc.)
