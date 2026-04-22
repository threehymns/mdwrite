## 2024-04-22 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Common pattern found across UI components (`graph-tab.tsx`, `code-block-codemirror.tsx`) where icon-only buttons using `HugeiconsIcon` are missing `aria-label` attributes. While they often include a `title` attribute for mouse users, screen readers require the `aria-label` for proper accessibility context.
**Action:** When adding new icon-only buttons, consistently include `aria-label` alongside `title`.
