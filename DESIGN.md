# Open AI Stack — design system

The rules for how Open AI Stack looks, reads and behaves. Tokens live in
[`src/app/globals.css`](src/app/globals.css); this file says what they are for.
When code and this file disagree, fix the code, or change this file on purpose
in the same commit.

**Reference direction:** *Night luxury* — a near-black base, one bright green
accent and a premium catalogue feel. Light mode is designed alongside it, not
inverted from it.

---

## 1. Brand

| | |
|---|---|
| **Name** | Open AI Stack (three words; never "OpenAIStack" or "OpenAI Stack") |
| **Headline** | Find your open-source AI stack. |
| **Tagline** | Open-source alternatives to the AI tools you use. |
| **Promise** | Every project publishes its code. Run it yourself, see how it works and keep your data. |

- The headline is the hero only. The tagline goes everywhere else a one-line
  description is needed: page title, metadata, social card, footer, README.
- Say **open-source** for the catalogue as a whole. Where precision matters
  (metadata, legal-ish copy), say **open-source and source-available**, because
  some listings are source-available, not OSI-licensed.
- Frame each tool by what it replaces: "Alternative to ChatGPT". That framing
  is the product.

### Mark

Three stacked plates: a solid top plate over two open ones. The open plates
read as "open"; the solid one as the stack you build.

| Asset | File | Use |
|---|---|---|
| Component | [`brand-mark.tsx`](src/components/aitools/brand-mark.tsx) | Header, footer, admin sidebar. Uses `currentColor`. |
| Favicon | `public/logo.svg` | Accent mark on a `--base` rounded square. |
| Touch icon | `public/apple-touch-icon.png` | 180×180, full square (iOS rounds it). |
| Social card | [`opengraph-image.tsx`](src/app/opengraph-image.tsx) | 1200×630, built at deploy time. Needs `SITE_URL`. |

- The mark is always the accent green on screen, and the accent on `--base` as
  an icon. Never recolour it to a status colour or a gradient.
- Wordmark: the mark plus "Open AI Stack" in the sans, beside it, never stacked.
- All four assets share one geometry, `BRAND_MARK_PATHS`. Change it there and
  regenerate the PNG.

---

## 2. Colour

One neutral ramp, one accent and two status colours. Components use the
semantic Tailwind names below, never raw palette classes (`amber-500`,
`zinc-950`) or hex values. Illustrations in `mockups.tsx` are exempt.

### Surfaces and text

| Token (class) | Role | Dark | Light |
|---|---|---|---|
| `base` | Page canvas (60%) | `#0a0c0b` | `#f2f5f2` |
| `surface` | Header, footer, large sections | `#0e1310` | `#e9efea` |
| `card` | Cards, inputs | `#121714` | `#ffffff` |
| `elev` | Raised and hover fills | `#1a221d` | `#e7ede8` |
| `line` | Hairline borders, dividers | `#232d27` | `#dce4dd` |
| `line2` | Stronger borders | `#323e37` | `#c8d3ca` |
| `ink` | Headings, primary text | `#fafafa` | `#09090b` |
| `ink2` | Secondary strong text | `#d4d4d8` | `#27272a` |
| `mute` | Body copy, descriptions | `#a1a1aa` | `#52525b` |
| `faint` | Meta, captions, placeholders | `#8a8a93` | `#66666e` |

Surfaces step **page → card → elev**, separated by tone and a `line` hairline.

### Accent (10%)

| Token (class) | Role | Dark | Light |
|---|---|---|---|
| `accent` | Fills: primary button, selected state, brand mark, focus ring | `#4ade80` | `#15803d` |
| `accent-foreground` | Text on an `accent` fill | `#0a0c0b` | `#ffffff` |
| `accent-text` | Accent-coloured **text** on any surface or tint | `#4ade80` | `#166534` |
| `accent-soft` | Tint behind selected chips and success notes | 11% accent | 10% accent |

- Text on an accent fill is always `text-accent-foreground`.
- Accent-coloured text is always `text-accent-text`, never `text-accent`, and
  never with an opacity modifier (`/60`, `/80`).
- **One loud accent per screen.** The fill marks the primary action (Submit)
  and the selected state. Everything else stays neutral. Data (trend bars,
  weekly gains) is neutral, with at most the top item in accent.

### Status

| Token (class) | Meaning | Dark | Light |
|---|---|---|---|
| `warning` | A state that needs attention but is not a failure: "In progress", "Source-available" | `#f59e0b` | `#92400e` |
| `destructive` | Errors, failed actions, invalid fields, destructive buttons | `#f87171` | `#b91c1c` |

- A colour means one thing. Errors are never amber; success is the accent.
- Tinted notes use the colour at 10% for the fill, 25–40% for the border and
  the solid colour for text: `border-destructive/30 bg-destructive/10 text-destructive`.
- Colour never carries meaning alone. Pair it with an icon or words.

### Contrast floor (both themes)

| Pair | Minimum |
|---|---|
| Body and control text | 4.5:1 |
| Text at 24px+, or 18.67px+ bold | 3:1 |
| Icons, input borders, focus rings | 3:1 |

Measure the colour as rendered, over the surface it actually sits on, with any
opacity blended in. Every pair in the tables above meets the floor.

---

## 3. Typography

**Geist** (sans) for everything, **Geist Mono** for code, repository slugs,
numbers in tables, keyboard hints and column headers. Both load through
`next/font` in [`layout.tsx`](src/app/layout.tsx).

### Scale

Use these steps. Do not add new pixel sizes.

| Step | Class | Use |
|---|---|---|
| Display | `text-5xl sm:text-6xl md:text-7xl` | The Discover hero only |
| Title XL | `text-4xl` | Page `<h1>` |
| Title L | `text-3xl` | Feature-block `<h2>` |
| Title | `text-2xl` | Section `<h2>` |
| Title S | `text-lg` | Card titles |
| Lede | `text-[15px]` | Page intros, subheads |
| Body | `text-sm` (14px) | Body copy and controls |
| Small | `text-[13px]` | Meta rows, chips, secondary controls |
| Caption | `text-xs` (12px) | Captions, helper text |
| Label | `text-[11px]` mono | Table column headers, kbd hints |

- **Weight:** headlines aim for `font-medium` to `font-semibold`; size makes the
  hierarchy, not boldness. Body is regular; buttons and names are `font-medium`
  or `font-semibold`. Nothing under 18px is lighter than 400.
- **Headlines:** `tracking-tight`, `text-balance`, three lines or fewer at
  desktop width.
- **Paragraphs:** `text-pretty`, `leading-relaxed`, measure capped at
  `max-w-xl` (about 65 characters).
- **Numbers:** stars, votes and gains use the mono face so digits line up.
- **Case:** sentence case for headings, buttons and labels. Uppercase is only
  for mono column headers in data tables, at one tracking: `tracking-[0.16em]`.
- Use the real ellipsis `…`, never `...`.

---

## 4. Shape and space

### Radius

| Class | Size | Use |
|---|---|---|
| `rounded-full` | pill | Chips, tags, nav pills, avatars, round icon buttons |
| `rounded-2xl` | 16px | Top-level cards and sections |
| `rounded-xl` | 14px | Dialogs, media frames, panels nested in a card |
| `rounded-lg` | 10px | Buttons, inputs, list rows, notes |
| `rounded-md` | 8px | Small badges, keyboard hints, icon tiles |

Nothing else. One-sided radii (`rounded-t-*`) are allowed only where a shape
attaches to another, like a screenshot frame sitting on a card edge.

### Layout

- Content width `max-w-6xl` with `px-5` gutters; reading pages (submit, post)
  narrow to `max-w-3xl`.
- Sticky header, `h-14`. The mobile nav wraps to a second row rather than
  scrolling links off-screen.
- Section rhythm: `pt-14` to `pt-20` between Discover sections; space inside a
  group is at most half the space between groups.
- Every view has one primary action. Secondary actions are neutral buttons.

### Elevation

Borders for structure, shadows only for things that float: the search dialog,
menus, device mockups. Cards are flat.

---

## 5. Imagery

- Tool logos come from each project. When none loads, the fallback tile is
  neutral; prefer a monogram over an emoji.
- Screenshots are real, taken from each project's own README, and captioned
  with their source. Illustrations are labelled "Illustration, not a product
  screenshot". Never present an illustration as product imagery.
- No abstract blobs or gradient filler. The dotted `.dotgrid` texture is the
  only decorative background.

---

## 6. Motion

| Class | What | Timing |
|---|---|---|
| `animate-rise` | View enter | 350ms, `cubic-bezier(0.21, 0.6, 0.35, 1)` |
| `animate-pop` | Dialog enter | 180ms, same curve |
| `animate-bar` | Trend bar fill | 800ms |
| `animate-dot` | "New" indicator pulse | 2.4s loop |

- Hover and state changes: `transition-colors`, never `transition-all`.
- `prefers-reduced-motion: reduce` turns every animation off and cuts
  transitions to near zero (see the end of `globals.css`). New animations join
  that block.
- Motion is never the only feedback; every state change also changes colour,
  icon or text.

---

## 7. Interaction and accessibility

- **Focus:** keyboard focus draws a 2px solid `--ring` (accent) outline with a
  2px offset. Never remove it without a visible replacement. View headings take
  programmatic focus on navigation and draw no ring.
- **Navigation:** a view change retitles the tab ("Blog — Open AI Stack") and
  moves focus to the new `<h1>`. The current nav item carries
  `aria-current="page"` on desktop and mobile.
- **Dialogs** are native `<dialog>` opened with `showModal()`: the page behind
  goes inert, Escape closes, focus returns to the opener.
- **Search** is a combobox: focus stays in the input, arrow keys move
  `aria-activedescendant` through a listbox of options.
- **Shortcuts** show the platform's own key: "⌘K" on Apple, "Ctrl K" elsewhere
  (`useSearchShortcut()`).
- **Inputs** are 16px below the `sm` breakpoint so iOS does not zoom.
- **Targets:** at least 24×24px; icon buttons are 32px.
- Everything works at 320px wide with no horizontal page scroll.

---

## 8. Voice

- Plain and direct. Verbs first on buttons: "Submit a project", "Request an
  alternative", "Explore by category".
- Errors say what happened and what to do next. No "Oops", no exclamation
  marks.
- Dates that age, like the GitHub Trending snapshot, are always stated.
- Never imply a source the content does not have.

---

## 9. Known gaps

Where the code does not yet follow these rules. Fix in place and delete the
line.

- **Headline weight:** 11 headings use `font-extrabold`, including the hero.
- **Type scale:** one-off sizes remain outside the illustrations:
  `text-[9px]`, `[12px]`, `[16px]`, `[17px]`, `[20px]`, `[22px]` and `[40px]`
  in `ui.tsx`, `md.tsx`, `post.tsx`, `blog.tsx`, `wanted.tsx`, `ad-slot.tsx`
  and `image-upload.tsx`.
- **Uppercase labels:** about 26 mono eyebrows above headings, at four
  different trackings (0.16, 0.18, 0.2, 0.22em).
- **Radius:** `rounded` (4px), `rounded-sm`, `rounded-[5px]` and
  `rounded-[7px]` are still in use.
- **Accent volume:** Discover's trending table colours every bar and gain.
- **Input borders:** fields use `line` or `line2` (1.2–1.6:1); the plan is to
  move `--input` to about 3.3:1 and use `border-input`.
- **Star icon:** `amber-400` measures 1.72:1 on white in light mode.
- **Emoji fallback tiles** for tools without a logo.
- **Tokens:** the unused shadcn `:root` / `.dark` blocks and
  `@custom-variant dark` in `globals.css`; `card` and `card2` alias the same
  colour; light-mode `::selection` still uses the old accent.
