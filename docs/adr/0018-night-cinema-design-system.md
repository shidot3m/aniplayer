# 18. Night cinema: the app's design system

Date: 2026-11-05

Status: accepted

## Context

The app shipped with a stock palette (`#090a0f` ground, rose `#e11d48` accent — the shadcn/Tailwind default), Inter everywhere, and no design direction. The user asked for a redesign with icons and animation, gave five references (Honkai MOTH title card, halftone sign-in, Eldritch fog landing, Perplexity AI, Lumen Index) and one hard requirement: no AI-slop — nothing that could belong to any product. The interview settled the direction from the subject itself: this is a night-time anime player, so its material is the frame and the poster.

## Decision

- **Direction — "night cinema", anchored on Apple TV and Netflix.** Deep graphite ground, surfaces separated by tone steps rather than lines or shadows, full-ink text, quiet chrome. Posters and the playing frame are the only rich visual material; everything around them stays quiet. Catalog is hero-plus-horizontal-rails with card peeking; the Release page is key art plus wide episode rows; the primary button is off-white with dark text. Character words: cinematic, restrained, atmospheric.
- **Dark only.** No light theme, no theme switch. A player and its catalog live in the dark; a light theme would double every screen and dilute the character.
- **Palette — black & white ramp + crimson accent.** The rose default and the earlier amber both left the tree; the palette the user fixed is graphite shadow black (`#1A1A1A` family) with full-white ink and a single crimson `#A4133C`. Crimson fills bars, outlines and current states; small accent text on dark uses a lightened shade (`#E5487A`, measured 4.6:1 on `#1A1A1A`) because the raw crimson is below contrast for text. The primary button is off-white with dark text. No badges, chips or tinted label plates on content — states are expressed by text and tone steps (minimalism is an explicit user requirement). The single exception, set by the same user: floating overlays above the playing frame (skip-opening prompt, quality/speed pickers) use glassmorphism — translucent dark fill, backdrop blur, hairline bright border.
- **Type — one grotesque family.** Inter for the interface and for large display headings (weight 700 reserved for display sizes). Both Apple TV and Netflix anchor on a single sans; a display serif was tried in the mockup and rejected by the user in favor of that anchor. Cyrillic coverage is mandatory — the catalog's Release names are Russian.
- **Signature detail — the timecode.** Playback position, Episode duration and Ordinal are set in one consistent tabular-numeral treatment across the whole interface. It is the one ornament, and it comes from the player itself.
- **Icons — one line set, already chosen.** `lucide-react` stays; one size, one stroke, color of the text role it sits in. No emoji anywhere.
- **Full redesign of screen compositions inside the current stack.** Catalog, Release page and player overlay are recomposed; Tailwind v4, the feature boundaries and the component stack do not migrate.
- **Motion charter.** Player controls surface dozens of times a session — they appear instantly, no entrance animation. Card hover is a fast tone change, no scale. Screen transitions run through a hand-rolled `document.startViewTransition` hook (shared-element poster morph, 250–300 ms, strong ease-out) — **not** `react@canary`, whose `<ViewTransition>` component is not in stable React and is not accepted as a production dependency. Every animation ships with `prefers-reduced-motion` and `hover: hover` gating; no `transition-all`, no springs in UI, no animated layout properties.
- **Delivery in three waves.** (1) tokens + catalog + Release page, (2) player overlay, (3) bookmarks, downloads, settings. A static HTML mockup of the three key screens on real catalog data is built and approved before wave 1 implementation.

## Considered options

- **Keep the rose accent** — rejected: it is the category default, chosen by no one, and reads as the stock component kit the redesign exists to escape.
- **Add a light theme** — rejected: doubles the surface area and works against the night-cinema direction; the references' light screens are admired for their typography and composition, not their luminance.
- **`react@canary` for `<ViewTransition>`** — rejected: a prerelease React in a shipped desktop app to gain one component; the imperative `document.startViewTransition` API is fully available in evergreen WebView2 and is wrapped in a small hook instead.
- **Restyle only (color and type over the current layouts)** — rejected: the user asked for a redesign, and the stock card-grid compositions are half of what reads as generic.

## Consequences

- `src/index.css` becomes the single source of design tokens; downstream code references tokens only.
- The `shared/ui` kit is restyled, not replaced; its component APIs stay, so feature code changes are mostly class-level.
- The aislop gate (`bunx aislop ci`, part of `bun run check`) keeps applying to the new UI unchanged.
- Every visual change is verified against `docs/` discipline: this ADR and the Glossary's Design section are the vocabulary for review; the motion charter is the checklist `animate`'s rules are enforced against.
