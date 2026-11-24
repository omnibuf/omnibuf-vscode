# Changelog

## 0.1.1

- Restricted `omnibuf.cliPath` to machine scope and untrusted workspace protection.
- Escaped inline script metadata in webview HTML, added find widget support, workspace-relative `omnibuf.schemaPath` resolution, dirty-edit reload protection, and CLI buffer caps.
- Excluded sourcemaps and `renovate.json` from the packaged `.vsix`.

## 0.1.0

- Default custom editor for `*.obuf` files backed by the `omnibuf` CLI.
- Editable, syntax-highlighted JSON view by default with `Cmd+S` / `Ctrl+S` re-encoding via `omnibuf encode`.
- Built-in **Split** (JSON + canonical 16-byte hex/ASCII) and **Hex** views, plus **Open Raw** integration with `ms-vscode.hexeditor` or VS Code's default binary editor.
- Optional schema-aware decoding/encoding (`omnibuf.schemaPath`, `omnibuf.messageType`), `omnibuf.includeField0`, and `omnibuf.deterministic`.
