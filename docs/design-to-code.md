# Design to Code Workflow

How to turn screenshots and mockups into production components using Claude Code.

---

## Setup

Save design screenshots to `docs/designs/`. Use descriptive names:

```
docs/designs/
  login-page.png
  orders-table.png
  sidebar-nav.png
  vehicle-card-mobile.png
  dashboard-desktop.png
```

Naming convention: `<what>-<variant>.png`
- `what` — component or page name
- `variant` (optional) — `mobile`, `desktop`, `hover`, `empty`, `loading`, `error`

---

## Workflow

### Step 1: Drop the screenshot

Save the screenshot to `docs/designs/` or anywhere in your project. Claude Code can read images from any path.

### Step 2: Pick the right prompt

Use one of the templates below depending on what you're building. The key is to tell Claude **where the component goes** in the architecture and **what it should reuse**.

### Step 3: Iterate

If the first result isn't pixel-perfect, take a screenshot of what Claude generated and paste both:

```
Here's the original design: docs/designs/sidebar-nav.png
Here's what you generated: docs/designs/sidebar-nav-current.png

Fix the differences: <describe what's wrong>
```

---

## Prompt Templates

### Full page from screenshot

```
Look at the screenshot: docs/designs/<filename>.png

Build this as a page at app/(protected)/<route>/page.tsx (or app/(public)/<route>/page.tsx).

Requirements:
- Break the page into components. Each distinct section should be its own component.
- Reusable pieces (buttons, inputs, badges) should use existing shared/ui components or create new ones there.
- Page-specific components go in features/<feature>/ui/.
- Use Tailwind CSS only. Match the screenshot's spacing, colors, typography as closely as possible.
- Use our existing Tailwind config: Inter font, accent color #10B981.
- Mobile-responsive: the screenshot shows <mobile|desktop>. Add responsive breakpoints for the other.
- If the page needs data, create a React Query hook in features/<feature>/model/.
- If it's a protected page, call requireSession() and add the route to middleware.ts.
```

### Single component from screenshot

```
Look at the screenshot: docs/designs/<filename>.png

Create this as a component called <ComponentName>.

Where it lives:
- If reusable across features → shared/ui/<ComponentName>/
- If feature-specific → features/<feature>/ui/<ComponentName>.tsx

Requirements:
- Tailwind CSS only. Match the visual design exactly.
- Extract props from what varies in the design (text, counts, status, callbacks).
- Type all props with an interface.
- If it has interactive states (hover, active, disabled), implement them.
- If the screenshot shows multiple variants, support them via a `variant` prop.
- Export from the appropriate index.ts.
```

### Component with multiple states

```
Look at these screenshots:
- Default state: docs/designs/<name>-default.png
- Hover state: docs/designs/<name>-hover.png
- Loading state: docs/designs/<name>-loading.png
- Empty state: docs/designs/<name>-empty.png
- Error state: docs/designs/<name>-error.png

Create a component <ComponentName> in features/<feature>/ui/ that handles all these states.

Requirements:
- Props should include the state or derive it from data (isLoading, error, items.length === 0).
- Match each screenshot for its respective state.
- Tailwind CSS only. Use transitions between states where appropriate.
```

### Responsive design (mobile + desktop screenshots)

```
Look at both screenshots:
- Mobile: docs/designs/<name>-mobile.png
- Desktop: docs/designs/<name>-desktop.png

Create this as <ComponentName> in <location>.

Requirements:
- Mobile-first approach. Base styles match the mobile screenshot.
- Use Tailwind breakpoints (sm, md, lg) to transition to the desktop layout.
- Identify what changes between mobile and desktop: layout direction, visibility, spacing, font sizes.
- Don't duplicate markup. Use responsive utility classes on the same elements.
```

### Extract a design system component

```
Look at the screenshot: docs/designs/<filename>.png

I see a <button|card|badge|input|modal|...> pattern repeated in this design. Extract it as a reusable shared component.

Create: shared/ui/<ComponentName>/
  <ComponentName>.tsx
  index.ts

Requirements:
- Analyze all visual variants visible in the screenshot.
- Create a `variant` prop for visual variants (e.g., primary/secondary/ghost).
- Create a `size` prop if sizes differ (sm/md/lg).
- Follow the same pattern as shared/ui/Button/Button.tsx.
- Use Tailwind CSS only. Match colors and spacing from the screenshot.
- Support className override prop for one-off tweaks.
```

### Recreate a layout/shell

```
Look at the screenshot: docs/designs/<filename>.png

This is the app shell / layout. Create it as a layout component.

Identify these regions:
- Header/navbar (if present)
- Sidebar (if present)
- Main content area
- Footer (if present)

Requirements:
- Create the layout in app/(protected)/layout.tsx (or the appropriate route group).
- Each region should be a separate component in shared/ui/ if reusable, or inline if simple.
- The main content area renders {children}.
- If the sidebar is collapsible, make it a "use client" component with local state.
- Responsive: sidebar collapses to hamburger menu on mobile.
- Tailwind CSS only.
```

---

## Tips for better results

### Annotate your screenshots

Before sending to Claude, annotate the screenshot (use Preview, Figma, or any tool):
- Circle areas that are interactive (buttons, links, dropdowns)
- Add text labels for sections ("this is the sidebar", "this scrolls")
- Mark areas with dynamic data ("this comes from API", "user's name here")

This drastically reduces ambiguity.

### Provide color values

If your design uses specific colors not in the Tailwind config, tell Claude:

```
Additional colors in this design:
- Card background: #F8FAFC
- Border: #E2E8F0
- Warning badge: #FEF3C7 text #92400E
```

### Show the data shape

If the design renders a list or table, show the data shape so Claude generates correct prop types:

```
Each row in this table represents an Order:
{ id, title, status, totalPrice, currency, createdAt }

These types already exist in entities/order/types.ts.
```

### Reference existing components

Always mention what already exists to avoid duplicates:

```
We already have these shared components:
- Button (variant: primary/secondary/ghost, size: sm/md/lg)

Reuse Button wherever you see a button in the design. Only create new shared components for patterns not covered.
```

### Iterative refinement

Don't try to get a perfect result in one prompt. Effective flow:

1. **First pass**: "Build this page from the screenshot"
2. **Refinement**: "The spacing between cards should be 24px not 16px, and the header should be sticky"
3. **Polish**: "Add hover states to the table rows and a subtle shadow to the cards"

### Batch related screens

If you have a full flow (e.g., 3 screens for an order creation wizard), send them together:

```
These 3 screenshots show an order creation flow:
1. docs/designs/order-create-step1.png — Select vehicle
2. docs/designs/order-create-step2.png — Enter details
3. docs/designs/order-create-step3.png — Confirmation

Create a multi-step form component in features/orders/ui/CreateOrderWizard.tsx.
Share state between steps with a parent component. Each step is a separate child component.
```

---

## Directory structure after design work

```
docs/
  designs/
    login-page.png              ← original screenshot
    orders-table-desktop.png
    orders-table-mobile.png
    sidebar-nav.png
    vehicle-card.png
```

Screenshots stay in `docs/designs/` as a reference. They're gitignored by default if large — add specific ones to git when they serve as documentation.
