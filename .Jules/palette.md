## 2024-05-23 - Accessibility of icon-only buttons
**Learning:** Found multiple instances of icon-only buttons (`<Button>` and `<button>`) using `HugeiconsIcon` components that lacked `aria-label` attributes. While some had `title` attributes for tooltips, screen readers still need `aria-label` to announce the button's purpose clearly when focused.
**Action:** Always verify that buttons containing only icons or visual elements have a descriptive `aria-label` added, even if a `title` attribute is present.
