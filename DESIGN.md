# DESIGN.md

Design direction for KuletXAI. This file describes what the interface already is, taken from `src/index.css` and `src/components/`. Treat it as data for UI work: follow it when adding screens, and change it in the same commit when the design changes.

## Identity

KuletXAI is an operator's console for a squad of agents. The look is a bright game-lobby HUD: a daytime sky, slanted plates, italic display type, and round dock orbs. It should feel like a place you check in to, with a clock and a squad, and less like an admin panel.

Personality: brisk, a little playful, precise about money and status. The product speaks as an operator would. The assistant in the console is ARONA.

If the name and logo were removed, these should still identify it:

- Every plate, button, tag, and input leans about 10 degrees (`skewX`), with the text counter-skewed upright.
- Cards have an asymmetric radius (`6px 22px 8px 22px`), never four equal corners.
- Shadows are hard offsets (`4px 4px 0`), not soft blurs.
- Headings are heavy italic Exo 2 with tight tracking.

## Color

Tokens live on `:root` in `src/index.css`. Use the tokens. Do not add a hex value in a component.

| Token | Day | Role |
|---|---|---|
| `--sky-0` / `--sky-1` / `--sky-2` | `#e7f3ff` / `#f5f9ff` / `#c5e4ff` | Page background gradient |
| `--cyan` / `--cyan-2` / `--cyan-3` | `#128afa` / `#2cb4ff` / `#4ac8ff` | Primary action, links, progress |
| `--navy` / `--navy-2` | `#1f3b5e` / `#12304f` | Ribbons, dark plates, inputs, code blocks |
| `--yellow` | `#ffd84d` | Attention: something needs the operator |
| `--alert` | `#ff4d6a` | Failure and destructive actions |
| `--ok` | `#1aa36a` | Success |
| `--copper` | `#d4924a` | Negative deltas, secondary warm accent |
| `--ink` / `--muted` | `#16324f` / `#5c7692` | Body text / secondary text |
| `--panel` / `--panel-solid` | white at 90% / `#ffffff` | Card surface |
| `--line` | navy at 12% | Hairlines between rows |

Color carries meaning, so keep the meanings fixed:

- Cyan is the one primary action on a surface.
- Yellow means "waiting on you". Do not use it for decoration.
- Navy is the neutral dark. White text sits on navy, never on cyan gradients' light end.
- Status tags use the pale pairs already defined: `.tag.ok` (`#d8ffe9` on `#0d6b40`) and `.tag.bad` (`#ffe0e6` on `#a11432`).

### Night theme

`html[data-theme="night"]` swaps the sky, panel, ink, muted, line, and shadow tokens. Accent colors stay the same. Any new tinted surface needs a night value (see `.step.tool` for the pattern). Check both themes before shipping.

## Typography

| Token | Family | Used for |
|---|---|---|
| `--display` | Exo 2, italic, weight 800 | h1 to h3, stats, buttons, ribbons, tags |
| `--body` | Outfit | Paragraphs, labels, table cells |
| `--mono` | IBM Plex Mono | Kickers, ids, paths, tool names, JSON |

- `h1`: `clamp(36px, 4vw, 54px)`, tracking `-0.04em`, line height `0.9`.
- Stats: `clamp(32px, 3vw, 44px)` with tabular numerals.
- Kicker: mono, 11px, uppercase, tracking `0.16em`, muted. One per page, above the title, stating context the title does not.
- Body copy is 14 to 16px at line height 1.45, capped near 46rem.

Fonts are self-hosted through `@fontsource`. Do not add a font from a CDN.

## Shape, depth, and background

- Lean: `skewX(-8deg)` to `skewX(-12deg)` on the plate, the opposite on its child `span`.
- Card: `--panel` with `backdrop-filter: blur(14px)`, the asymmetric radius, and a two-part shadow (soft drop plus a `5px 5px 0` cyan offset).
- Blur is reserved for surfaces that float over the sky: cards, the dock, sheets.
- Background: a vertical sky gradient, a cyan glow top right, a yellow glow bottom left, and a fading dot pattern. It belongs to the page. Do not repeat it inside cards.

## Layout

- `.main` is capped at 1380px with 22px side padding, 92px top (fixed top bar) and 168px bottom (fixed dock).
- `.stack` for vertical rhythm (14px), `.grid-2` (1.4fr / 1fr) and `.grid-3` for columns.
- One breakpoint at 980px collapses every grid to a single column and trims the top bar.
- Navigation: the dock holds the seven primary rooms. Everything else is in the Menu sheet. A room only appears in either place once it exists.

## Components

Defined in `src/components/ui.tsx` and `src/index.css`. Reuse these before writing a new one.

| Component | Class | Notes |
|---|---|---|
| `Page` | `.page-head` | Kicker, h1, one-line sub, optional action. Slides in from the right. |
| `Card` | `.card` | The only container surface. |
| `Ribbon` | `.ribbon` | Section label inside a card. Tones: default navy, `yellow`, `cyan`, `alert`. |
| `Button` | `.btn` | Tones: default cyan, `navy`, `yellow`, `ghost`, `alert`. `small` for table rows. |
| Tag | `.tag` | Status word in caps. Default yellow, `ok`, `bad`, `navy`. |
| Chip | `.chip` | Segmented toggles. |
| `Meter` | `.bar` | Skewed progress bar. |
| Inputs | `.composer`, `.search-input`, `.field` | Navy skewed plate for single-line asks, flat `.field` for forms. |
| Table | `.table` | Small caps headers, hairline rows. |
| `Modal`, sheets | `.sheet` | Close on Escape. |
| JSON | `.json-view` | Navy block, mono 11px, scrolls inside itself. |
| Chat | `.bubble` | Agent left, operator right in navy. |
| Run trace | `.trace`, `.step` | One block per step. A step waiting on approval turns yellow. |

Icons are the hand-drawn set in `src/components/Glyph.tsx` (24px grid, 1.8 stroke). Add to that file. Do not import an icon library.

## Motion

Motion uses the `motion` package. It marks arrival and confirms a press, nothing else.

- Page enter: spring, stiffness 420, damping 32, mass 0.7, from 28px right.
- Press: `whileTap` scale 0.96 on buttons.
- Meters and counters ease with `cubic-bezier(0.16, 1, 0.3, 1)` (`--ease`).
- `prefers-reduced-motion` turns off the ambient sparkles and the ARONA pulse, and `Page` skips its entrance. New motion has to respect it too.

## Voice

- Short declarative sentences. Say what a control does and what state the system is in.
- Rooms have names (Lobby, Dream, Craft, Cortex, Archive, Patrol). Use the name, with the plain word as the sub-label.
- Be honest about demo data: say "demo", "scripted", or "not connected" on the surface where it applies.
- No invented statistics, testimonials, or security claims. Seeded figures are labeled as seeded.
- No em dashes in interface text. Use a comma, a colon, or a full stop.

## Rules for new screens

1. Every screen that loads data has a loading state (`Loading`), an error state with retry (`ErrorNote`), and an empty state that says what to do next.
2. Every control does something. If it cannot yet, leave it out.
3. Text meets WCAG AA contrast (4.5:1 body, 3:1 large) in both themes.
4. Everything works from the keyboard. Focus uses the global `:focus-visible` ring (2px cyan, 3px offset). Do not remove it.
5. Tap targets for new controls are at least 44px tall. The older `.btn` (38px) and `.btn.small` (30px) are below that and are a known gap to fix.
6. No horizontal scroll at 390px wide. Long ids and paths wrap or truncate.
7. Anything an agent wants to change is shown to the operator in full before it happens, in the yellow "needs you" treatment.

## Operator switchboard

The lobby route diagram, dock Routes button, search icon, `/`, and Ctrl/Cmd+K open the same task directory. The three numbered transit lines group rooms by intent: Delegate, Investigate, Operate. Label every stop with a task first and the room name second. Room matching stays local; record search uses the Worker. The switchboard navigates only and never executes a task.
