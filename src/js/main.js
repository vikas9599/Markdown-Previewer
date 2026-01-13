const sampleMarkdown = `# Welcome to the Advanced Markdown Previewer

Type your Markdown on the left to see it update in real-time!

## Features

- **Bold**, *Italic*, and ~~Strikethrough~~ text
- \`Inline code\` and fenced code blocks
- Links like [OpenAI](https://openai.com)
- Images (paste or drag & drop)
- Tables
- 1. Ordered lists
- 2. With multiple levels

> Blockquotes work too — perfect for highlighting text.

---

### Code block

\`\`\`js
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet("Markdown");
\`\`\`

### Table Example

| Feature | Status | Notes |
|---------|--------|-------|
| Tables | ✅ | Fully supported |
| Images | ✅ | Paste or drag-drop |
| TOC | ✅ | Auto-generated |

Happy writing!`;

const STORAGE_KEY = "markdown-preview-content";
const THEME_KEY = "markdown-preview-theme";
const SPLIT_KEY = "markdown-preview-split";
const FONT_SIZE_KEY = "markdown-preview-font-size";
const LINE_NUMBERS_KEY = "markdown-preview-line-numbers";
const WRAP_KEY = "markdown-preview-wrap";
const TOC_KEY = "markdown-preview-toc";

const textarea = document.getElementById("markdown-input");
const preview = document.getElementById("preview");
const stats = document.getElementById("stats");
const themeToggle = document.getElementById("theme-toggle");
const divider = document.querySelector(".divider");
const editorPane = document.querySelector(".editor-pane");
const previewPane = document.querySelector(".preview-pane");
const workspace = document.getElementById("workspace");
const clearButton = document.getElementById("clear-editor");
const popoutButton = document.getElementById("open-preview-window");
const editorWrapper = document.getElementById("editor-wrapper");
const lineNumbers = document.getElementById("line-numbers");
const findReplaceBar = document.getElementById("find-replace-bar");
const findInput = document.getElementById("find-input");
const replaceInput = document.getElementById("replace-input");
const findCount = document.getElementById("find-count");
const helpModal = document.getElementById("help-modal");
const findReplaceModal = document.getElementById("find-replace-modal");

let history = [];
let historyIndex = -1;
let currentFindIndex = -1;
let findMatches = [];
let fontSize = parseFloat(localStorage.getItem(FONT_SIZE_KEY)) || 0.98;
let showTOC = localStorage.getItem(TOC_KEY) === "true";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const saveHistory = () => {
  const content = textarea.value;
  if (history[historyIndex] !== content) {
    history = history.slice(0, historyIndex + 1);
    history.push(content);
    historyIndex++;
    if (history.length > 50) {
      history.shift();
      historyIndex--;
    }
    updateUndoRedoButtons();
  }
};

const updateUndoRedoButtons = () => {
  document.getElementById("undo-btn").disabled = historyIndex <= 0;
  document.getElementById("redo-btn").disabled = historyIndex >= history.length - 1;
};

const undo = () => {
  if (historyIndex > 0) {
    historyIndex--;
    textarea.value = history[historyIndex];
    updatePreview();
    updateUndoRedoButtons();
  }
};

const redo = () => {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    textarea.value = history[historyIndex];
    updatePreview();
    updateUndoRedoButtons();
  }
};

const escapeHtml = (str) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderInline = (text) =>
  escapeHtml(text)
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/___(.+?)___/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, `<img src="$2" alt="$1" />`);

const renderMarkdown = (markdown) => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const htmlParts = [];
  let listType = null;
  let inCodeBlock = false;
  let codeBuffer = [];
  let tocItems = [];

  const closeList = () => {
    if (listType) {
      htmlParts.push(`</${listType}>`);
      listType = null;
    }
  };

  const closeCodeBlock = () => {
    if (inCodeBlock) {
      htmlParts.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
      codeBuffer = [];
      inCodeBlock = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (/```/.test(trimmed) && trimmed.startsWith("```")) {
      if (inCodeBlock) {
        closeCodeBlock();
      } else {
        closeList();
        inCodeBlock = true;
        codeBuffer = [];
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeList();
      htmlParts.push("<hr />");
      return;
    }

    const tableMatch = line.match(/^\|(.+)\|$/);
    if (tableMatch) {
      closeList();
      const cells = tableMatch[1].split("|").map(c => c.trim()).filter(Boolean);
      if (cells.length > 0) {
        if (!htmlParts[htmlParts.length - 1]?.startsWith("<table")) {
          htmlParts.push("<table><thead><tr>");
          cells.forEach(cell => {
            htmlParts.push(`<th>${renderInline(cell)}</th>`);
          });
          htmlParts.push("</tr></thead><tbody>");
        } else {
          htmlParts.push("<tr>");
          cells.forEach(cell => {
            if (cell.match(/^:?-+:?$/)) {
              return;
            }
            htmlParts.push(`<td>${renderInline(cell)}</td>`);
          });
          htmlParts.push("</tr>");
        }
      }
      return;
    }

    if (htmlParts[htmlParts.length - 1]?.startsWith("<table")) {
      htmlParts.push("</tbody></table>");
    }

    const unorderedMatch = line.match(/^\s*[-*+]\s+(.*)$/);
    if (unorderedMatch) {
      if (listType !== "ul") {
        closeCodeBlock();
        closeList();
        htmlParts.push("<ul>");
        listType = "ul";
      }
      htmlParts.push(`<li>${renderInline(unorderedMatch[1])}</li>`);
      return;
    }

    const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (listType !== "ol") {
        closeCodeBlock();
        closeList();
        htmlParts.push("<ol>");
        listType = "ol";
      }
      htmlParts.push(`<li>${renderInline(orderedMatch[1])}</li>`);
      return;
    }

    closeList();

    if (trimmed === "") {
      htmlParts.push("");
      return;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = renderInline(headingMatch[2]);
      const id = `h${index}-${content.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      htmlParts.push(`<h${level} id="${id}">${content}</h${level}>`);
      if (showTOC) {
        tocItems.push({ level, content, id });
      }
      return;
    }

    const blockquoteMatch = line.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      htmlParts.push(`<blockquote>${renderInline(blockquoteMatch[1])}</blockquote>`);
      return;
    }

    htmlParts.push(`<p>${renderInline(line)}</p>`);
  });

  closeList();
  closeCodeBlock();

  if (htmlParts[htmlParts.length - 1]?.startsWith("<table")) {
    htmlParts.push("</tbody></table>");
  }

  let html = htmlParts.join("\n");

  if (showTOC && tocItems.length > 0) {
    const tocHtml = `<div class="toc"><h2>Table of Contents</h2><ul>${tocItems.map(item =>
      `<li style="margin-left: ${(item.level - 1) * 1.5}em;"><a href="#${item.id}">${item.content}</a></li>`
    ).join("")}</ul></div>`;
    html = tocHtml + html;
  }

  return html;
};

const updatePreview = () => {
  preview.innerHTML = renderMarkdown(textarea.value);
  if (!preview.innerHTML || preview.innerHTML.trim() === "") {
    preview.innerHTML = "<p><em>The preview is empty.</em></p>";
  }
  updateStats();
  updateLineNumbers();
};

const updateStats = () => {
  const text = textarea.value;
  const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const characters = text.length;
  const lines = text === "" ? 0 : text.split(/\r\n|\n/).length;
  stats.textContent = `Words: ${words.toLocaleString()} • Characters: ${characters.toLocaleString()} • Lines: ${lines}`;
};

const updateLineNumbers = () => {
  if (editorWrapper.classList.contains("has-line-numbers")) {
    const lines = textarea.value.split("\n").length;
    lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
  }
};

const insertText = (before, after = "", placeholder = "") => {
  const { selectionStart, selectionEnd, value } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);
  const text = selected || placeholder;
  const beforeText = value.slice(0, selectionStart);
  const afterText = value.slice(selectionEnd);
  const newText = beforeText + before + text + after + afterText;
  textarea.value = newText;
  const newPos = selectionStart + before.length + text.length;
  textarea.selectionStart = textarea.selectionEnd = newPos;
  textarea.focus();
  saveHistory();
  updatePreview();
};

const saveContent = () => {
  localStorage.setItem(STORAGE_KEY, textarea.value);
};

const restoreContent = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && saved.trim()) {
    textarea.value = saved;
  } else {
    textarea.value = sampleMarkdown;
  }
  history = [textarea.value];
  historyIndex = 0;
  updateUndoRedoButtons();
};

const applyTheme = (theme) => {
  document.body.dataset.theme = theme;
  const isDark = theme === "dark";
  themeToggle.textContent = isDark ? "Light Mode" : "Dark Mode";
  themeToggle.setAttribute("aria-pressed", String(isDark));
};

const detectTheme = () => {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) {
    return stored;
  }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const toggleTheme = () => {
  const current = document.body.dataset.theme === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
};

const downloadFile = (filename, mimeType, content) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const downloadMarkdown = () => {
  downloadFile("document.md", "text/markdown;charset=utf-8", textarea.value);
};

const downloadHtml = () => {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Markdown Export</title>
<style>
body { font-family: "Segoe UI", -apple-system, sans-serif; margin: 2.5rem auto; max-width: 760px; line-height: 1.7; color: #1f2933; }
a { color: #2563eb; }
pre { background: #0f172a; color: #f8fafc; padding: 1rem 1.35rem; border-radius: 0.75rem; overflow-x: auto; }
code { font-family: "Fira Code", Consolas, monospace; background: rgba(15,23,42,0.08); padding: 0.15em 0.35em; border-radius: 0.35em; }
blockquote { border-left: 4px solid rgba(37,99,235,0.55); padding-left: 1rem; margin: 1.2rem 0; font-style: italic; }
table { border-collapse: collapse; width: 100%; margin: 1.2em 0; }
table th, table td { border: 1px solid #d1d5db; padding: 0.6rem 0.9rem; }
table th { background: rgba(37,99,235,0.1); font-weight: 600; }
img { max-width: 100%; height: auto; border-radius: 0.5rem; }
</style>
</head>
<body>
${preview.innerHTML}
</body>
</html>`;
  downloadFile("document.html", "text/html;charset=utf-8", htmlContent);
};

const downloadDoc = () => {
  const docContent = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body>${preview.innerHTML}</body>
</html>`;
  downloadFile("document.doc", "application/msword;charset=utf-8", docContent);
};

const saveAsPdf = () => {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    alert("Please allow pop-ups to save as PDF.");
    return;
  }
  const css = `
          body { font-family: "Segoe UI", -apple-system, sans-serif; margin: 2rem auto; max-width: 760px; line-height: 1.7; color: #111827; }
          h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.7em; }
          pre { background: #111827; color: #f8fafc; padding: 1rem 1.25rem; border-radius: 0.75rem; overflow-x: auto; }
          code { font-family: "Fira Code", Consolas, monospace; background: rgba(15,23,42,0.08); padding: 0.15em 0.35em; border-radius: 0.35em; }
          blockquote { border-left: 4px solid rgba(37,99,235,0.55); padding-left: 1rem; margin: 1.2rem 0; font-style: italic; }
          table { border-collapse: collapse; width: 100%; margin: 1.2em 0; }
          table th, table td { border: 1px solid #d1d5db; padding: 0.6rem 0.9rem; }
          table th { background: rgba(37,99,235,0.1); font-weight: 600; }
          img { max-width: 100%; height: auto; }
        `;
  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Markdown PDF Export</title>
<style>${css}</style>
</head>
<body>
${preview.innerHTML}
</body>
</html>`);
  printWindow.document.close();
  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });
};

const openPreviewWindow = () => {
  const popup = window.open("", "_blank", "width=1000,height=720");
  if (!popup) {
    alert("Please allow pop-ups to open the preview window.");
    return;
  }
  popup.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Markdown Preview</title>
<style>
body { font-family: "Segoe UI", -apple-system, sans-serif; margin: 0; background: #f4f4f8; color: #1f2933; }
.wrapper { max-width: 900px; margin: 0 auto; padding: 2.5rem 2rem; }
pre { background: #0f172a; color: #f8fafc; padding: 1rem 1.35rem; border-radius: 0.75rem; overflow-x: auto; }
code { font-family: "Fira Code", Consolas, monospace; background: rgba(15,23,42,0.08); padding: 0.15em 0.35em; border-radius: 0.35em; }
blockquote { border-left: 4px solid rgba(37,99,235,0.55); padding-left: 1rem; margin: 1.2rem 0; font-style: italic; }
table { border-collapse: collapse; width: 100%; margin: 1.2em 0; }
table th, table td { border: 1px solid #d1d5db; padding: 0.6rem 0.9rem; }
table th { background: rgba(37,99,235,0.1); font-weight: 600; }
img { max-width: 100%; height: auto; border-radius: 0.5rem; }
</style>
</head>
<body>
  <div class="wrapper">
    ${preview.innerHTML || "<p><em>The preview is empty.</em></p>"}
  </div>
</body>
</html>`);
  popup.document.close();
};

const restoreSplit = () => {
  const saved = localStorage.getItem(SPLIT_KEY);
  if (saved) {
    const parsed = Number(saved);
    const percent = Number.isFinite(parsed) ? clamp(parsed, 20, 80) : 50;
    editorPane.style.flexBasis = `${percent}%`;
    previewPane.style.flexBasis = `${100 - percent}%`;
    // Clean up invalid stored values to avoid future layout issues
    if (!Number.isFinite(parsed)) {
      localStorage.removeItem(SPLIT_KEY);
    }
  } else {
    editorPane.style.flexBasis = "50%";
    previewPane.style.flexBasis = "50%";
  }
};

const handleResize = (() => {
  let isDragging = false;

  const onPointerMove = (event) => {
    if (!isDragging) {
      return;
    }
    const rect = workspace.getBoundingClientRect();
    const minWidth = 240;
    let editorWidth = event.clientX - rect.left;
    editorWidth = clamp(editorWidth, minWidth, rect.width - minWidth);
    const percent = (editorWidth / rect.width) * 100;
    editorPane.style.flexBasis = `${percent}%`;
    previewPane.style.flexBasis = `${100 - percent}%`;
    localStorage.setItem(SPLIT_KEY, percent.toFixed(2));
  };

  const stopDragging = () => {
    if (isDragging) {
      isDragging = false;
      divider.classList.remove("dragging");
      document.body.classList.remove("resizing");
    }
  };

  divider.addEventListener("pointerdown", (event) => {
    isDragging = true;
    divider.classList.add("dragging");
    document.body.classList.add("resizing");
    divider.setPointerCapture(event.pointerId);
  });

  divider.addEventListener("pointermove", onPointerMove);
  divider.addEventListener("pointerup", (event) => {
    divider.releasePointerCapture(event.pointerId);
    stopDragging();
  });
  divider.addEventListener("lostpointercapture", stopDragging);
  window.addEventListener("pointerup", stopDragging);
})();

divider.addEventListener("dblclick", () => {
  editorPane.style.flexBasis = "50%";
  previewPane.style.flexBasis = "50%";
  localStorage.removeItem(SPLIT_KEY);
});

const findText = (text, startIndex = 0) => {
  const content = textarea.value;
  findMatches = [];
  if (!text) {
    findCount.textContent = "";
    return;
  }
  const regex = new RegExp(escapeRegex(text), "gi");
  let match;
  while ((match = regex.exec(content)) !== null) {
    findMatches.push({ start: match.index, end: match.index + match[0].length });
  }
  findCount.textContent = findMatches.length > 0 ? `${currentFindIndex + 1}/${findMatches.length}` : "0/0";
  if (findMatches.length > 0) {
    currentFindIndex = startIndex >= 0 && startIndex < findMatches.length ? startIndex : 0;
    highlightFind();
  }
};

const highlightFind = () => {
  if (findMatches.length === 0) return;
  const match = findMatches[currentFindIndex];
  textarea.focus();
  textarea.setSelectionRange(match.start, match.end);
  textarea.scrollIntoView({ block: "center", behavior: "smooth" });
  findCount.textContent = `${currentFindIndex + 1}/${findMatches.length}`;
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceText = (find, replace, replaceAll = false) => {
  if (!find) return;
  const { selectionStart, selectionEnd, value } = textarea;
  if (replaceAll) {
    const newValue = value.replace(new RegExp(escapeRegex(find), "g"), replace);
    textarea.value = newValue;
    saveHistory();
    updatePreview();
    findText(findInput.value);
  } else {
    const selected = value.slice(selectionStart, selectionEnd);
    if (selected === find) {
      const newValue = value.slice(0, selectionStart) + replace + value.slice(selectionEnd);
      textarea.value = newValue;
      const newPos = selectionStart + replace.length;
      textarea.setSelectionRange(newPos, newPos);
      saveHistory();
      updatePreview();
      findText(findInput.value, currentFindIndex);
    }
  }
};

const toggleLineNumbers = () => {
  const hasNumbers = editorWrapper.classList.toggle("has-line-numbers");
  localStorage.setItem(LINE_NUMBERS_KEY, hasNumbers ? "true" : "false");
  updateLineNumbers();
};

const toggleWrap = () => {
  const wrapped = textarea.classList.toggle("wrap");
  localStorage.setItem(WRAP_KEY, wrapped ? "true" : "false");
};

const toggleTOC = () => {
  showTOC = !showTOC;
  localStorage.setItem(TOC_KEY, showTOC ? "true" : "false");
  updatePreview();
};

const adjustFontSize = (delta) => {
  fontSize = clamp(fontSize + delta, 0.7, 1.5);
  textarea.style.fontSize = `${fontSize}rem`;
  lineNumbers.style.fontSize = `${fontSize}rem`;
  localStorage.setItem(FONT_SIZE_KEY, fontSize.toString());
};

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {
      alert("Fullscreen not supported or denied.");
    });
  } else {
    document.exitFullscreen();
  }
};

textarea.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    if (event.shiftKey) {
      const before = value.lastIndexOf("\n", start - 1) + 1;
      if (value.slice(before, before + 2) === "  ") {
        textarea.value = value.slice(0, before) + value.slice(before + 2);
        textarea.selectionStart = start - 2;
        textarea.selectionEnd = end - 2;
      }
    } else {
      textarea.value = value.slice(0, start) + "  " + value.slice(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
    }
    saveHistory();
    updatePreview();
  }
});

textarea.addEventListener("input", () => {
  saveHistory();
  updatePreview();
  saveContent();
});

textarea.addEventListener("scroll", () => {
  if (editorWrapper.classList.contains("has-line-numbers")) {
    lineNumbers.scrollTop = textarea.scrollTop;
  }
});

textarea.addEventListener("paste", (event) => {
  const items = event.clipboardData.items;
  for (let item of items) {
    if (item.type.indexOf("image") !== -1) {
      event.preventDefault();
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const { selectionStart, selectionEnd, value } = textarea;
        const before = value.slice(0, selectionStart);
        const after = value.slice(selectionEnd);
        textarea.value = before + `![Image](${dataUrl})` + after;
        textarea.selectionStart = textarea.selectionEnd = selectionStart + `![Image](${dataUrl})`.length;
        saveHistory();
        updatePreview();
      };
      reader.readAsDataURL(file);
      return;
    }
  }
  const text = event.clipboardData.getData("text");
  if (text) {
    event.preventDefault();
    const { selectionStart, selectionEnd, value } = textarea;
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const toInsert = text.replace(/\r\n/g, "\n");
    textarea.value = before + toInsert + after;
    const cursor = before.length + toInsert.length;
    textarea.selectionStart = textarea.selectionEnd = cursor;
    saveHistory();
    updatePreview();
  }
});

textarea.addEventListener("dragover", (event) => {
  event.preventDefault();
});

textarea.addEventListener("drop", (event) => {
  event.preventDefault();
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const { selectionStart, selectionEnd, value } = textarea;
        const before = value.slice(0, selectionStart);
        const after = value.slice(selectionEnd);
        textarea.value = before + `![${file.name}](${dataUrl})` + after;
        textarea.selectionStart = textarea.selectionEnd = selectionStart + `![${file.name}](${dataUrl})`.length;
        saveHistory();
        updatePreview();
      };
      reader.readAsDataURL(file);
    }
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "f") {
    event.preventDefault();
    findReplaceBar.classList.add("active");
    findInput.focus();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "h") {
    event.preventDefault();
    findReplaceModal.classList.add("active");
    document.getElementById("modal-find").focus();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "/") {
    event.preventDefault();
    helpModal.classList.add("active");
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey) {
    event.preventDefault();
    undo();
  }
  if ((event.ctrlKey || event.metaKey) && (event.key === "y" || (event.key === "z" && event.shiftKey))) {
    event.preventDefault();
    redo();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "b") {
    event.preventDefault();
    insertText("**", "**", "bold text");
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "i") {
    event.preventDefault();
    insertText("*", "*", "italic text");
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "k") {
    event.preventDefault();
    insertText("[", "](url)", "link text");
  }
  if (event.key === "F11") {
    event.preventDefault();
    toggleFullscreen();
  }
  if (event.key === "Escape") {
    findReplaceBar.classList.remove("active");
    findReplaceModal.classList.remove("active");
    helpModal.classList.remove("active");
  }
});

document.getElementById("tool-bold").addEventListener("click", () => insertText("**", "**", "bold text"));
document.getElementById("tool-italic").addEventListener("click", () => insertText("*", "*", "italic text"));
document.getElementById("tool-strikethrough").addEventListener("click", () => insertText("~~", "~~", "strikethrough"));
document.getElementById("tool-code").addEventListener("click", () => insertText("`", "`", "code"));
document.getElementById("tool-link").addEventListener("click", () => insertText("[", "](url)", "link text"));
document.getElementById("tool-image").addEventListener("click", () => insertText("![", "](url)", "alt text"));
document.getElementById("tool-h1").addEventListener("click", () => insertText("# ", "", "Heading 1"));
document.getElementById("tool-h2").addEventListener("click", () => insertText("## ", "", "Heading 2"));
document.getElementById("tool-h3").addEventListener("click", () => insertText("### ", "", "Heading 3"));
document.getElementById("tool-list").addEventListener("click", () => insertText("- ", "", "List item"));
document.getElementById("tool-ordered-list").addEventListener("click", () => insertText("1. ", "", "List item"));
document.getElementById("tool-quote").addEventListener("click", () => insertText("> ", "", "Quote"));
document.getElementById("tool-hr").addEventListener("click", () => insertText("---\n", "", ""));
document.getElementById("tool-table").addEventListener("click", () => {
  const table = "| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n";
  insertText(table, "", "");
});

findInput.addEventListener("input", () => {
  currentFindIndex = -1;
  findText(findInput.value);
});

document.getElementById("find-next").addEventListener("click", () => {
  if (findMatches.length > 0) {
    currentFindIndex = (currentFindIndex + 1) % findMatches.length;
    highlightFind();
  }
});

document.getElementById("find-prev").addEventListener("click", () => {
  if (findMatches.length > 0) {
    currentFindIndex = (currentFindIndex - 1 + findMatches.length) % findMatches.length;
    highlightFind();
  }
});

document.getElementById("replace-btn").addEventListener("click", () => {
  replaceText(findInput.value, replaceInput.value, false);
});

document.getElementById("replace-all-btn").addEventListener("click", () => {
  replaceText(findInput.value, replaceInput.value, true);
});

document.getElementById("close-find").addEventListener("click", () => {
  findReplaceBar.classList.remove("active");
});

document.getElementById("modal-find-next").addEventListener("click", () => {
  const find = document.getElementById("modal-find").value;
  findText(find, currentFindIndex + 1);
});

document.getElementById("modal-find-prev").addEventListener("click", () => {
  const find = document.getElementById("modal-find").value;
  findText(find, currentFindIndex - 1);
});

document.getElementById("modal-replace-btn").addEventListener("click", () => {
  const find = document.getElementById("modal-find").value;
  const replace = document.getElementById("modal-replace").value;
  replaceText(find, replace, false);
});

document.getElementById("modal-replace-all-btn").addEventListener("click", () => {
  const find = document.getElementById("modal-find").value;
  const replace = document.getElementById("modal-replace").value;
  replaceText(find, replace, true);
});

document.getElementById("close-find-modal").addEventListener("click", () => {
  findReplaceModal.classList.remove("active");
});

document.getElementById("close-help-modal").addEventListener("click", () => {
  helpModal.classList.remove("active");
});

document.getElementById("find-replace").addEventListener("click", () => {
  findReplaceModal.classList.add("active");
  document.getElementById("modal-find").focus();
});

document.getElementById("help").addEventListener("click", () => {
  helpModal.classList.add("active");
});

document.getElementById("download-md").addEventListener("click", downloadMarkdown);
document.getElementById("download-html").addEventListener("click", downloadHtml);
document.getElementById("download-doc").addEventListener("click", downloadDoc);
document.getElementById("download-pdf").addEventListener("click", saveAsPdf);

document.getElementById("copy-markdown").addEventListener("click", async (evt) => {
  const btn = evt.currentTarget;
  try {
    await navigator.clipboard.writeText(textarea.value);
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => {
      btn.textContent = original;
    }, 1600);
  } catch (error) {
    alert("Unable to copy to clipboard. Please copy manually.");
  }
});

themeToggle.addEventListener("click", toggleTheme);

document.getElementById("undo-btn").addEventListener("click", undo);
document.getElementById("redo-btn").addEventListener("click", redo);

clearButton.addEventListener("click", () => {
  const confirmed = confirm("Clear the editor? This cannot be undone.");
  if (confirmed) {
    textarea.value = "";
    textarea.focus();
    saveHistory();
    updatePreview();
  }
});

popoutButton.addEventListener("click", openPreviewWindow);

document.getElementById("toggle-line-numbers").addEventListener("click", toggleLineNumbers);
document.getElementById("toggle-wrap").addEventListener("click", toggleWrap);
document.getElementById("toggle-toc").addEventListener("click", toggleTOC);
document.getElementById("font-increase").addEventListener("click", () => adjustFontSize(0.05));
document.getElementById("font-decrease").addEventListener("click", () => adjustFontSize(-0.05));
document.getElementById("font-reset").addEventListener("click", () => {
  fontSize = 0.98;
  textarea.style.fontSize = `${fontSize}rem`;
  lineNumbers.style.fontSize = `${fontSize}rem`;
  localStorage.setItem(FONT_SIZE_KEY, fontSize.toString());
});
document.getElementById("fullscreen").addEventListener("click", toggleFullscreen);

window.addEventListener("beforeunload", () => {
  saveContent();
});

window.matchMedia("(prefers-color-scheme: dark)")?.addEventListener("change", (event) => {
  const stored = localStorage.getItem(THEME_KEY);
  if (!stored) {
    applyTheme(event.matches ? "dark" : "light");
  }
});

if (localStorage.getItem(LINE_NUMBERS_KEY) === "true") {
  editorWrapper.classList.add("has-line-numbers");
}
if (localStorage.getItem(WRAP_KEY) === "true") {
  textarea.classList.add("wrap");
}
textarea.style.fontSize = `${fontSize}rem`;
lineNumbers.style.fontSize = `${fontSize}rem`;

restoreContent();
restoreSplit();
applyTheme(detectTheme());
updatePreview();
