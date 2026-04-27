## 2026-04-27 - [ARIA labels for icon-only buttons]
**Learning:** In React components like `<Button size="icon">`, the presence of a `title` attribute is insufficient for comprehensive accessibility. Screen readers and assistive technologies require explicit `aria-label` attributes to reliably parse icon-only interactive elements.
**Action:** Always include `aria-label` along with `title` when creating icon-only buttons to ensure they are accessible.
