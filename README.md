# MDWrite

A clean, privacy-focused markdown editor that works directly with your local files. No accounts, no cloud, no data leaves your machine.

## Features

- **Local-first** - Opens folders directly from your file system using the File System Access API
- **Rich markdown editing** - Powered by Tiptap with support for headings, lists, task lists, blockquotes, code blocks, and inline formatting
- **Internal links** - Link between notes with `[[wiki-link]]` syntax, including heading anchors
- **Graph view** - Visualize connections between your notes
- **Frontmatter** - Edit YAML frontmatter with a structured UI
- **Code blocks** - Syntax highlighting via CodeMirror for JavaScript, TypeScript, Python, Rust, CSS, HTML, C++, Java, and JSON
- **Image support** - Drag-and-drop, paste, or upload images to an `assets/` folder
- **Table of contents** - Navigate documents via extracted headings
- **Search** - Full-text search across all files in your workspace
- **Command bar** - Quick actions accessible via keyboard
- **Tabbed editing** - Open multiple files with drag-to-reorder tabs
- **Themes** - Multiple color themes with light/dark mode
- **Keyboard shortcuts** - Fully customizable hotkeys
- **Auto-save** - Changes save automatically after 300ms of inactivity

## Desktop

MDWrite also runs as an Electron desktop app.

```bash
# Dev mode
bun run dev:desktop

# Build
bun run build:desktop
```

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production
bun run build
```

## Tech Stack

- [React](https://react.dev/) + [TanStack Start](https://tanstack.com/start)
- [Tiptap](https://tiptap.dev/) editor
- [CodeMirror](https://codemirror.net/) for code blocks
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [Electron](https://www.electronjs.org/) for desktop
- [Vite](https://vitejs.dev/) build tooling

## Browser Support

MDWrite uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API), which is supported in Chromium-based browsers (Chrome, Edge, Opera). The Electron desktop app wraps the same web app in a native window.

## License

[MIT](LICENSE)
