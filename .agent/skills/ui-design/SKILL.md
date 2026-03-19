---
name: UI Design — Clean, Modern & Premium Interfaces
description: >
  Himpunan aturan dan praktik terbaik untuk menciptakan antarmuka (UI) yang bersih, 
  modern, dan premium. Berdasarkan Vercel Web Interface Guidelines, WCAG 2.2, 
  dan praktik terbaik pengembangan web modern. Mencakup panduan warna, tipografi, 
  spacing (8pt grid), aksesibilitas (ARIA), animasi (Motion), desain komponen, 
  serta optimasi performa desain.
---

# UI Design Skill — Clean, Modern & Premium Interfaces

> **Scope:** Apply these rules whenever generating, reviewing, or refactoring any UI component, page, or layout. This skill enforces production-level quality aligned with Vercel Web Interface Guidelines, WCAG 2.2, and modern web best practices.

---

## 1. Core Design Philosophy

Every UI decision must follow these non-negotiable principles:

- **Premium first.** Every screen should feel intentional, spacious, and polished — not cluttered or rushed.
- **Accessibility is not optional.** Disabled users, keyboard users, and screen-reader users are first-class citizens.
- **Performance is part of design.** Visual choices that hurt performance (layout shift, jank, repaints) are design bugs.
- **Semantic HTML before ARIA.** Use `<button>`, `<a>`, `<label>`, `<table>` natively before reaching for `role` or `aria-*`.
- **Consistency over cleverness.** Stick to a design system; avoid one-off values for spacing, color, and radius.

---

## 2. Color & Contrast

### WCAG 2.2 Contrast Minimums (Level AA)

| Element | Minimum Ratio |
|---|---|
| Body / normal text | **4.5 : 1** |
| Large text (≥ 18pt or ≥ 14pt bold) | **3 : 1** |
| UI components & icons | **3 : 1** |
| Enhanced (AAA) normal text | **7 : 1** |

### Rules

- Prefer **APCA** over WCAG 2 for more accurate perceptual contrast on modern displays.
- `:hover`, `:active`, and `:focus` states must have **more** contrast than the rest state.
- Never rely on color alone — always pair color with a text label or icon for status cues.
- Tint borders, shadows, and text toward the same hue on non-neutral backgrounds (hue consistency).
- Use color-blind-friendly palettes for charts and data visualizations.
- Set `<meta name="theme-color" content="...">` to match the page background for native browser UI alignment.
- On dark themes, set `color-scheme: dark` on `<html>` so scrollbars and native inputs render correctly.

### Shadows

- Use **layered shadows** (ambient + direct light, at least two layers) for depth.
- Combine borders and semi-transparent shadows for crisp, high-clarity edges.

---

## 3. Typography

| Property | Rule |
|---|---|
| Font size | Minimum **16px** for body text; minimum **16px** on mobile inputs to prevent iOS Safari auto-zoom |
| Line height | **1.4 – 1.8** (140–180%) for body text |
| Line length | **60–80 characters** per line max |
| Letter spacing | Tighter on large headings; looser on small uppercase labels (~0.05em) |
| Number columns | `font-variant-numeric: tabular-nums` for all tables, stats, and comparisons |
| Font choice | Geist Sans / Geist Mono (Vercel), or any well-known sans-serif / serif |

### Rules

- Avoid widows and orphans; control line breaks for elegant rag.
- Use curly/typographic quotes (“ ”) — never straight quotes (" ").
- Use the ellipsis character … — never three periods ...
- Use `&nbsp;` for non-breaking spaces in units: `10 MB`, `⌘ + K`.
- Set `scroll-margin-top` on anchor headings to prevent content hiding behind sticky headers.

---

## 4. Spacing & Layout

### Spacing Scale (8-point grid)

Use a consistent spacing scale. The **8px base grid** is the industry standard:

```
4px  → xs   (tight internal padding)
8px  → sm   (compact gaps)
16px → md   (standard padding, card gap)
24px → lg   (section gaps, form groups)
32px → xl   (component separations)
48px → 2xl  (section separations)
64px → 3xl  (page-level whitespace)
```

### Layout Rules

- **Optical alignment** over pixel-perfect geometry — adjust ±1px when perception beats math.
- Every element aligns with **something intentional** (grid, baseline, edge, or optical center). No accidental positioning.
- Use `flex` / `grid` / intrinsic layout — avoid measuring with JS.
- Prefer concentric border radii: child `border-radius` ≤ parent `border-radius`.
- Test responsive layouts at: mobile (375px), tablet (768px), laptop (1280px), ultra-wide (2560px, zoom to 50%).
- Respect safe areas on mobile: use `env(safe-area-inset-*)` CSS variables.
- No excessive scrollbars — fix `overflow` issues; test on Windows (macOS hides scrollbars by default).

---

## 5. Interactions & Accessibility

### Keyboard & Focus

```css
/* Always use :focus-visible — not :focus — to avoid distracting mouse users */
button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px hsl(var(--ring));
}

/* Never remove focus entirely */
button { 
  outline: none; 
} /* DANGEROUS — keyboard users become lost */
```

- All flows must be **keyboard-operable** following WAI-ARIA Authoring Patterns.
- Use **focus traps** in modals/dialogs; return focus to trigger on close.
- Visual hit target matches the interactive zone; if visual element is `< 24px`, expand hit target to `≥ 24px` (mobile: `≥ 44px`).
- Use `tabIndex={0}` and `onKeyDown` (Enter/Space) on custom interactive elements, or — better — use `<button>`.

### Semantic HTML

```tsx
// ✅ Correct: use semantic elements
<button onClick={handleClick}>Submit</button>
<a href="/about">About</a>
<label htmlFor="email">Email</label>

// ❌ Wrong: div soup
<div onClick={handleClick}>Submit</div>
<div onClick={() => navigate("/about")}>About</div>
```

### ARIA Rules

- All icon-only buttons **must** have `aria-label`.
- Hide decorative elements with `aria-hidden="true"`.
- Announce async updates (toasts, inline validation) with `aria-live="polite"`.
- Form controls need `<label>` (or `aria-label`), correct `type`, `name`, and `autocomplete`.
- Use hierarchical `<h1>–<h6>` headings; always include a "Skip to content" link.

---

## 6. Animations & Motion

```css
/* ✅ Respect reduced-motion */
.card {
  transition: transform 0.2s ease, opacity 0.2s ease; /* never: transition: all */
}

@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none;
  }
}
```

- **Always** provide a `prefers-reduced-motion` variant.
- Animate **only** `transform` and `opacity` (GPU-accelerated, no reflow).
- **Never** use `transition: all` — always list specific properties.
- Prefer CSS > Web Animations API > JS libraries (e.g., Motion).
- Animations must be **interruptible** and respond to user input.
- Add show-delay (`~150–300ms`) and minimum visible time (`~300–500ms`) to loading states to prevent flicker.
- Set `transform-box: fill-box; transform-origin: center;` on SVG `<g>` wrappers for cross-browser compatibility.

---

## 7. Components — Premium Patterns

### Buttons

```tsx
<button
  onClick={handleAction}
  aria-label="Save document"          // required if icon-only
  disabled={isPending}
  className={cn(
    "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium",
    "bg-primary text-primary-foreground",
    "transition-colors duration-150",
    "hover:bg-primary/90 active:scale-[0.98]",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    "disabled:opacity-50 disabled:pointer-events-none"
  )}
>
  {isPending ? <Spinner aria-hidden /> : <Icon aria-hidden />}
  {isPending ? "Saving…" : "Save"}     {/* keep original label, add ellipsis */}
</button>
```

### Forms

```tsx
<div className="flex flex-col gap-1.5">
  <label htmlFor="email" className="text-sm font-medium">
    Email address
  </label>
  <input
    id="email"
    type="email"
    name="email"
    autoComplete="email"
    placeholder="you@example.com…"
    inputMode="email"
    className="rounded-lg border px-3 py-2 text-base focus-visible:ring-2"
  />
  {error && (
    <p role="alert" className="text-sm text-destructive">{error}</p>
  )}
</div>
```

- Never block paste (`onPaste={(e) => e.preventDefault()}` is banned).
- Show errors next to their fields; on submit, focus the first error.
- Don't pre-disable submit — surface validation on attempt.
- Warn before navigation when unsaved changes exist.

### Images

```tsx
// ✅ Always include width, height, alt, and lazy loading
<img
  src="/hero.jpg"
  alt="Team working together at Vercel HQ"
  width={1920}
  height={1080}
  loading="lazy"          // below fold
  fetchPriority="high"    // above fold / LCP images only
/>
```

### Large Lists (>50 items)

Use virtualisation to prevent DOM bloat and scroll jank:

```tsx
import { useVirtualizer } from "@tanstack/react-virtual"
// OR: content-visibility: auto; contain-intrinsic-size: 0 50px;
```

---

## 8. Dark Mode & Theming

```html
<!-- Set theme-color to match the page background -->
<meta name="theme-color" content="#0a0a0a" />

<!-- Set color-scheme so native controls (select, scrollbar) render correctly -->
<html style="color-scheme: dark">
```

- Provide **explicit** `background-color` and `color` on native `<select>` elements for Windows dark mode.
- Never hardcode dark-mode colours in JS — use CSS custom properties or Tailwind's `dark:` variant.
- Test dark mode with browser DevTools emulation and a real Windows device.

---

## 9. Performance (Design-Impacting)

| Rule | Implementation |
|---|---|
| No CLS from images | Always set `width` & `height` |
| No CLS from fonts | Preload critical fonts; `font-display: swap` |
| Smooth scrolling | `scroll-behavior: smooth` + `scroll-margin-top` on anchors |
| GPU animations | `transform` + `opacity` only |
| Preconnect CDN | `<link rel="preconnect" href="...">` |
| Avoid layout thrash | Never read + write DOM in the same loop |
| Long tasks off main thread | Move heavy work to Web Workers |

---

## 10. Copywriting (Vercel Standard)

- **Active voice:** "Install the CLI" — not "The CLI will be installed."
- **Title Case** for headings & buttons (Chicago style); sentence case on marketing pages.
- **Specific labels:** "Save API Key" — not "Continue."
- **Positive framing for errors:** "Something went wrong — try again or contact support." — not "Deployment failed."
- **Error messages guide the exit:** tell users how to fix the problem, not just what went wrong.
- Use `&` over `and`; use numerals for counts ("8 deployments", not "eight").
- Separate numbers & units with a non-breaking space: `10 MB`.

---

## 11. Anti-Patterns Checklist

Before committing UI code, verify **none** of these are present:

- ❌ `transition: all` → list specific properties
- ❌ `outline: none` without `focus-visible` → add `focus-visible` ring
- ❌ `<div onClick={...}>` → use `<button>` or `<a>`
- ❌ `<button>` used for navigation → use `<a>` or `<Link>`
- ❌ Icon-only button without `aria-label` → add `aria-label`
- ❌ `<img>` without `width`, `height`, `alt` → add all three
- ❌ `onPaste={(e) => e.preventDefault()}` → remove paste block
- ❌ `user-scalable=no` in `viewport` meta → never disable zoom
- ❌ `autoFocus` on mobile → only `autoFocus` on desktop
- ❌ Hardcoded date/number formats → use `Intl API`
- ❌ Large list (>50) not virtualized → add `react-virtual` or similar
- ❌ Color as the only status indicator → add text label or icon
- ❌ `aria-live` missing on async updates → add `aria-live="polite"`
- ❌ `<input>` missing `label/autocomplete` → add `<label>` and `autocomplete`
- ❌ Gradient banding in dark overlays → use `background-image` mask
- ❌ Non-interruptible animations → make animations cancelable

---

## 12. Quick-Reference: Design Tokens

```css
:root {
  /* Spacing (8pt grid) */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-6:  24px;
  --space-8:  32px;
  --space-12: 48px;
  --space-16: 64px;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Elevation (layered shadows) */
  --shadow-sm: 0 1px 2px rgba(0,0,0,.05), 0 0 0 1px rgba(0,0,0,.04);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,.10), 0 2px 4px -1px rgba(0,0,0,.06);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,.10), 0 4px 6px -2px rgba(0,0,0,.05);

  /* Typography scale */
  --text-xs:   12px;
  --text-sm:   14px;
  --text-base: 16px;
  --text-lg:   18px;
  --text-xl:   20px;
  --text-2xl:  24px;
  --text-3xl:  30px;
  --text-4xl:  36px;
}
```

---

## 13. Trigger Keywords

Gunakan frasa ini untuk mengaktifkan skill ini:

- "Design a UI component"
- "Build a premium interface"
- "Create a clean, modern page"
- "Review my UI for accessibility"
- "Audit this component"
- "Apply web design best practices"

---

*Sources: [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines) · WCAG 2.2 (W3C) · Vercel Geist Design System*
