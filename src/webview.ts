import type { DecodeOutcome } from './cli';
import type { HexDumpResult } from './hex';

export type ViewMode = 'json' | 'split' | 'hex';

export interface WebviewRenderModel {
  fileName: string;
  viewMode: ViewMode;
  decode: DecodeOutcome;
  hex: HexDumpResult;
  nonce: string;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Lightweight syntax highlighter for pretty-printed JSON.
 * Escapes HTML entities before wrapping tokens in span classes.
 */
export function highlightJson(jsonText: string): string {
  const escaped = escapeHtml(jsonText);
  return escaped.replace(
    /(&quot;(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\&]|&(?!quot;))*&quot;)(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/g,
    (match, str: string | undefined, colon: string | undefined, literal: string | undefined) => {
      if (str !== undefined) {
        if (colon !== undefined) {
          return `<span class="tok-key">${str}</span>${colon}`;
        }
        return `<span class="tok-string">${str}</span>`;
      }
      if (literal !== undefined) {
        return literal === 'null'
          ? `<span class="tok-null">${literal}</span>`
          : `<span class="tok-bool">${literal}</span>`;
      }
      return `<span class="tok-num">${match}</span>`;
    },
  );
}

export function formatByteCount(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

export function renderWebviewHtml(model: WebviewRenderModel): string {
  const { fileName, viewMode, decode, hex, nonce } = model;
  const safeName = escapeHtml(fileName);
  const sizeLabel = formatByteCount(hex.totalBytes);

  const jsonBody = decode.ok
    ? `<div class="editor-wrap">
        <pre class="code-view editor-highlight" id="json-highlight" aria-hidden="true"><code>${highlightJson(decode.json)}</code></pre>
        <textarea
          class="code-view editor-input"
          id="json-editor"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          aria-label="Decoded OmniBuf JSON editor"
        >${escapeHtml(decode.json)}</textarea>
      </div>`
    : `<div class="error-box">
        <div class="error-title">${decode.code === 'ENOENT' ? 'omnibuf CLI not found' : 'Decode failed'}</div>
        <pre class="error-detail">${escapeHtml(decode.message)}</pre>
        <p class="error-hint">Switch to <strong>Hex</strong> or <strong>Split</strong> above to inspect the raw binary bytes.</p>
      </div>`;

  const hexBody = `<pre class="code-view hex-view" id="hex-pre"><code id="hex-code">${escapeHtml(hex.text)}</code></pre>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeName}</title>
  <style nonce="${nonce}">
    :root {
      --border: var(--vscode-panel-border, rgba(128, 128, 128, 0.25));
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --muted: var(--vscode-descriptionForeground);
      --surface: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
      --btn-bg: var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.16));
      --btn-fg: var(--vscode-button-secondaryForeground, var(--fg));
      --btn-hover: var(--vscode-button-secondaryHoverBackground, rgba(128, 128, 128, 0.28));
      --active-bg: var(--vscode-button-background);
      --active-fg: var(--vscode-button-foreground);
      --error-fg: var(--vscode-errorForeground, #f48771);
      --mono: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
      --font-size: var(--vscode-editor-font-size, 13px);
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      background: var(--bg);
      color: var(--fg);
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: 13px;
    }

    .shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 14px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      flex-wrap: wrap;
    }

    .toolbar-left, .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .segmented {
      display: inline-flex;
      border: 1px solid var(--border);
      border-radius: 4px;
      overflow: hidden;
    }

    .segmented button {
      border: none;
      border-right: 1px solid var(--border);
      border-radius: 0;
      padding: 4px 10px;
      background: transparent;
      color: var(--fg);
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
    }

    .segmented button:last-child {
      border-right: none;
    }

    .segmented button:hover {
      background: var(--btn-hover);
    }

    .segmented button.active {
      background: var(--active-bg);
      color: var(--active-fg);
      font-weight: 600;
    }

    .action-btn {
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 4px 10px;
      background: var(--btn-bg);
      color: var(--btn-fg);
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
    }

    .action-btn.primary {
      background: var(--active-bg);
      color: var(--active-fg);
      border-color: transparent;
    }

    .action-btn:hover {
      background: var(--btn-hover);
    }

    .action-btn.primary:hover {
      opacity: 0.9;
    }

    .action-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .meta {
      color: var(--muted);
      font-size: 12px;
      font-family: var(--mono);
    }

    .status-badge {
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 999px;
      border: 1px solid var(--border);
      color: var(--muted);
    }

    .status-badge.invalid {
      color: var(--error-fg);
      border-color: var(--error-fg);
    }

    .panes {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: 1fr;
    }

    .panes[data-mode="split"] {
      grid-template-columns: 1fr 1fr;
    }

    .pane {
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .panes[data-mode="json"] .pane-hex { display: none; }
    .panes[data-mode="hex"] .pane-json { display: none; }
    .panes[data-mode="split"] .pane-json {
      border-right: 1px solid var(--border);
    }

    .pane-header {
      padding: 5px 14px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      display: none;
    }

    .panes[data-mode="split"] .pane-header {
      display: block;
    }

    .editor-wrap {
      position: relative;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .code-view {
      margin: 0;
      padding: 14px 16px;
      font-family: var(--mono);
      font-size: var(--font-size);
      line-height: 1.5;
      tab-size: 2;
      white-space: pre;
    }

    .hex-view {
      flex: 1;
      overflow: auto;
    }

    .editor-highlight,
    .editor-input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: auto;
      border: none;
      outline: none;
      resize: none;
    }

    .editor-highlight {
      pointer-events: none;
      color: var(--fg);
      background: transparent;
    }

    .editor-input {
      background: transparent;
      color: transparent;
      caret-color: var(--vscode-editorCursor-foreground, var(--fg));
      -webkit-text-fill-color: transparent;
    }

    .editor-input::selection {
      background: var(--vscode-editor-selectionBackground, rgba(38, 79, 120, 0.5));
    }

    .tok-key { color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe); }
    .tok-string { color: var(--vscode-debugTokenExpression-string, #ce9178); }
    .tok-num { color: var(--vscode-debugTokenExpression-number, #b5cea8); }
    .tok-bool { color: var(--vscode-debugTokenExpression-boolean, #569cd6); }
    .tok-null { color: var(--vscode-debugTokenExpression-name, #c586c0); }

    .error-box {
      margin: 20px;
      padding: 16px 18px;
      border: 1px solid var(--vscode-inputValidation-errorBorder, #f14c4c);
      background: var(--vscode-inputValidation-errorBackground, rgba(241, 76, 76, 0.1));
      border-radius: 4px;
      max-width: 780px;
    }

    .error-title {
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--error-fg);
    }

    .error-detail {
      margin: 0 0 10px 0;
      font-family: var(--mono);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .error-hint {
      margin: 0;
      color: var(--muted);
      font-size: 12px;
    }

    @media (max-width: 720px) {
      .panes[data-mode="split"] {
        grid-template-columns: 1fr;
        grid-template-rows: 1fr 1fr;
      }
      .panes[data-mode="split"] .pane-json {
        border-right: none;
        border-bottom: 1px solid var(--border);
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="segmented" role="tablist" aria-label="View mode">
          <button type="button" data-view="json" class="${viewMode === 'json' ? 'active' : ''}">JSON</button>
          <button type="button" data-view="split" class="${viewMode === 'split' ? 'active' : ''}">Split</button>
          <button type="button" data-view="hex" class="${viewMode === 'hex' ? 'active' : ''}">Hex</button>
        </div>
        <span class="meta" id="file-meta">${safeName} · ${sizeLabel}</span>
        <span class="status-badge" id="json-status">${decode.ok ? 'JSON valid' : 'Read-only'}</span>
      </div>
      <div class="toolbar-right">
        <button type="button" class="action-btn" id="btn-format" ${decode.ok ? '' : 'disabled'}>Format</button>
        <button type="button" class="action-btn" id="btn-copy" ${decode.ok ? '' : 'disabled'}>Copy JSON</button>
        <button type="button" class="action-btn" id="btn-refresh">Refresh</button>
        <button type="button" class="action-btn" id="btn-open-raw">Open Raw</button>
      </div>
    </div>

    <div class="panes" id="panes" data-mode="${viewMode}">
      <section class="pane pane-json">
        <div class="pane-header">JSON (editable · save re-encodes to .obuf)</div>
        ${jsonBody}
      </section>
      <section class="pane pane-hex">
        <div class="pane-header" id="hex-header">Binary Hex (${sizeLabel})</div>
        ${hexBody}
      </section>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const panes = document.getElementById('panes');
    const modeButtons = Array.from(document.querySelectorAll('.segmented button[data-view]'));
    const editor = document.getElementById('json-editor');
    const highlight = document.getElementById('json-highlight');
    const highlightCode = highlight ? highlight.querySelector('code') : null;
    const statusBadge = document.getElementById('json-status');
    const hexCode = document.getElementById('hex-code');
    const hexHeader = document.getElementById('hex-header');
    const fileMeta = document.getElementById('file-meta');
    const fileName = ${JSON.stringify(fileName)};

    function escapeHtml(input) {
      return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function highlightJson(jsonText) {
      const escaped = escapeHtml(jsonText);
      return escaped.replace(
        /(&quot;(?:\\\\u[0-9a-fA-F]{4}|\\\\[^u]|[^\\\\&]|&(?!quot;))*&quot;)(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+-]?\\d+)?/g,
        (match, str, colon, literal) => {
          if (str !== undefined) {
            if (colon !== undefined) {
              return '<span class="tok-key">' + str + '</span>' + colon;
            }
            return '<span class="tok-string">' + str + '</span>';
          }
          if (literal !== undefined) {
            return literal === 'null'
              ? '<span class="tok-null">' + literal + '</span>'
              : '<span class="tok-bool">' + literal + '</span>';
          }
          return '<span class="tok-num">' + match + '</span>';
        }
      );
    }

    function syncEditor(text) {
      if (highlightCode) {
        // Trailing newline ensures the highlight layer scrolls identically to the textarea.
        highlightCode.innerHTML = highlightJson(text) + (text.endsWith('\\n') ? ' ' : '');
      }
      if (statusBadge) {
        try {
          JSON.parse(text);
          statusBadge.textContent = 'JSON valid';
          statusBadge.classList.remove('invalid');
        } catch (err) {
          statusBadge.textContent = 'Invalid JSON';
          statusBadge.classList.add('invalid');
        }
      }
    }

    function setMode(mode) {
      panes.dataset.mode = mode;
      for (const btn of modeButtons) {
        btn.classList.toggle('active', btn.dataset.view === mode);
      }
      vscode.postMessage({ type: 'viewModeChanged', mode });
    }

    for (const btn of modeButtons) {
      btn.addEventListener('click', () => setMode(btn.dataset.view));
    }

    if (editor) {
      editor.addEventListener('input', () => {
        syncEditor(editor.value);
        vscode.postMessage({ type: 'edit', text: editor.value });
      });

      editor.addEventListener('scroll', () => {
        if (highlight) {
          highlight.scrollTop = editor.scrollTop;
          highlight.scrollLeft = editor.scrollLeft;
        }
      });

      editor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = editor.selectionStart;
          const end = editor.selectionEnd;
          editor.value = editor.value.slice(0, start) + '  ' + editor.value.slice(end);
          editor.selectionStart = editor.selectionEnd = start + 2;
          syncEditor(editor.value);
          vscode.postMessage({ type: 'edit', text: editor.value });
        }
      });
    }

    document.getElementById('btn-format')?.addEventListener('click', () => {
      if (!editor) return;
      try {
        const formatted = JSON.stringify(JSON.parse(editor.value), null, 2);
        if (formatted !== editor.value) {
          editor.value = formatted;
          syncEditor(formatted);
          vscode.postMessage({ type: 'edit', text: formatted });
        }
      } catch {
        // Status badge already indicates invalid JSON.
      }
    });

    document.getElementById('btn-copy')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'copyJson', text: editor ? editor.value : undefined });
    });

    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });

    document.getElementById('btn-open-raw')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'openRaw' });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'updateHex') {
        if (hexCode) hexCode.textContent = msg.hexText;
        if (hexHeader) hexHeader.textContent = 'Binary Hex (' + msg.sizeLabel + ')';
        if (fileMeta) fileMeta.textContent = fileName + ' · ' + msg.sizeLabel;
      } else if (msg.type === 'updateJson' && editor) {
        if (editor.value !== msg.text) {
          editor.value = msg.text;
          syncEditor(msg.text);
        }
      }
    });
  </script>
</body>
</html>`;
}
