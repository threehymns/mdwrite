## 2024-05-18 - Missing Aria Labels on Icon-only Buttons
**Learning:** Found several icon-only buttons across components (e.g., Code block language selector, copy, wrap toggle, search dialog results, slash command list, graph tab controls) lacking `aria-label`s, which impacts screen reader accessibility. Some have `title` but `aria-label` is crucial.
**Action:** Always verify `aria-label` is present on any `<button>` element that only contains icons without visible text.
