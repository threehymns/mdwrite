
## 2024-05-01 - Adding ARIA labels to Icon-Only Buttons
**Learning:** Found multiple icon-only buttons in the Graph Controls panel (Reset settings, Close panel, Delete group) that lacked `aria-label` attributes, relying solely on `title` or visual cues. This makes them inaccessible to screen reader users who need explicit labels for interactive elements.
**Action:** Always include an `aria-label` attribute alongside the `title` attribute for icon-only `<Button>` components to ensure both visual hover tooltips and screen reader accessibility are supported.
