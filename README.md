# Advanced Markdown Previewer ✅

A compact, **feature-rich Markdown editor and previewer** implemented as a single-page static app. It focuses on a polished editing UX with real-time rendering, helpful editor tools, and flexible export options.

---

## Why this project? (Benefits) 🎯

- **Fast, focused editing** — lightweight single-page app with instant preview and minimal dependencies.
- **Improved writing productivity** — features like inline toolbar, keyboard shortcuts, find & replace, undo/redo, line numbers and word wrap speed up authoring.
- **Portable exports** — export to Markdown, HTML, DOC, and PDF without server-side processing.
- **Privacy-friendly** — all editing and auto-save are local (uses `localStorage`), no external servers required.
- **Extensible & modular** — CSS and JS are split into `src/css/styles.css` and `src/js/main.js` for easier maintenance and enhancement.
- **Accessible & keyboard-first** — focus on keyboard shortcuts and aria attributes for screen reader friendliness.

---

## Project structure 📁

- `src/`
  - `index.html` — main HTML page (UI markup)
  - `css/styles.css` — extracted stylesheet
  - `js/main.js` — editor logic and rendering
- `markdown.html` — original single-file version (kept for reference)
- `README.md`, `package.json`, `.gitignore`

---

## Features ✨

- Real-time Markdown → HTML preview
- Table of Contents generation
- Drag-&-drop and paste image support (inserts data URLs)
- Find & Replace (inline and modal)
- Toolbar for common markdown actions (bold, italic, headings, lists, table)
- Resizable editor/preview panels (persisted split)
- Theme toggle (Light/Dark) with system sync
- Export to `.md`, `.html`, `.doc`, and save-to-PDF via print
- Undo/Redo history (bounded)
- Auto-save to `localStorage`
- Keyboard shortcuts and accessibility attributes

---

## Quick start 🚀

1. Install dependencies (optional) and run a static server:

```bash
# Run via npx (no global install required)
npx live-server src --port=3000

# or if you prefer using npm (package.json already contains a start script):
npm install -g live-server      # optional
npm start                      # runs: live-server src --port=3000
```

2. Open http://127.0.0.1:3000 (or the URL printed by `live-server`) and start typing in the editor.

Notes:
- You can also open `src/index.html` directly in your browser, but a local server provides better behavior for pop-ups/export.

---

## Configuration & Tips 🛠️

- Auto-saved content key: `markdown-preview-content` in `localStorage`.
- Panel split key: `markdown-preview-split` (a bad value here can make a pane extremely narrow). If preview appears empty, clear the saved split:

```js
// In browser console
localStorage.removeItem('markdown-preview-split')
```

- Theme preference is saved under `markdown-preview-theme` and will fall back to the system preference.
- Font size, line numbers, wrap, and TOC visibility are persisted with keys shown in the app source.

---

## Development & Contribution 🤝

- The project is intentionally small and plain JavaScript so adding features is straightforward.
- To propose a change:
  1. Fork the repo and create a feature branch.
  2. Make changes and test locally with `npx live-server src`.
  3. Open a pull request with a concise description and screenshots where useful.

Style notes:
- Keep UI changes accessible (aria attributes, keyboard navigation).
- Add unit tests or small integration checks where feasible.

---

## Troubleshooting & FAQ ❓

- Preview shows "The preview is empty." — check that the editor actually contains markdown and try clearing `markdown-preview-split` if the preview area is hidden.
- Export/PDF doesn't open due to blocked pop-ups — allow pop-ups for the app or use browser print (Ctrl/Cmd+P) after opening the pop-out preview.
- Images inserted as data URLs may increase document size — remove images if you need smaller exports.

---

## License & Credits 🧾

This project is distributed under the MIT license — feel free to reuse and adapt the code.

---

If you'd like, I can also:
- Add a small dev script to automatically open the browser when starting the server.
- Add a basic CI workflow that runs a link-check or linter on push.

Tell me which addition you'd like next and I'll implement it. ✨